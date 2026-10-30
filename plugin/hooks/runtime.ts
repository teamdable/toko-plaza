import type { CommandRunResult, EngineInterface } from 'claude-code'

import type { TokoChoice, TokoPet, TokoSettings } from '../types'

import { FOCUS_MINUTES, answerOffer, apologize, askName, balance, giveName, catchInGame, chatted, checkInit, comeHome, createBrain, cycleRoom, demoBoss, demoCoins, demoSouvenir, doingOf, dyeItem, exchangeForStars, giftToFriend, noteDoing, sendSticker, drawPet, ensureScene, feed, fillMemo, forgetMemo, forgetSignal, greet, hush, isPlazaReady, load, memoryAskOf, moveChannel, moveInGame, newsReport, noteFeature, noteTurnText, noteWorked, offerLine, onAttention, onCheckPrompt, onEdit, onGit, onMeasure, onPermission, onSubagents, onTest, onTurnComplete, onTyping, openOffer, openPlazaStream, parkMemo, peersText, peerMatches, fillSend, play, pollPeers, pollPlaza, prepareNews, progressOf, pullFromGacha, placeInRoom, playInRoom, plazaOffText, purchase, reflect, refreshShared, remember, roomViewOf, replyToPeer, resetDayIfNeeded, runEncounter, runHalloween, save, say, sendPlaza, sendToPeer, showNews, signalPeers, startBonk, startFocus, sendGuestHome, startHatch, stopFocus, storeInRoom, summarizePeer, viewFriendRoom, visitFriend, switchPet, sync, syncShared, tendVisitor, tendWaitBuddy, think, todayTally, todayWork, toggleWear, tryNews } from './brain'
import type { Brain } from './brain'
import { BADGES, badgeText } from './lib/badges'
import { BOSS_REWARD, BOSS_STREAK, failedCount } from './lib/boss'
import { DEX_NAMES, DEX_REWARD, dexText, isEncounterKind } from './lib/dex'
import { BUG_REWARD, CACHE_BONUS, DAILY_TOKEN_CAP, GACHA, HEALTH_REWARD, SHOP, SPEND, STAR_PIECES_PER_PICK, shopItem, turnIncome } from './lib/economy'
import { FEATURE_REWARD, featureOfCommand, featureOfTool, featureText } from './lib/features'
import { isCheckPrompt, permissionKey } from './lib/tips'
import { readEditLines, readGitEvents, readTestOutcome } from './lib/perceive'
import type { GitOperation } from './lib/perceive'
import { parseSendWords, signalLabel } from './lib/peers'
import { RESERVED_AI_CALLS, bubbleLine, chatRules, nameProblem } from './lib/persona'
import { RARITY_LABEL, SPECIES, STAGE_LABEL, UNNAMED, isAwaitingName, nameOf, rarityOf } from './lib/pet'
import { memoText } from './lib/memo'
import type { Limit } from './lib/meter'
import { ROOM_ACTS, ROOM_ACT_LABEL, bonkBoardText, channelsText, findFriend, isRoomAct, plazaEndpoint, weatherText } from './lib/plaza'
import type { PlazaAction, RoomAct } from './lib/plaza'
import { QUEST_BONUS, QUEST_REWARD, questText } from './lib/quests'
import type { RoomSlot } from './lib/room'
import { ROOM_SLOTS, furnitureText, isRoomItem, isRoomSlot, layoutOf, storedRoomItems } from './lib/room'
import { hashText } from './lib/random'
import type { Canvas } from './lib/raster'
import { createCanvas, encodeCells } from './lib/raster'
import { BAND_ROWS, paint, paintRoom, tick } from './lib/scene'
import { MINUTE } from './lib/time'
import { todayText } from './lib/today'
import type { GachaKind, ShopItem, TurnUsage } from './lib/economy'

type $ = EngineInterface

export const TICK_MS = 100
export const NEWS_DELAY_MS = 8000
export const INIT_TIP_DELAY_MS = 5000
export const THINK_EVERY = 20
export const SYNC_EVERY = 40
export const SAVE_EVERY = 300
export const BLIT_DENY_LIMIT = 6
export const ROOM_ID = 'toko-room'
export const ROOM_ROWS = 20
export const SCENE_KEY = 'toko-scene'
export const ROOM_KEY = 'toko-room-scene'

export type Site = { requestId: string; columns: number; canvas: Canvas; lastCells: string; denies: number }

export type Chat = { text: string; turnId: string | null }

export type Ctx = {
  brain: Brain
  band: Site | null
  room: Site | null
  ticks: number
  loop: { cancel: () => void } | null
  isTicking: boolean
  chat: Chat | null
}

export const createCtx = (serverUrl: string): Ctx => ({
  brain: createBrain(hashText(`${Date.now()}-${Math.random()}`), serverUrl),
  band: null,
  room: null,
  ticks: 0,
  loop: null,
  isTicking: false,
  chat: null,
})

export async function now($: $, ctx: Ctx): Promise<number> {
  ctx.brain.now = await $.clock.now()
  return ctx.brain.now
}

export const siteFor = (site: Site | null, requestId: string, columns: number, rows: number): Site =>
  site !== null && site.columns === columns && site.requestId === requestId ? site : { requestId, columns, canvas: createCanvas(columns, rows), lastCells: '', denies: 0 }

async function blitSite($: $, site: Site, key: string, rows: number): Promise<void> {
  const cells = encodeCells(site.canvas)
  if (cells === site.lastCells) {
    return
  }
  site.lastCells = cells
  const result = await $.ui.blit({ requestId: site.requestId, key, cells, columns: site.columns, rows })
  if (result.deny === undefined) {
    site.denies = 0
    return
  }
  site.denies += 1
  if (site.denies >= BLIT_DENY_LIMIT) {
    site.denies = 0
    $.ui.invalidate('ui.render')
  }
}

export async function frame($: $, ctx: Ctx): Promise<void> {
  if (ctx.isTicking) {
    return
  }
  ctx.isTicking = true
  const brain = ctx.brain
  try {
    ctx.ticks += 1
    brain.now += TICK_MS
    const scene = brain.scene
    if (scene !== null && !brain.isReducedMotion) {
      tick(scene, TICK_MS, brain.random)
      if (ctx.band !== null && !brain.isLineMode) {
        paint(scene, ctx.band.canvas)
        await blitSite($, ctx.band, SCENE_KEY, BAND_ROWS)
      }
      if (ctx.room !== null && ctx.ticks % 3 === 0) {
        paintRoom(scene, ctx.room.canvas, roomViewOf(brain))
        await blitSite($, ctx.room, ROOM_KEY, ROOM_ROWS)
      }
    }
    if (ctx.ticks % THINK_EVERY === 0) {
      await now($, ctx)
      await resetDayIfNeeded($, brain)
      await refreshShared($, brain)
      if (ctx.ticks % SYNC_EVERY === 0) {
        await syncShared($, brain)
      }
      await think($, brain)
      openPlazaStream($, brain)
      await pollPlaza($, brain)
      await tendWaitBuddy($, brain)
      if (brain.viewing !== null && brain.now - brain.viewing.fetchedAt >= VIEW_REFRESH_MS) {
        await viewFriendRoom($, brain, brain.viewing.host)
      }
      await pollPeers($, brain)
      await tendVisitor($, brain, TICK_MS * THINK_EVERY)
      await sync($, brain)
    }
    if (ctx.ticks % SAVE_EVERY === 0 && brain.isDirty) {
      await save($, brain)
    }
  } finally {
    ctx.isTicking = false
  }
}

export async function registerSurfaces($: $): Promise<void> {
  await $.command.register({ name: 'toko', description: 'Talk to Toko (/toko 안녕!), open Toko’s room, or change how Toko behaves (/toko help)', argumentHint: '[하고 싶은 말|help|mute|quests|focus|shop|…]' })
  await $.command.register({ name: 'bonk', description: 'Ask Toko to bonk Claude with a squeaky hammer', argumentHint: '<reason>', immediate: true })
  await $.command.register({ name: 'feed', description: 'Give Toko a snack' })
  await $.command.register({ name: 'play', description: 'Play with Toko for a moment' })
  await $.command.register({ name: 'memo', description: 'Park a stray thought with Toko; it comes back after the turn', argumentHint: '<내용>', immediate: true })
  await $.tool.register({
    name: 'pet_status',
    description: "Read the user's Toko companion pet: its name, mood, needs and coins. Use only when the user asks about their pet.",
    inputSchema: { type: 'object', properties: {} },
  })
  await $.tool.register({
    name: 'apologize',
    description: "Apologize to the user's Toko pet after it bonked you. Call once, right after a message that says Toko bonked you.",
    inputSchema: { type: 'object', properties: { words: { type: 'string', description: 'A short apology in the user’s language' } } },
    isDeferred: false,
  })
  await $.tool.register({
    name: 'command',
    description: "Run one of the user's Toko pet commands for them, as `/toko <args>` would: `feed`, `play`, `mute`, `focus 25`, `quests`, `buy cookie`. Use only when the user asks their pet Toko to do something.",
    inputSchema: { type: 'object', properties: { args: { type: 'string', description: 'What follows /toko, e.g. "focus 25"' } }, required: ['args'] },
  })
}

async function readEnvironment($: $, brain: Brain): Promise<void> {
  const [noColor, forceColor, term, settings] = await Promise.all([
    $.env.get('NO_COLOR'),
    $.env.get('FORCE_COLOR'),
    $.env.get('TERM'),
    $.settings.read().catch(() => ({})),
  ])
  brain.isLineMode = (noColor !== undefined && noColor !== '') || forceColor === '0' || term === 'dumb'
  brain.isReducedMotion = (settings as Record<string, unknown>).prefersReducedMotion === true
}

export async function start($: $, ctx: Ctx): Promise<void> {
  const brain = ctx.brain
  await now($, ctx)
  brain.sessionId = await $.session.id()
  brain.costBase = await $.session
    .usage()
    .then(usage => usage.cost?.usd ?? 0)
    .catch(() => 0)
  brain.lastCostUsd = brain.costBase
  brain.version = await $.session
    .version()
    .then(version => (version.base ?? version.version).replace(/-.*$/, ''))
    .catch(() => '')
  await readEnvironment($, brain)
  await load($, brain)
  await reflect($, brain)
  await registerSurfaces($)
  ensureScene(brain, 80)
  await sync($, brain)
  await signalPeers($, brain, 'idle')
  ctx.loop?.cancel()
  ctx.loop = $.clock.every(TICK_MS, () => void frame($, ctx))
  $.clock.after(NEWS_DELAY_MS, () => void prepareNews($, brain))
  $.clock.after(INIT_TIP_DELAY_MS, () => void checkInit($, brain))
  if (brain.pet === null || brain.pet.growth.stage === 'egg') {
    $.clock.after(1500, () => void startHatch($, brain))
    return
  }
  if (isAwaitingName(brain.pet)) {
    await askName($, brain)
    return
  }
  await greet($, brain)
}

export async function stop($: $, ctx: Ctx, reason: string): Promise<void> {
  await now($, ctx)
  await save($, ctx.brain)
  await forgetSignal($, ctx.brain)
  if (reason !== 'clear') {
    ctx.loop?.cancel()
    ctx.loop = null
  }
}

export async function typing($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await onTyping($, ctx.brain)
}

export const titled = (ctx: Ctx, title: string | undefined, transcriptPath: string): void => {
  ctx.brain.transcriptPath = transcriptPath
  if (title !== undefined && title.trim() !== '') {
    ctx.brain.sessionTitle = signalLabel(title)
  }
}

export async function submitted($: $, ctx: Ctx, text: string, isPersonTyped: boolean): Promise<void> {
  const brain = ctx.brain
  await now($, ctx)
  brain.lastInputAt = brain.now
  brain.lastTypingAt = brain.now
  if (isPersonTyped) {
    brain.promptLabel = signalLabel(text)
  }
  if (isPersonTyped && isCheckPrompt(text)) {
    onCheckPrompt(brain)
  }
  if (isPersonTyped && brain.settings.isMoodSensing && brain.settings.isAiOn && text.length > 0) {
    void $.model
      .classify(text.slice(0, 600), ['calm', 'annoyed', 'stuck'])
      .then(label => (label === 'annoyed' ? remember(brain, 'annoyed', '', 1) : undefined))
      .catch(() => undefined)
  }
}

export async function turnStarted($: $, ctx: Ctx, text: string): Promise<void> {
  const brain = ctx.brain
  await now($, ctx)
  noteTurnText(brain, text)
  brain.isTurnRunning = true
  noteDoing(brain, '생각하고')
  brain.turnStartedAt = brain.now
  brain.typedDuringTurn = false
  brain.longTurnStage = 0
  await signalPeers($, brain, 'working')
  if (brain.offer !== null && ctx.chat === null && brain.offer.kind !== 'bonk-end' && brain.offer.kind !== 'name') {
    await answerOffer($, brain, 'ignored')
  }
}

export async function turnEnded($: $, ctx: Ctx, durationMs: number, reason: string, usage: TurnUsage | undefined, answer: string): Promise<void> {
  await now($, ctx)
  noteDoing(ctx.brain, null)
  await onTurnComplete($, ctx.brain, durationMs, reason, usage)
  await replyToPeer($, ctx.brain, answer)
  await noteWorked($, ctx.brain, answer)
  $.clock.after(1500, () => void thinkLater($, ctx))
}

async function thinkLater($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await think($, ctx.brain)
  await sync($, ctx.brain)
}

export async function toolRan($: $, ctx: Ctx, tool: string, command: string | undefined, isError: boolean, text: string, result: unknown, isBackground = false): Promise<void> {
  const brain = ctx.brain
  if (brain.isTurnRunning) {
    noteDoing(brain, doingOf(tool, command))
  }
  const feature = isError ? null : featureOfTool(tool, isBackground)
  if (feature !== null) {
    $.clock.after(1, () => void featureUsed($, ctx, feature))
  }
  if (tool === 'Agent' || tool === 'Task') {
    onSubagents(brain, 1)
  }
  const edited = isError ? null : readEditLines(tool, result)
  if (edited !== null) {
    onEdit(brain, edited.added, edited.removed)
  }
  if (command === undefined) {
    return
  }
  await now($, ctx)
  const outcome = readTestOutcome(command, isError, text)
  if (outcome !== null) {
    await onTest($, brain, outcome.kind, outcome.key, outcome.summary, outcome.kind === 'test-fail' ? failedCount(text) : null)
  }
  const operation = isError ? undefined : (result as { gitOperation?: GitOperation } | undefined)?.gitOperation
  for (const event of readGitEvents(operation, isError ? '' : command)) {
    await onGit($, brain, event.kind, event.detail)
  }
}

export async function featureUsed($: $, ctx: Ctx, id: string): Promise<void> {
  if (!ctx.brain.isLoaded) {
    return
  }
  await now($, ctx)
  await noteFeature($, ctx.brain, id)
  await sync($, ctx.brain)
}

export async function commandUsed($: $, ctx: Ctx, command: string): Promise<void> {
  const feature = featureOfCommand(command)
  if (feature !== null) {
    await featureUsed($, ctx, feature)
  }
}

export async function petStatus($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  const pet = brain.pet
  const soul = pet?.soul
  if (pet === null || soul === null || soul === undefined) {
    return 'Toko is still an egg.'
  }
  return JSON.stringify({
    name: nameOf(pet),
    stage: pet.growth.stage,
    mood: brain.mood,
    needs: { energy: Math.round(brain.needs.energy), fun: Math.round(brain.needs.fun), hunger: Math.round(brain.needs.hunger), social: Math.round(brain.needs.social) },
    coins: balance(brain),
  })
}

export async function apologized($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  return apologize($, ctx.brain)
}

export async function measured($: $, ctx: Ctx, contextPercent: number | undefined, limits: readonly Limit[], costUsd: number | undefined): Promise<void> {
  await now($, ctx)
  await onMeasure($, ctx.brain, contextPercent, limits, costUsd)
}

export async function attention($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await onAttention($, ctx.brain)
}

export async function permissionAsked($: $, ctx: Ctx, tool = '', input: unknown = undefined): Promise<void> {
  if (tool !== '') {
    onPermission(ctx.brain, permissionKey(tool, input))
  }
  await attention($, ctx)
  await signalPeers($, ctx.brain, 'waiting')
}

export const HELP = [
  '/toko <하고 싶은 말> — 토코와 이야기하기 (예: /toko 안녕!, /toko 오늘의 퀘스트는 뭐야?)',
  '토코야 <말> — 슬래시 없이 불러도 /toko <말> 과 같아요 (펫 이름+아/야도)',
  '/toko — 토코의 방 열기 (상점 · 꾸미기 · 펫 뽑기 · 광장)',
  '/toko close — 토코의 방 닫기',
  '/toko mute | unmute — 말 걸기 끄기/켜기',
  '/toko hide | show — 띠 숨기기/보이기',
  '/toko quiet 22-09 | quiet off — 방해 금지 시간',
  '/toko break 50 — 휴식 권유 간격(분)',
  '/toko off-work 19 | off-work off — 퇴근 시각',
  '/toko ai on | off | 60 — 작은 모델 쓰기 · 하루 호출 한도(기본 30)',
  '/toko notify on | off — 집중이 끝나면 OS 알림(하루 3회)',
  '/toko peers on | off — 옆 세션이 답을 마치거나 확인을 기다릴 때 알리기',
  '/toko sessions [이름|번호] — 옆 세션 목록 · 탭 이름 일부나 번호를 주면 그 세션 요약',
  '/toko send <이름|번호> <내용> — 탭 이름 일부나 번호로 고른 옆 세션에 보내기 · send 대신 보내 · "/toko 배포한테 로그 봐 줘 보내줘" 처럼 말해도 돼요',
  '/toko meter on | off — 띠의 컨텍스트·비용·한도 미터',
  '/toko mood-sense on | off — 짜증 감지(프롬프트를 모델에 보냄, 기본 꺼짐)',
  '/toko shop | buy <id> | wear <id> — 상점 · 캐릭터 꾸미기',
  `/toko place <id> [자리] | store <id> | layout — 방 꾸미기 (자리: ${ROOM_SLOTS.map(slot => slot.id).join(' · ')})`,
  '/toko visit <친구> | home — 친구 방에 놀러 가기 · 데려오기(데려올 때까지 거기서 지내요)',
  `/toko guest <손님> <${ROOM_ACTS.join('|')}|bye> — 내 방 손님과 놀기 · 배웅하기`,
  '/toko room-open on | off — 친구 펫이 방에 놀러 오게 하기',
  `/toko gacha furniture · furniture · exchange <id> — 가구 뽑기(테마 세트) · 가구 도감 · 별조각 ${STAR_PIECES_PER_PICK}개로 고르기`,
  `/toko dye <id> — 모자 · 목 · 등 · 손 아이템 물들이기(${SPEND.dye}코인)`,
  '/toko gift <친구> <id> · sticker <친구> <heart|star|flower> — 친구에게 방 장식 선물 · 방명록 스티커(하루 3장)',
  '/toko doing auto | off | <문구> — 광장 이름표에 지금 하는 일 보여 주기',
  '/toko card — 펫 카드',
  '/toko focus 25 | focus off — 집중 타이머(그동안 말 걸지 않기)',
  '/toko coins — 코인 모으는 법',
  '/toko quests — 오늘의 퀘스트',
  '/toko badges — 업적',
  '/toko dex — 인카운터 도감',
  '/toko news — Claude Code 새 기능 소개 다시 보기',
  '/toko features — 기능 도감(처음 써 본 Claude Code 기능마다 5코인)',
  '/toko memo [내용 | clear] — 생각 주차장 메모 (/memo <내용> 도 같음)',
  '/toko today — 오늘 한 일 요약을 클립보드에 복사',
  '/toko name <이름> — 이름 짓기 · 바꾸기',
  `/toko draw — 펫 뽑기(${SPEND.draw}코인, 알부터 키워요)`,
  '/toko answer <선택지> — 토코가 물어본 것에 대답하기 (예: /toko answer 숨 고르기)',
  `/toko gacha fashion | gacha pet — 패션 아이템 · 애완동물 랜덤 뽑기(각 ${GACHA.fashion.price}코인, 안 가진 것만 나와요)`,
  '/toko pets | pick <번호|이름> — 보관함 보기 · 같이 다닐 펫 바꾸기',
  '/toko plaza on | off | link | channel [번호] | wave <이름|all> | heart <이름> | snack <이름> | cheer <이름> | invite — 광장(link: 브라우저에서 내 펫 움직이기, channel: 채널 보기 · 옮기기)',
  '/toko event <종류> [shiny] — 이벤트나 장면 바로 보기(시연용, update: 새 기능 소개, halloween: 할로윈 장면, boss: 보스전, souvenir: 휴식 기념품, coins [개수]: 코인 받기)',
  '/bonk <이유> — 뿅망치로 Claude 때리기',
  '/feed · /play — 먹이 · 놀기',
].join('\n')

const parseHours = (text: string): readonly [number, number] | null => {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(text.trim())
  if (match === null) {
    return null
  }
  const start = Number(match[1])
  const end = Number(match[2])
  return start < 24 && end < 24 ? [start, end] : null
}

const onOff = (value: string | undefined): boolean | null => (value === 'on' ? true : value === 'off' ? false : null)

async function changeSettings($: $, brain: Brain, change: Partial<TokoSettings>, reply: string): Promise<{ text: string }> {
  brain.settings = { ...brain.settings, ...change }
  brain.isDirty = true
  await save($, brain)
  await sync($, brain)
  return { text: reply }
}

type ToggleWord = 'ai' | 'notify' | 'peers' | 'meter' | 'mood-sense' | 'room-open'

type Toggle = { key: 'isAiOn' | 'isNotifyOn' | 'isPeersOn' | 'isMeterOn' | 'isMoodSensing'; example: 'on' | 'off'; on: string; off: string }

const TOGGLES: Readonly<Record<ToggleWord, Toggle>> = {
  ai: { key: 'isAiOn', example: 'off', on: '작은 모델로 생각할게요.', off: '규칙과 준비된 말로만 움직일게요.' },
  notify: { key: 'isNotifyOn', example: 'on', on: '집중이 끝나면 OS 알림을 하루 3번까지 보낼게요.', off: 'OS 알림을 껐어요.' },
  peers: { key: 'isPeersOn', example: 'off', on: '옆 세션 소식을 전할게요.', off: '옆 세션 소식은 전하지 않을게요.' },
  meter: { key: 'isMeterOn', example: 'off', on: '띠에 컨텍스트·비용·한도를 보여 줄게요.', off: '미터를 껐어요.' },
  'mood-sense': { key: 'isMoodSensing', example: 'on', on: '프롬프트 분위기를 살필게요(원문은 저장하지 않아요).', off: '분위기 살피기를 껐어요.' },
  'room-open': { key: 'isRoomOpen', example: 'off', on: '친구 펫이 방에 놀러 올 수 있어요.', off: '방 문을 닫았어요. 광장에 방을 보여 주지 않아요.' },
}

async function toggleSetting($: $, brain: Brain, word: ToggleWord, value: string | undefined): Promise<{ text: string }> {
  const toggle = TOGGLES[word]
  const isOn = onOff(value)
  return isOn === null ? { text: `예: /toko ${word} ${toggle.example}` } : changeSettings($, brain, { [toggle.key]: isOn }, isOn ? toggle.on : toggle.off)
}

const badgeLine = (brain: Brain): string => {
  const badges = progressOf(brain).badges
  const unlocked = badges.filter(badge => badge.at !== null).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  const latest = unlocked.at(-1)
  return `업적 ${unlocked.length}/${badges.length}${latest === undefined ? '' : ` · 최근: ${latest.name}`}`
}

export const card = (brain: Brain): string => {
  const pet = brain.pet
  const soul = pet?.soul
  if (pet === null || soul === null || soul === undefined) {
    return '아직 알이에요. 곧 깨어나요.'
  }
  const traits = soul.traits
  return [
    `**${nameOf(pet) ?? UNNAMED}** · ${STAGE_LABEL[pet.growth.stage]} · ${SPECIES[pet.bones.species].label} · ${RARITY_LABEL[rarityOf(pet.bones)]}`,
    `성격: ${soul.personality}`,
    `말버릇: ${soul.quirk}`,
    `성향: 활발 ${traits.energetic} · 수다 ${traits.chatty} · 걱정 ${traits.worried} · 장난 ${traits.playful}`,
    `함께한 날 ${pet.growth.daysTogether}일 · 받아들인 휴식 ${pet.growth.breaksAccepted}번 · 코인 ${balance(brain)}`,
    badgeLine(brain),
    ...(brain.memory.lessons.length > 0 ? [`배운 것: ${brain.memory.lessons.at(-1)}`] : []),
  ].join('\n')
}

const SOUVENIR_STAT: Readonly<Record<string, string>> = { water: '물 한 모금', stretch: '기지개', 'eye-rest': '먼 곳 보기' }

const souvenirLine = (item: ShopItem): string => (item.souvenir === undefined ? '' : `${SOUVENIR_STAT[item.souvenir.stat] ?? item.souvenir.stat} ${item.souvenir.need}번`)

const layoutText = (brain: Brain): string => {
  const layout = layoutOf(brain.wallet)
  const stored = storedRoomItems(brain.wallet)
  return [
    '방 꾸미기 (/toko place <id> [자리] · /toko store <id>):',
    ...ROOM_SLOTS.map(slot => `- ${slot.id} · ${slot.label}: ${shopItem(layout[slot.id] ?? '')?.name ?? '비어 있음'}`),
    `창고: ${stored.length === 0 ? '비어 있음' : stored.map(item => `${item.id}(${item.name})`).join(' · ')}`,
  ].join('\n')
}

const shopLine = (brain: Brain, item: ShopItem): string =>
  `- ${item.id} · ${item.name} · ${item.price}코인${brain.wallet.items.includes(item.id) && item.kind !== 'snack' ? ' (보유)' : ''}`

const shopText = (brain: Brain): string =>
  [
    '상점 (/toko buy <id>):',
    ...SHOP.filter(item => item.kind === 'snack').map(item => shopLine(brain, item)),
    '캐릭터 치장 (망치):',
    ...SHOP.filter(item => item.kind === 'hammer').map(item => shopLine(brain, item)),
    '애완동물:',
    ...SHOP.filter(item => item.kind === 'pet').map(item => shopLine(brain, item)),
    '방 치장 (사면 빈자리에 바로 놓여요):',
    ...SHOP.filter(item => isRoomItem(item) && item.souvenir === undefined && item.set === undefined).map(item => shopLine(brain, item)),
    '휴식 기념품 (쉬다 보면 생겨요):',
    ...SHOP.filter(item => item.souvenir !== undefined).map(item => `- ${item.name} · ${souvenirLine(item)}${brain.wallet.items.includes(item.id) ? ' (보유)' : ''}`),
    `뽑기: /toko gacha fashion (모자 · 안경 · 목 · 등 · 손은 뽑기로만, ${GACHA.fashion.price}코인) · /toko gacha pet (애완동물, ${GACHA.pet.price}코인) · /toko gacha furniture (테마 세트 가구, ${GACHA.furniture.price}코인)`,
    `코인 ${balance(brain)}`,
  ].join('\n')

const petLine = (pet: TokoPet): string =>
  `${pet.soul === null ? '알' : (nameOf(pet) ?? UNNAMED)} · ${SPECIES[pet.bones.species].label} · ${RARITY_LABEL[rarityOf(pet.bones)]} · ${STAGE_LABEL[pet.growth.stage]}`

const shelfText = (brain: Brain): string =>
  [
    brain.pet === null ? '같이 다니는 펫이 없어요.' : `같이 다니는 펫: ${petLine(brain.pet)}`,
    ...(brain.shelf.length === 0 ? ['보관함이 비어 있어요. /toko draw 로 새 펫을 뽑아요.'] : ['보관함 (/toko pick <번호|이름>):', ...brain.shelf.map((pet, index) => `${index + 1}. ${petLine(pet)}`)]),
  ].join('\n')

const findShelved = (shelf: readonly TokoPet[], query: string): TokoPet | undefined => {
  const index = Number(query)
  return Number.isInteger(index) ? shelf[index - 1] : shelf.find(pet => pet.soul?.name === query)
}

const DEMO_COINS = 1000
const MAX_DEMO_COINS = 100_000

const TOKEN_EXAMPLES = [500, 1_500, 7_500] as const

const coinGuide = (brain: Brain): string => {
  const badgeRewards = BADGES.map(badge => badge.reward)
  const tokenCoins = TOKEN_EXAMPLES.map(tokens => `${tokens.toLocaleString('en-US')}토큰 ${turnIncome({ input_tokens: 0, output_tokens: tokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })}코인`)
  return [
    `코인 모으는 법 · 지금 ${balance(brain)}코인`,
    '',
    '일하면서',
    `- 턴이 끝날 때 출력 토큰만큼 받아요: ${tokenCoins.join(' · ')}`,
    `- 캐시를 절반 넘게 읽은 턴은 ${CACHE_BONUS}배예요. 토큰 수입은 하루 ${DAILY_TOKEN_CAP}코인에서 멈춰요`,
    '',
    '쉬면서 (하루 상한 없음)',
    `- 기지개 ${HEALTH_REWARD.breakAccepted}코인 · 마무리 정리 ${HEALTH_REWARD.finishedOnTime}코인 · 집중 타이머 끝까지 ${HEALTH_REWARD.focusDone}코인`,
    `- 광장 같이 기지개 ${HEALTH_REWARD.plazaStretch}코인 · 먼 곳 보기 ${HEALTH_REWARD.eyeRestDone}코인 · 숨 고르기 ${HEALTH_REWARD.breathDone}코인`,
    '',
    '매일',
    `- 오늘의 퀘스트 하나에 ${QUEST_REWARD}코인, 셋 다 하면 ${QUEST_BONUS}코인과 선물 상자 (/toko quests)`,
    '',
    '처음 해 보면',
    `- 인카운터를 처음 보면 ${DEX_REWARD.first}코인, 반짝이면 ${DEX_REWARD.shiny}코인 더 (/toko dex)`,
    `- Claude Code 기능을 처음 쓰면 ${FEATURE_REWARD}코인 (/toko features)`,
    `- 업적 하나에 ${Math.min(...badgeRewards)}~${Math.max(...badgeRewards)}코인 (/toko badges)`,
    '',
    '가끔',
    `- 같은 테스트가 ${BOSS_STREAK}번 실패한 뒤 통과하면 보스를 쓰러뜨리고 ${BOSS_REWARD}코인`,
    `- 테스트를 통과시킨 직후 벌레 잡기: 한 마리에 ${BUG_REWARD.each}코인, 최대 ${BUG_REWARD.max}코인`,
  ].join('\n')
}

const PLAZA_WORDS: Readonly<Record<string, PlazaAction>> = { wave: 'wave', heart: 'heart', snack: 'snack', cheer: 'cheer', invite: 'stretch-call' }

async function channelCommand($: $, brain: Brain, target: string): Promise<string> {
  if (target === '') {
    return isPlazaReady(brain)
      ? (channelsText(brain.plazaChannel, brain.plazaChannels, brain.plazaChannelSize) ?? '채널 정보를 아직 받지 못했어요. 잠시 뒤에 다시 해 보세요.')
      : plazaOffText(brain)
  }
  return /^[1-9]\d{0,5}$/.test(target) ? moveChannel($, brain, Number(target)) : '채널 번호는 1 이상의 정수로 써 주세요. 예: /toko plaza channel 2'
}

async function plazaCommand($: $, brain: Brain, words: readonly string[]): Promise<{ text: string }> {
  const [sub, ...rest] = words
  const target = rest.join(' ')
  const toggle = onOff(sub)
  if (toggle !== null) {
    return changeSettings($, brain, { isPlazaOn: toggle }, toggle ? '광장에 나갈게요.' : '광장에서 나왔어요.')
  }
  if (sub === 'link') {
    const url = plazaEndpoint(brain.serverUrl, `/#me=${encodeURIComponent(brain.plazaId)}`)
    return {
      text:
        url === null
          ? '광장 서버가 설정되지 않았어요(serverUrl).'
          : [`이 주소를 브라우저로 열면 광장에서 ${nameOf(brain.pet) ?? '토코'}을(를) 직접 움직일 수 있어요. 방향키로 걷고 Enter로 말해요.`, '주소에 내 광장 id가 들어 있으니 다른 사람에게 보내지 마세요.', url].join('\n'),
    }
  }
  if (sub === 'channel') {
    return { text: await channelCommand($, brain, target) }
  }
  const action = sub === undefined ? undefined : PLAZA_WORDS[sub]
  if (action === undefined) {
    const friends = brain.friends.map(friend => `- ${friend.name} (${SPECIES[friend.species].label}, ${friend.status})`)
    const header = brain.serverUrl.length === 0 ? '광장 서버가 설정되지 않았어요(serverUrl).' : `광장: ${brain.settings.isPlazaOn ? '켜짐' : '꺼짐'}${brain.plazaChannel === null ? '' : ` · ${brain.plazaChannel}번 채널`} · 친구 ${brain.friends.length}명`
    const board = bonkBoardText(brain.plazaBonks)
    const weather = weatherText(brain.plazaWeather)
    return { text: [header, ...(weather === null ? [] : [weather]), ...friends, ...(board === null ? [] : [board])].join('\n') }
  }
  if (action === 'stretch-call' || target === 'all' || target === '') {
    return { text: await sendPlaza($, brain, action, null) }
  }
  const friend = findFriend(brain.friends, target)
  if (friend === undefined) {
    return { text: `광장에서 "${target}"을(를) 찾지 못했어요.` }
  }
  return { text: await sendPlaza($, brain, action, friend.id) }
}

export async function openRoom($: $, ctx: Ctx): Promise<string> {
  const opened = await $.ui.open({ id: ROOM_ID, title: `${nameOf(ctx.brain.pet) ?? '토코'}의 방` })
  return opened.isPlaced ? '토코의 방을 열었어요.' : `방을 열 자리가 없어요: ${opened.reason}`
}

export async function closeRoom($: $): Promise<string> {
  if (!(await $.ui.panes()).some(pane => pane.id === ROOM_ID)) {
    return '방이 열려 있지 않아요.'
  }
  await $.ui.close({ id: ROOM_ID })
  return '토코의 방을 닫았어요.'
}

export async function tokoCommand($: $, ctx: Ctx, args: string): Promise<CommandRunResult> {
  return (await subcommand($, ctx, args)) ?? (await choiceAnswer($, ctx, args.trim())) ?? (await naturalSend($, ctx, args.trim())) ?? chatCommand($, ctx, args.trim())
}

export type Heard = { drop: string } | { text: string; context: readonly string[] }

export async function heardByName($: $, ctx: Ctx, words: string): Promise<Heard> {
  const done = (await subcommand($, ctx, words)) ?? (await choiceAnswer($, ctx, words)) ?? (await naturalSend($, ctx, words))
  if (done !== null) {
    return { drop: done.text }
  }
  const brief = await chatBriefFor($, ctx, words)
  return brief === null ? { drop: EGG_CHAT } : { text: words, context: [brief] }
}

const escapeName = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const calledWords = (text: string, name: string | null): string | null => {
  const names = ['토코', ...(name === null || name === '토코' ? [] : [name])].map(escapeName).join('|')
  const match = new RegExp(`^\\s*(?:${names})(?:아|야)(?=[\\s,!~.]|$)[\\s,!~.]*([\\s\\S]*)$`).exec(text)
  return match === null ? null : (match[1] ?? '').trim()
}

const SEND = /^\s*(?:send|보내|보내줘)\s+(\S+)\s+([\s\S]+)$/

const SEND_WORD = /^\s*(?:send|보내|보내줘)(?:\s|$)/

const SEND_EXAMPLE = '예: /toko send 배포 로그도 같이 봐 줘'

async function choiceAnswer($: $, ctx: Ctx, words: string): Promise<{ text: string } | null> {
  const choice = ctx.brain.offer?.choices.find(candidate => sameWords(candidate.key, words) || sameWords(candidate.label, words))
  if (choice === undefined) {
    return null
  }
  await choose($, ctx, choice)
  return { text: `${choice.label}(으)로 대답했어요.` }
}

const CUES: Readonly<Record<string, RegExp>> = {
  'peer:summary': /^요약(?:좀)?(?:보기|보여줘|보여줄래|볼래|봐|해줘|줘)?$/,
  'peer:next': /^(?:다음일)?(?:보내기|보내|보내줘|보낼래|보내자)$/,
  'gift:accept': /^(?:열기|열어|열어줘|열어봐|열래|열자)$/,
  'bonk-end:breathe': /^숨(?:고르기|고를래|고르자|골라)$/,
  'bonk-end:tell': /^(?:전하기|전해|전해줘|전할래)$/,
  'memo:accept': /^입력창에?(?:넣기|넣어|넣어줘|넣을래)$/,
  'memo:drop': /^(?:지우기|지워|지워줘|지울래)$/,
  'cc-tip:accept': /^(?:써보기|써볼래|써볼게|써봐)$/,
  'cc-news:accept': /^(?:알려줘|알려|알려줄래)$/,
  'name:accept': /^이름(?:지어주기|지어줄게|지을래|지을게)$/,
  'name:auto': /^네가지어(?:줘)?$/,
}

const NOT_A_NAME = /^(?:응+|ㅇ+|ㅇㅋ|ㄴㄴ|ㄱ+|ㅋ+|ㅎ+|넵?|네+|예|아니(?:요)?|싫어|좋아|그래|오케이|계속|다시|고|됐어|고마워|감사|나중에|안녕(?:하세요)?|하이|헬로|도와줘|도움말|ok(?:ay)?|yes|no|y|n|go|continue|later|hi|hello|hey|help|fix|test|tests|commit|push|pull|build|run|deploy|review|lint|format|explain|status|diff|merge|rebase|undo|stop|exit|quit|clear)$/i

const ASKING = /(?:해|해줘|해봐|해요|해라|하자|할래|할까|했어|하기|줘|봐|주세요|하세요)$/

export const nameFromReply = (offer: Brain['offer'], text: string): string | null => {
  const word = text.trim().replace(/[.!~?]+$/, '')
  const isName = offer?.kind === 'name' && nameProblem(word) === null && /\p{L}/u.test(word) && !/^[/!#@]/.test(word) && !NOT_A_NAME.test(word) && !ASKING.test(word)
  return isName ? word : null
}

export async function nameByReply($: $, ctx: Ctx, name: string): Promise<void> {
  await now($, ctx)
  await giveName($, ctx.brain, name)
}

export const cuedChoice = (offer: Brain['offer'], text: string): TokoChoice | null => {
  const words = text.replace(/[\s.!~?,]+/g, '')
  return offer?.choices.find(choice => CUES[`${offer.kind}:${choice.key}`]?.test(words) === true) ?? null
}

async function naturalSend($: $, ctx: Ctx, words: string): Promise<{ text: string } | null> {
  const parsed = parseSendWords(words)
  if (parsed === null || (await peerMatches($, ctx.brain, parsed.query)).length !== 1) {
    return null
  }
  return { text: await sendToPeer($, ctx.brain, parsed.query, parsed.text) }
}

export async function commandTool($: $, ctx: Ctx, args: string): Promise<string> {
  if (SEND_WORD.test(args)) {
    await now($, ctx)
    const match = SEND.exec(args)
    const text = match?.[2]?.trim() ?? ''
    return match === null || text === '' ? SEND_EXAMPLE : fillSend($, ctx.brain, match[1] ?? '', text)
  }
  return (await subcommand($, ctx, args))?.text ?? `그런 명령은 없어요. 쓸 수 있는 명령:\n${HELP}`
}

async function subcommand($: $, ctx: Ctx, args: string): Promise<{ text: string } | null> {
  await now($, ctx)
  const brain = ctx.brain
  const [sub, ...rest] = args
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
  const value = rest[0]
  switch (sub) {
    case undefined:
    case 'room':
      return { text: await openRoom($, ctx) }
    case 'close':
      return { text: await closeRoom($) }
    case 'help':
      return { text: HELP }
    case 'mute':
      await hush($)
      return changeSettings($, brain, { isMuted: true }, '조용히 있을게요. /toko unmute 로 다시 불러요.')
    case 'unmute':
      return changeSettings($, brain, { isMuted: false }, '다시 말 걸게요.')
    case 'hide':
      return changeSettings($, brain, { isHidden: true }, '띠를 숨겼어요. 쉬자고 할 때만 잠깐 나타나요.')
    case 'show':
      return changeSettings($, brain, { isHidden: false }, '띠를 다시 보여요.')
    case 'quiet': {
      if (value === 'off') {
        return changeSettings($, brain, { quiet: null }, '방해 금지 시간을 껐어요.')
      }
      const hours = parseHours(value ?? '')
      return hours === null ? { text: '형식: /toko quiet 22-09' } : changeSettings($, brain, { quiet: hours }, `${hours[0]}시부터 ${hours[1]}시까지 조용히 있을게요.`)
    }
    case 'break': {
      const minutes = Number(value)
      return Number.isInteger(minutes) && minutes >= 15 && minutes <= 240
        ? changeSettings($, brain, { breakMinutes: minutes }, `${minutes}분마다 쉬자고 할게요.`)
        : { text: '15~240 사이 분으로 알려 주세요. 예: /toko break 50' }
    }
    case 'off-work': {
      if (value === 'off') {
        return changeSettings($, brain, { offWorkHour: null }, '퇴근 시각을 지웠어요.')
      }
      const hour = Number(value)
      return Number.isInteger(hour) && hour >= 0 && hour < 24 ? changeSettings($, brain, { offWorkHour: hour }, `${hour}시가 지나면 마무리 정리를 권할게요.`) : { text: '예: /toko off-work 19' }
    }
    case 'ai': {
      if (onOff(value) !== null) {
        return toggleSetting($, brain, sub, value)
      }
      const calls = Number(value)
      return Number.isInteger(calls) && calls >= 10 && calls <= 200
        ? changeSettings($, brain, { aiDailyCalls: calls }, `작은 모델을 하루 ${calls}번까지 부를게요. ${RESERVED_AI_CALLS}번은 직접 부른 일에 남겨 둬요.`)
        : { text: '예: /toko ai off · 하루 호출 한도는 10~200 사이로 /toko ai 60' }
    }
    case 'notify':
    case 'peers':
    case 'meter':
    case 'mood-sense':
    case 'room-open':
      return toggleSetting($, brain, sub, value)
    case 'shop':
      return { text: shopText(brain) }
    case 'buy':
      return { text: value === undefined ? shopText(brain) : await purchase($, brain, value) }
    case 'wear':
      if (value === undefined || shopItem(value) === undefined) {
        return { text: '예: /toko wear beanie' }
      }
      await toggleWear($, brain, value)
      return { text: `${shopItem(value)?.name} 착용을 바꿨어요.` }
    case 'layout':
      return { text: layoutText(brain) }
    case 'visit': {
      const friend = findFriend(brain.friends, rest.join(' '))
      if (friend === undefined) {
        return { text: '광장에 있는 친구 이름을 알려 주세요. 예: /toko visit 말랑' }
      }
      const text = await visitFriend($, brain, friend.id)
      await sync($, brain)
      return { text }
    }
    case 'home': {
      const text = await comeHome($, brain)
      await sync($, brain)
      return { text }
    }
    case 'guest':
      return { text: await guestCommand($, ctx, rest) }
    case 'furniture':
      return { text: furnitureText(brain.wallet) }
    case 'dye':
    case 'exchange': {
      if (value === undefined || shopItem(value) === undefined) {
        return { text: sub === 'dye' ? '예: /toko dye beanie' : `예: /toko exchange angel-wings (별조각 ${STAR_PIECES_PER_PICK}개)` }
      }
      const text = sub === 'dye' ? await dyeItem($, brain, value) : await exchangeForStars($, brain, value)
      await sync($, brain)
      return { text }
    }
    case 'gift':
    case 'sticker': {
      const [name, thing] = rest
      const friend = name === undefined ? undefined : findFriend(brain.friends, name)
      if (friend === undefined || thing === undefined) {
        return { text: sub === 'gift' ? '예: /toko gift 콩떡 cushion' : '예: /toko sticker 콩떡 heart (heart · star · flower)' }
      }
      const text = sub === 'gift' ? await giftToFriend($, brain, friend.id, thing) : await sendSticker($, brain, friend.id, thing)
      await sync($, brain)
      return { text }
    }
    case 'doing': {
      const words = rest.join(' ').trim()
      if (words.length === 0) {
        return { text: '예: /toko doing auto · /toko doing off · /toko doing 회의 준비 중 (20자까지)' }
      }
      const doing = words === 'auto' || words === 'off' ? words : [...words].slice(0, 20).join('')
      return changeSettings($, brain, { doing }, doing === 'off' ? '지금 하는 일을 광장에 보여 주지 않아요.' : doing === 'auto' ? 'Claude가 하는 일을 정해진 낱말로 광장에 보여 줘요.' : `광장 이름표에 "${doing}"을(를) 보여 줘요.`)
    }
    case 'place': {
      if (value === undefined) {
        return { text: layoutText(brain) }
      }
      const slot = rest[1]
      if (slot !== undefined && !isRoomSlot(slot)) {
        return { text: `자리는 ${ROOM_SLOTS.map(entry => entry.id).join(' · ')} 가운데 하나예요.` }
      }
      const text = await placeInRoom($, brain, value, slot)
      await sync($, brain)
      return { text }
    }
    case 'store': {
      if (value === undefined) {
        return { text: '예: /toko store lamp' }
      }
      const text = await storeInRoom($, brain, value)
      await sync($, brain)
      return { text }
    }
    case 'card':
      return { text: card(brain) }
    case 'focus':
      return { text: await focusCommand($, ctx, value) }
    case 'coins':
      return { text: coinGuide(brain) }
    case 'quests':
      return { text: questText(progressOf(brain).quests) }
    case 'badges':
      return { text: badgeText(progressOf(brain).badges) }
    case 'dex':
      return { text: dexText(progressOf(brain).dex) }
    case 'news':
      return { text: await newsReport($, brain) }
    case 'features':
      return { text: featureText(progressOf(brain).features) }
    case 'memo':
      return { text: await memoCommand($, ctx, rest.join(' ')) }
    case 'today':
      return { text: await todayCommand($, ctx) }
    case 'name': {
      if (brain.pet?.soul === null || brain.pet?.soul === undefined) {
        return { text: '아직 알이에요. 깨어나면 이름을 지어 주세요.' }
      }
      const name = rest.join(' ')
      const problem = nameProblem(name)
      if (problem !== null) {
        return { text: problem }
      }
      await giveName($, brain, name)
      return { text: `이름을 "${name}"(으)로 지었어요.` }
    }
    case 'answer':
      return { text: await answerCommand($, ctx, rest.join(' ')) }
    case 'gacha': {
      const kind = value === 'pet' || value === '애완동물' ? 'pet' : value === 'fashion' || value === '패션' ? 'fashion' : value === 'furniture' || value === '가구' ? 'furniture' : null
      if (kind === null) {
        return { text: '예: /toko gacha fashion · /toko gacha pet · /toko gacha furniture' }
      }
      const text = await pullFromGacha($, brain, kind)
      await sync($, brain)
      return { text }
    }
    case 'draw': {
      const text = await drawPet($, brain)
      await sync($, brain)
      return { text }
    }
    case 'pets':
      return { text: shelfText(brain) }
    case 'pick': {
      const pet = value === undefined ? undefined : findShelved(brain.shelf, rest.join(' '))
      return { text: pet === undefined ? shelfText(brain) : await switchPet($, brain, pet.id) }
    }
    case 'plaza':
      return plazaCommand($, brain, rest)
    case 'event': {
      const kind = value ?? 'stretch'
      if (kind === 'update') {
        $.clock.after(1, () => void demoNews($, ctx))
        return { text: '업데이트 내역에서 새 기능을 고르고 있어요. 몇 초 뒤에 토코가 알려 줄게요.' }
      }
      if (kind === 'coins') {
        const amount = Number(rest[1] ?? DEMO_COINS)
        if (!Number.isInteger(amount) || amount < 1 || amount > MAX_DEMO_COINS) {
          return { text: `코인은 1부터 ${MAX_DEMO_COINS}까지 정수로 적어 주세요. 예: /toko event coins ${DEMO_COINS}` }
        }
        const text = await demoCoins($, brain, amount)
        await sync($, brain)
        return { text }
      }
      if (kind === 'boss') {
        const text = await demoBoss($, brain)
        await sync($, brain)
        return { text }
      }
      if (kind === 'souvenir') {
        const text = await demoSouvenir($, brain)
        await sync($, brain)
        return { text }
      }
      if (kind === 'halloween') {
        await runHalloween($, brain)
        await sync($, brain)
        return { text: '할로윈 장면을 띄웠어요.' }
      }
      if (isEncounterKind(kind)) {
        await runEncounter($, brain, kind, rest[1] === 'shiny')
        await sync($, brain)
        return { text: `${DEX_NAMES[kind]} 장면을 띄웠어요.` }
      }
      await openOffer($, brain, kind, offerLine(brain, kind))
      return { text: `${kind} 이벤트를 띄웠어요.` }
    }
    case 'sessions':
      return { text: value === undefined ? await peersText($, brain) : await summarizePeer($, brain, value) }
    case 'send':
    case '보내':
    case '보내줘': {
      const match = SEND.exec(args)
      const text = match?.[2]?.trim() ?? ''
      return match === null || text === '' ? { text: SEND_EXAMPLE } : { text: await sendToPeer($, brain, match[1] ?? '', text) }
    }
    case 'feed':
      return { text: await feedCommand($, ctx) }
    case 'play':
      return { text: await playCommand($, ctx) }
    default:
      return null
  }
}

const chatBrief = (brain: Brain): string => {
  const needs = brain.needs
  const focus = brain.focus
  return [
    chatRules(nameOf(brain.pet) ?? '토코', brain.pet?.bones.species ?? 'cat'),
    '',
    '[펫 상태]',
    card(brain),
    `기분: ${brain.mood} · 욕구(0~100, 낮을수록 부족): 기운 ${Math.round(needs.energy)}, 재미 ${Math.round(needs.fun)}, 포만감 ${Math.round(needs.hunger)}, 교감 ${Math.round(needs.social)}`,
    focus === null || focus.endsAt <= brain.now ? '집중 타이머: 꺼짐' : `집중 타이머: ${Math.ceil((focus.endsAt - brain.now) / MINUTE)}분 남음`,
    questText(progressOf(brain).quests),
    todayText(todayTally(brain), brain.now, brain.memos.length),
    '',
    ...(brain.offer === null ? [] : ['[토코가 물어본 것]', `${brain.offer.line} — 대답하려면 answer <선택지>: ${brain.offer.choices.map(choice => `${choice.label}(${choice.key})`).join(' · ')}`, '']),
    '[명령]',
    HELP,
  ].join('\n')
}

const EGG_CHAT = '아직 알이에요. 깨어나면 이야기해요.'

async function chatBriefFor($: $, ctx: Ctx, words: string): Promise<string | null> {
  const brain = ctx.brain
  if (brain.pet?.soul === null || brain.pet?.soul === undefined) {
    return null
  }
  await refreshShared($, brain, true)
  ctx.chat = { text: words, turnId: null }
  return chatBrief(brain)
}

async function chatCommand($: $, ctx: Ctx, words: string): Promise<CommandRunResult> {
  const brief = await chatBriefFor($, ctx, words)
  if (brief === null) {
    return { text: EGG_CHAT }
  }
  $.clock.after(1, () => {
    void $.prompt.submit({ text: words, asUser: true }).catch(() => {
      ctx.chat = null
    })
  })
  return { context: [brief] }
}

export const chatStarted = (ctx: Ctx, text: string, turnId: string): void => {
  if (ctx.chat !== null && ctx.chat.turnId === null && text === ctx.chat.text) {
    ctx.chat = { ...ctx.chat, turnId }
  }
}

export async function chatAnswered($: $, ctx: Ctx, turnId: string, answer: string): Promise<void> {
  if (ctx.chat === null || ctx.chat.turnId !== turnId) {
    return
  }
  ctx.chat = null
  const line = bubbleLine(answer)
  if (line !== null) {
    await chatted($, ctx.brain, line)
  }
}

async function demoNews($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  const problem = await prepareNews($, ctx.brain, true)
  await now($, ctx)
  if (!(await showNews($, ctx.brain, true))) {
    await say($, ctx.brain, problem === '' ? '소개할 새 기능이 없어' : problem)
  }
  await sync($, ctx.brain)
}

export async function newsTry($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  return tryNews($, ctx.brain)
}

export async function todayCommand($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  await refreshShared($, brain, true)
  const summary = await todayWork($, brain)
  const copied = await $.ui.copy({ text: summary }).catch(() => ({ isCopied: false as const, reason: 'refused' as const }))
  return `${summary}\n\n${copied.isCopied ? '클립보드에 복사했어요.' : `클립보드에 복사하지 못했어요(${copied.reason}). 위 글을 그대로 쓰세요.`}`
}

export async function memoCommand($: $, ctx: Ctx, args: string): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  const text = args.trim()
  if (text.length === 0) {
    return memoText(brain.memos)
  }
  if (text === 'clear') {
    await forgetMemo($, brain, null)
    return '메모를 모두 지웠어요.'
  }
  await parkMemo($, brain, text)
  return `메모를 맡아 뒀어요(${brain.memos.length}개). 턴이 끝나면 꺼내 드릴게요.`
}

export async function memoFill($: $, ctx: Ctx, id: string): Promise<void> {
  await now($, ctx)
  await fillMemo($, ctx.brain, id)
}

export async function memoDrop($: $, ctx: Ctx, id: string): Promise<void> {
  await forgetMemo($, ctx.brain, id)
}

export async function focusCommand($: $, ctx: Ctx, value: string | undefined): Promise<string> {
  await now($, ctx)
  const brain = ctx.brain
  if (value === 'off' || value === 'stop') {
    if (brain.focus === null) {
      return '집중 중이 아니에요.'
    }
    await stopFocus($, brain)
    return '집중을 멈췄어요. 코인은 끝까지 했을 때만 받아요.'
  }
  if (value === undefined && brain.focus !== null) {
    return `집중 중이에요. ${Math.max(1, Math.ceil((brain.focus.endsAt - brain.now) / MINUTE))}분 남았어요. 멈추려면 /toko focus off`
  }
  const minutes = value === undefined ? FOCUS_MINUTES : Number(value)
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
    return '5~120 사이 분으로 알려 주세요. 예: /toko focus 25'
  }
  await startFocus($, brain, minutes)
  return `${minutes}분 동안 조용히 있을게요. 끝나면 쉬자고 할게요.`
}

export async function bonkCommand($: $, ctx: Ctx, args: string): Promise<{ text: string; context?: readonly string[] }> {
  await now($, ctx)
  const brain = ctx.brain
  const reason = args.trim()
  const wasRunning = brain.isTurnRunning
  await startBonk($, brain, reason)
  const name = nameOf(brain.pet) ?? '토코'
  if (!wasRunning) {
    return { text: `${name}(이)가 뿅망치를 들었어요. 삑!` }
  }
  const memoryAsk = await memoryAskOf(brain)
  return {
    text: `${name}(이)가 뿅망치를 들었어요. 삑!`,
    context: [
      `(사용자의 펫이 방금 장난스럽게 뿅망치로 너를 때렸다. 이유: ${reason || '없음'}. 이 턴의 답 첫머리에 "아야…"를 짧게 붙이고, 이유에 맞게 바로잡을 게 있으면 바로잡아 줘.${memoryAsk === '' ? '' : ` ${memoryAsk}`} 그리고 mcp__toko__apologize 도구를 한 번 불러 줘.)`,
    ],
  }
}

export async function feedCommand($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const text = await feed($, ctx.brain)
  await sync($, ctx.brain)
  return text
}

export async function playCommand($: $, ctx: Ctx): Promise<string> {
  await now($, ctx)
  const text = await play($, ctx.brain)
  await sync($, ctx.brain)
  return text
}

const sameWords = (a: string, b: string): boolean => a.replace(/[\s.!~?,]+/g, '') === b.replace(/[\s.!~?,]+/g, '')

async function answerCommand($: $, ctx: Ctx, words: string): Promise<string> {
  const offer = ctx.brain.offer
  if (offer === null) {
    return '지금 토코가 물어본 게 없어요.'
  }
  const choice = offer.choices.find(candidate => sameWords(candidate.key, words) || sameWords(candidate.label, words))
  if (choice === undefined) {
    return `대답은 이 중에서 골라요: ${offer.choices.map(candidate => `${candidate.label}(${candidate.key})`).join(' · ')}`
  }
  await choose($, ctx, choice)
  return `${choice.label}(으)로 대답했어요.`
}

export async function choose($: $, ctx: Ctx, choice: TokoChoice): Promise<void> {
  await now($, ctx)
  await answerOffer($, ctx.brain, choice.key)
  await sync($, ctx.brain)
}

export async function buyItem($: $, ctx: Ctx, id: string): Promise<void> {
  await now($, ctx)
  await purchase($, ctx.brain, id)
  await sync($, ctx.brain)
}

export async function gachaFromRoom($: $, ctx: Ctx, kind: GachaKind): Promise<void> {
  await now($, ctx)
  await pullFromGacha($, ctx.brain, kind)
  await sync($, ctx.brain)
}

export async function drawFromRoom($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await drawPet($, ctx.brain)
  await sync($, ctx.brain)
}

export async function pickPet($: $, ctx: Ctx, id: string): Promise<void> {
  await now($, ctx)
  await switchPet($, ctx.brain, id)
}

const VIEW_REFRESH_MS = 20_000

async function guestCommand($: $, ctx: Ctx, words: readonly string[]): Promise<string> {
  const brain = ctx.brain
  const [name = '', word] = words
  const guest = name.length === 0 ? undefined : (brain.guests.find(entry => entry.name === name) ?? brain.guests.find(entry => entry.name.startsWith(name)))
  if (guest === undefined) {
    return brain.guests.length === 0 ? '지금 방에 손님이 없어요.' : `손님: ${brain.guests.map(entry => entry.name).join(' · ')}`
  }
  if (word === 'bye') {
    const text = await sendGuestHome($, brain, guest.id)
    await sync($, brain)
    return text
  }
  if (word === undefined || !isRoomAct(word)) {
    return `할 수 있는 것: ${ROOM_ACTS.map(act => `${act}(${ROOM_ACT_LABEL[act]})`).join(' · ')} · bye(배웅)`
  }
  const text = await playInRoom($, brain, guest.id, word)
  await sync($, brain)
  return text
}

export async function visitFromRoom($: $, ctx: Ctx, friendId: string): Promise<void> {
  await now($, ctx)
  await visitFriend($, ctx.brain, friendId)
  await sync($, ctx.brain)
}

export async function comeHomeFromRoom($: $, ctx: Ctx): Promise<void> {
  await now($, ctx)
  await comeHome($, ctx.brain)
  await sync($, ctx.brain)
}

export async function guestPlay($: $, ctx: Ctx, guestId: string, kind: RoomAct): Promise<void> {
  await now($, ctx)
  await playInRoom($, ctx.brain, guestId, kind)
  await sync($, ctx.brain)
}

export async function stickerFromRoom($: $, ctx: Ctx, friendId: string): Promise<void> {
  await now($, ctx)
  await sendSticker($, ctx.brain, friendId, 'heart')
  await sync($, ctx.brain)
}

export async function guestBye($: $, ctx: Ctx, guestId: string): Promise<void> {
  await now($, ctx)
  await sendGuestHome($, ctx.brain, guestId)
  await sync($, ctx.brain)
}

export async function viewRoom($: $, ctx: Ctx, host: string | null): Promise<void> {
  await now($, ctx)
  await say($, ctx.brain, await viewFriendRoom($, ctx.brain, host))
  await sync($, ctx.brain)
}

export async function cycleRoomSlot($: $, ctx: Ctx, slot: RoomSlot): Promise<void> {
  await now($, ctx)
  await cycleRoom($, ctx.brain, slot)
  await sync($, ctx.brain)
}

export async function wearItem($: $, ctx: Ctx, id: string): Promise<void> {
  await toggleWear($, ctx.brain, id)
}

export async function plazaAct($: $, ctx: Ctx, action: PlazaAction, to: string | null): Promise<void> {
  await now($, ctx)
  await say($, ctx.brain, await sendPlaza($, ctx.brain, action, to))
}

export async function gameMove($: $, ctx: Ctx, delta: number): Promise<void> {
  await moveInGame($, ctx.brain, delta)
}

export async function gameCatch($: $, ctx: Ctx): Promise<void> {
  await catchInGame($, ctx.brain)
}

