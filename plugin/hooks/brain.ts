import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type {
  TokoAway,
  TokoBubblePart,
  TokoBoss,
  TokoBudget,
  TokoChoice,
  TokoCounts,
  TokoEarn,
  TokoEarning,
  TokoFocus,
  TokoGuest,
  TokoFriend,
  TokoVisitor,
  TokoGame,
  TokoMemo,
  TokoMemory,
  TokoMeter,
  TokoMood,
  TokoNeeds,
  TokoNews,
  TokoNewsPick,
  TokoOffer,
  TokoPet,
  TokoRoom,
  TokoProgress,
  TokoSettings,
  TokoSoul,
  TokoSpecies,
  TokoStats,
  TokoTally,
  TokoWallet,
} from '../types'


import { asUnlocked, badgeViews, newBadges } from './lib/badges'
import type { Unlocked } from './lib/badges'
import { DEX_REWARD, SHINY_CHANCE, asDex, dexViews, kindsSeen, mergeDex, recordSighting, sightingLine } from './lib/dex'
import type { Dex, Sighting } from './lib/dex'
import * as direct from './lib/director'
import { PRIORITY } from './lib/director'
import { BUG_REWARD, DYES, GACHA, HEALTH_REWARD, SEASONS, SPEND, balanceOf, buy, dyeOf, exchangeStars, capTokenIncome, earnBalance, earnedTokenToday, emptyEarn, isEmptyEarn, isInSeason, pullGacha, shopItem, takeSnack, turnIncome, wear, wornOf } from './lib/economy'
import type { GachaKind, ShopItem, TurnUsage } from './lib/economy'
import type { RoomSlot } from './lib/room'
import { SOUVENIRS, autoPlace, completedSets, cozinessOf, cycleSlot, isRoomItem, layoutOf, newSouvenirs, placeItem, slotLabel, storeItem, ROOM_SETS } from './lib/room'
import { OFFER_TIMEOUT_MS, canAnimateQuietly, canNotify, canSpeak, emptyBudget, gateCandidates, isGap, isQuietNow, learnAnswer, recordBubble, rollBudget } from './lib/gate'
import type { Answer } from './lib/gate'
import { addMemo, asMemos, clipMemo, deferMemo, dropMemo, dueMemo } from './lib/memo'
import { FEATURE_REWARD, asFeatureDex, featureDef, featureLine, featureViews, featuresUsed, mergeFeatureDex } from './lib/features'
import type { FeatureDex } from './lib/features'
import { BOSS_REWARD, BOSS_STREAK, bossStatus, meetBoss } from './lib/boss'
import { MEMORY_ASK, addBonk, asBonks, guessKind, isSimilarReason, kindPrompt, kindSystem, parseKind, parseRepeat, repeatPrompt, repeatSystem } from './lib/bonks'
import { meterOf } from './lib/meter'
import { CHECK_TIP_PROMPTS, CHECK_TIP_WINDOW_MS, COMPACT_TIP_PERCENT, KNOWN, PERMISSION_TIP_ASKS, TIPS, asTips, isTipWanted } from './lib/tips'
import type { Tips } from './lib/tips'
import { CHANGELOG_URL, EMPTY_NEWS, NEWS_LATER_MS, asNews, freshAdditions, isNewsDue, newsDetail, newsLine, newsPrompt, newsSystem, newsText, parseChangelog, parseNews, withPick } from './lib/news'
import type { Addition } from './lib/news'
import type { Limit } from './lib/meter'
import { addTurn, isWorked, workText } from './lib/today'
import type { WorkedSession } from './lib/today'
import { freshSignal, inboxParts, isAlive, isMessage, isSignal, lastAiTitle, leftAlone, matchPeers, missText, peerList, reminderParts, sendTarget, replyLines, sessionLine, sessionName, sessionsText, signalParts, transcriptExcerpt } from './lib/peers'
import type { Peer, PeerSignal } from './lib/peers'
import { failureStreak } from './lib/perceive'
import { RARITY_LABEL, SPECIES, SPECIES_IDS, advanceDay, clampName, createFallbackSoul, createPet, isAwaitingName, nameOf, nextStage, rarityOf, restoreLost, rollSpecies, upgradePet } from './lib/pet'
import * as persona from './lib/persona'
import { DAILY_AI_CALLS, OFFER_FALLBACK, RESERVED_AI_CALLS, REACTION_FALLBACK, fallbackLine } from './lib/persona'
import { FESTIVAL_LINE, FRIEND_TTL_MS, NO_BONKS, PLAZA_POLL_MS, ROOM_ACT_LABEL, STREAM_RETRY_MAX_MS, STREAM_STEADY_MS, eventText, isForMe, lookSprite, parseChannelReply, parseRoom, parseSnapshot, plazaEndpoint, plazaStreamUrl, roomPicture, shouldDismissVisitor, splitEvents, visitorOf, wireColor } from './lib/plaza'
import type { PlazaAction, PlazaBonks, PlazaChannel, PlazaChannelInfo, PlazaEvent, PlazaHome, PlazaSnapshot, PlazaStatus, PlazaWeather, RoomAct } from './lib/plaza'
import type { Random } from './lib/random'
import { createRandom, hashText, pick, pickWeighted } from './lib/random'
import type { Look, RoomView, Scene, Step } from './lib/scene'
import { PET_WIDTH, createScene, isBusy, perform, placeProp, removeProp, setLook, visitTiming } from './lib/scene'
import { mergeShared, same } from './lib/shared'
import type { Candidate, EncounterKind, OfferKind } from './lib/sim'
import { ALL_DONE, QUEST_BONUS, QUEST_REWARD, asPaid, questViews, questsDue, questsFor } from './lib/quests'
import type { QuestsPaid } from './lib/quests'
import { BREAK_KINDS, ENCOUNTER_LINES, HALLOWEEN_LINES, NEED_KEYS, candidatesOf, clampNeeds, decayNeeds, encounterOf, fullNeeds, idleWeights, moodOf, restore } from './lib/sim'
import { addNote, asStats, asTally, bump, emptyStats, emptyTally, foldTally, todayOf, totalOf } from './lib/stats'
import type { StatKey } from './lib/stats'
import { HOUR, MINUTE, clockText, dayKey, hourOf } from './lib/time'

const petAtom = atom({ plugin: 'toko', key: 'pet' } as const, null)
const shelfAtom = atom({ plugin: 'toko', key: 'shelf' } as const, [])
const needsAtom = atom({ plugin: 'toko', key: 'needs' } as const, null)
const moodAtom = atom({ plugin: 'toko', key: 'mood' } as const, 'calm')
const walletAtom = atom({ plugin: 'toko', key: 'wallet' } as const, null)
const settingsAtom = atom({ plugin: 'toko', key: 'settings' } as const, null)
const bubbleAtom = atom({ plugin: 'toko', key: 'bubble' } as const, null)
const offerAtom = atom({ plugin: 'toko', key: 'offer' } as const, null)
const ouchAtom = atom({ plugin: 'toko', key: 'ouch' } as const, false)
const earningsAtom = atom({ plugin: 'toko', key: 'earnings' } as const, [])
const gameAtom = atom({ plugin: 'toko', key: 'game' } as const, null)
const countdownAtom = atom({ plugin: 'toko', key: 'countdown' } as const, null)
const focusAtom = atom({ plugin: 'toko', key: 'focus' } as const, null)
const meterAtom = atom({ plugin: 'toko', key: 'meter' } as const, null)
const memosAtom = atom({ plugin: 'toko', key: 'memos' } as const, [])
const plazaAtom = atom({ plugin: 'toko', key: 'plaza' } as const, null)
const lessonsAtom = atom({ plugin: 'toko', key: 'lessons' } as const, [])
const progressAtom = atom({ plugin: 'toko', key: 'progress' } as const, null)
const visitorAtom = atom({ plugin: 'toko', key: 'visitor' } as const, null)
const newsAtom = atom({ plugin: 'toko', key: 'news' } as const, null)
const bossAtom = atom({ plugin: 'toko', key: 'boss' } as const, null)

type $ = EngineInterface

export const KEY = {
  pet: 'toko:pet',
  shelf: 'toko:shelf',
  needs: 'toko:needs',
  memory: 'toko:memory',
  wallet: 'toko:wallet',
  budget: 'toko:budget',
  settings: 'toko:settings',
  plazaId: 'toko:plaza-id',
  marks: 'toko:marks',
  earnPrefix: 'toko:earn:',
  signalPrefix: 'toko:signal:',
  inboxPrefix: 'toko:inbox:',
  replyPrefix: 'toko:reply:',
  remindedPrefix: 'toko:reminded:',
  workedPrefix: 'toko:worked:',
  stats: 'toko:stats',
  tallyPrefix: 'toko:tally:',
  badges: 'toko:badges',
  quests: 'toko:quests',
  dex: 'toko:dex',
  memos: 'toko:memos',
  news: 'toko:news',
  features: 'toko:features',
  tips: 'toko:tips',
  guestbook: 'toko:guestbook',
  bonks: 'toko:bonks',
} as const

export const SHARED_REFRESH_MS = 60_000
export const HEARTBEAT_MS = 60_000

export const DEFAULT_SETTINGS: TokoSettings = {
  isMuted: false,
  isHidden: false,
  quiet: null,
  breakMinutes: 50,
  offWorkHour: null,
  isAiOn: true,
  aiDailyCalls: DAILY_AI_CALLS,
  isNotifyOn: false,
  isMoodSensing: false,
  isPlazaOn: true,
  isPeersOn: true,
  isMeterOn: true,
  isRoomOpen: true,
  doing: 'off',
}

const emptyMemory = (): TokoMemory => ({
  events: [],
  lessons: [],
  answersByHour: Array.from({ length: 24 }, () => ({ accepted: 0, declined: 0 })),
  declineStreak: {},
  kindScale: {},
  reflectedDay: '',
})

type Marks = { wrappedDay: string; calmedDay: string; firstCommitDay: string; lastEyeRestAt: number; lastWaterAt: number; lastChatAt: number }

const EMPTY_MARKS: Marks = { wrappedDay: '', calmedDay: '', firstCommitDay: '', lastEyeRestAt: 0, lastWaterAt: 0, lastChatAt: 0 }

const EMPTY_WALLET: TokoWallet = { coins: 0, items: [], worn: [] }

type Countdown = { kind: string; label: string; endsAt: number; reward: number; then: 'praise' | 'unstick' | 'quiet' }

export type RoomActShown = { guest: string; act: RoomAct; at: number }

export type FriendRoom = { host: string; name: string; look: Look; layout: TokoRoom; guests: readonly TokoGuest[]; stickers: readonly string[]; fetchedAt: number }

type Bonk = { reason: string; isTurnRunning: boolean; hasApology: boolean; isSubmitted: boolean; isDone: boolean }

export type Brain = {
  random: Random
  now: number
  pet: TokoPet | null
  shelf: readonly TokoPet[]
  needs: TokoNeeds
  memory: TokoMemory
  wallet: TokoWallet
  settings: TokoSettings
  budget: TokoBudget
  marks: Marks
  sessionId: string
  earn: TokoEarn
  otherEarns: readonly TokoEarn[]
  tally: TokoTally
  otherTallies: readonly TokoTally[]
  stats: TokoStats
  isProgressDirty: boolean
  lastSharedAt: number
  badges: Unlocked
  questsPaid: QuestsPaid
  dex: Dex
  features: FeatureDex
  tips: Tips
  tipQueue: readonly string[]
  tipOfferId: string | null
  permissionAsks: Readonly<Record<string, number>>
  checkPrompts: readonly number[]
  memos: readonly TokoMemo[]
  memoOfferId: string | null
  news: TokoNews
  version: string
  isFetchingNews: boolean
  mood: TokoMood
  isLoaded: boolean
  isTurnRunning: boolean
  turnStartedAt: number
  typedDuringTurn: boolean
  longTurnStage: number
  lastTypingAt: number
  lastInputAt: number
  lastTurnEndAt: number
  workingSince: number
  returnedAway: { minutes: number; at: number } | null
  lastEncounterAt: number
  lastPassAfterFailAt: number | null
  rateLimitPercent: number
  meter: TokoMeter | null
  costBase: number
  lastCostUsd: number
  isFullShown: boolean
  isThinking: boolean
  isHatching: boolean
  offer: TokoOffer | null
  countdown: Countdown | null
  focus: TokoFocus | null
  focusDoneMinutes: number | null
  bonk: Bonk | null
  bonkRepeat: Promise<boolean> | null
  boss: TokoBoss | null
  game: TokoGame | null
  gameSpawnAt: number
  earnings: readonly TokoEarning[]
  scene: Scene | null
  isReducedMotion: boolean
  isLineMode: boolean
  serverUrl: string
  plazaId: string
  plazaTab: string
  friends: readonly TokoFriend[]
  plazaBonks: PlazaBonks
  plazaWeather: PlazaWeather | null
  plazaChannel: number | null
  plazaChannels: readonly PlazaChannel[]
  plazaChannelSize: number | null
  joiningChannel: number | null
  feed: readonly { at: number; text: string }[]
  lastPollAt: number
  plazaStream: 'off' | 'connecting' | 'live' | 'unsupported'
  lastPlazaReport: string
  seenEvents: readonly string[]
  promptLabel: string
  sessionTitle: string
  transcriptPath: string
  signal: PeerSignal | null
  peersSeenAt: number
  peerTurn: { text: string; to: string } | null
  replyTo: string | null
  turnText: string
  worked: WorkedSession | null
  visitor: TokoVisitor | null
  visitorVisibleMs: number
  waitBuddyAt: number
  roomPlaced: { slot: string; at: number } | null
  guests: readonly TokoGuest[]
  away: TokoAway | null
  roomActs: readonly RoomActShown[]
  viewing: FriendRoom | null
  stickers: readonly string[]
  roomCare: { kind: 'eat' | 'play'; at: number } | null
  doing: string | null
  takenGifts: readonly string[]
  isDirty: boolean
  synced: Partial<Record<SharedField, unknown>>
}

export const createBrain = (seed: number, serverUrl: string): Brain => ({
  random: createRandom(seed),
  now: 0,
  pet: null,
  shelf: [],
  needs: fullNeeds(0),
  memory: emptyMemory(),
  wallet: EMPTY_WALLET,
  settings: DEFAULT_SETTINGS,
  budget: emptyBudget(''),
  marks: EMPTY_MARKS,
  sessionId: 'local',
  earn: emptyEarn(''),
  otherEarns: [],
  tally: emptyTally(''),
  otherTallies: [],
  stats: emptyStats(),
  isProgressDirty: false,
  lastSharedAt: 0,
  badges: {},
  questsPaid: { day: '', ids: [] },
  dex: {},
  features: {},
  tips: {},
  tipQueue: [],
  tipOfferId: null,
  permissionAsks: {},
  checkPrompts: [],
  memos: [],
  memoOfferId: null,
  news: EMPTY_NEWS,
  version: '',
  isFetchingNews: false,
  mood: 'calm',
  isLoaded: false,
  isTurnRunning: false,
  turnStartedAt: 0,
  typedDuringTurn: false,
  longTurnStage: 0,
  lastTypingAt: 0,
  lastInputAt: 0,
  lastTurnEndAt: 0,
  workingSince: 0,
  returnedAway: null,
  lastEncounterAt: 0,
  lastPassAfterFailAt: null,
  rateLimitPercent: 0,
  meter: null,
  costBase: 0,
  lastCostUsd: 0,
  isFullShown: false,
  isThinking: false,
  isHatching: false,
  offer: null,
  countdown: null,
  focus: null,
  focusDoneMinutes: null,
  bonk: null,
  bonkRepeat: null,
  boss: null,
  game: null,
  gameSpawnAt: 0,
  earnings: [],
  scene: null,
  isReducedMotion: false,
  isLineMode: false,
  serverUrl,
  plazaId: '',
  plazaTab: '',
  friends: [],
  plazaBonks: NO_BONKS,
  plazaWeather: null,
  plazaChannel: null,
  plazaChannels: [],
  plazaChannelSize: null,
  joiningChannel: null,
  feed: [],
  lastPollAt: 0,
  plazaStream: 'off',
  lastPlazaReport: '',
  seenEvents: [],
  promptLabel: '',
  sessionTitle: '',
  transcriptPath: '',
  signal: null,
  peersSeenAt: 0,
  peerTurn: null,
  replyTo: null,
  turnText: '',
  worked: null,
  visitor: null,
  visitorVisibleMs: 0,
  waitBuddyAt: 0,
  roomPlaced: null,
  guests: [],
  away: null,
  roomActs: [],
  viewing: null,
  stickers: [],
  roomCare: null,
  doing: null,
  takenGifts: [],
  isDirty: false,
  synced: {},
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const merge = <T extends object>(base: T, stored: unknown): T => (isRecord(stored) ? { ...base, ...(stored as Partial<T>) } : base)

const isPet = (value: unknown): value is TokoPet => isRecord(value) && isRecord(value.bones) && isRecord(value.growth)

const isEarn = (value: unknown): value is TokoEarn => isRecord(value) && typeof value.day === 'string' && typeof value.earned === 'number'

export const today = (brain: Brain): string => dayKey(brain.now)

type SharedField = 'pet' | 'shelf' | 'needs' | 'memory' | 'wallet' | 'budget' | 'settings' | 'marks' | 'plazaId'

const newPlazaId = (brain: Brain): string => `p${Math.floor(brain.random() * 2 ** 32).toString(36)}${Math.floor(brain.now % 1e6).toString(36)}`

const SHARED: { readonly [K in SharedField]: (stored: unknown, brain: Brain) => Brain[K] } = {
  pet: (stored, brain) => (isPet(stored) ? upgradePet({ ...stored, growth: advanceDay(stored.growth, today(brain)) }) : null),
  shelf: stored => (Array.isArray(stored) ? stored.filter(isPet).map(upgradePet) : []),
  needs: (stored, brain) => clampNeeds(merge(fullNeeds(brain.now), stored)),
  memory: stored => merge(emptyMemory(), stored),
  wallet: stored => merge(EMPTY_WALLET, stored),
  budget: (stored, brain) => rollBudget(isRecord(stored) ? merge(emptyBudget(today(brain)), stored) : null, today(brain)),
  settings: stored => merge(DEFAULT_SETTINGS, stored),
  marks: stored => merge(EMPTY_MARKS, stored),
  plazaId: (stored, brain) => (typeof stored === 'string' && stored.length > 0 ? stored : newPlazaId(brain)),
}

const SHARED_FIELDS = Object.keys(SHARED) as readonly SharedField[]

export async function load($: $, brain: Brain): Promise<void> {
  const now = brain.now
  const day = dayKey(now)
  const [pet, shelf, needs, memory, wallet, budget, settings, marks, plazaId, stats, badges, questsPaid, dex, memos, news, features, tips, keys] = await Promise.all([
    $.store.get(KEY.pet),
    $.store.get(KEY.shelf),
    $.store.get(KEY.needs),
    $.store.get(KEY.memory),
    $.store.get(KEY.wallet),
    $.store.get(KEY.budget),
    $.store.get(KEY.settings),
    $.store.get(KEY.marks),
    $.store.get(KEY.plazaId),
    $.store.get(KEY.stats),
    $.store.get(KEY.badges),
    $.store.get(KEY.quests),
    $.store.get(KEY.dex),
    $.store.get(KEY.memos),
    $.store.get(KEY.news),
    $.store.get(KEY.features),
    $.store.get(KEY.tips),
    $.store.keys(),
  ])
  brain.pet = SHARED.pet(pet, brain)
  brain.shelf = SHARED.shelf(shelf, brain)
  brain.needs = SHARED.needs(needs, brain)
  brain.memory = SHARED.memory(memory, brain)
  brain.wallet = SHARED.wallet(wallet, brain)
  brain.settings = SHARED.settings(settings, brain)
  brain.marks = SHARED.marks(marks, brain)
  brain.budget = SHARED.budget(budget, brain)
  brain.plazaId = SHARED.plazaId(plazaId, brain)
  brain.plazaTab = Math.floor(brain.random() * 2 ** 32).toString(36)
  brain.synced = { pet: brain.pet, shelf: brain.shelf, needs: brain.needs, memory: brain.memory, wallet: brain.wallet, budget: brain.budget, settings: brain.settings, marks: brain.marks, plazaId }
  const earnKeys = keys.filter(key => key.startsWith(KEY.earnPrefix))
  const earns = await Promise.all(earnKeys.map(async key => ({ key, value: await $.store.get(key) })))
  await settleEarnings($, brain, earns, day)
  await dropStaleSignals($, keys.filter(key => key.startsWith(KEY.signalPrefix)), now)
  await dropStaleReminders($)
  await dropStaleWorked($, keys.filter(key => key.startsWith(KEY.workedPrefix)), day)
  brain.peersSeenAt = now
  brain.earn = emptyEarn(day)
  const tallyKeys = keys.filter(key => key.startsWith(KEY.tallyPrefix))
  const tallies = await Promise.all(tallyKeys.map(async key => ({ key, value: await $.store.get(key) })))
  await settleTallies($, brain, stats, tallies, day)
  brain.tally = emptyTally(day)
  brain.lastSharedAt = now
  brain.badges = asUnlocked(badges)
  brain.questsPaid = asPaid(questsPaid, day)
  brain.dex = asDex(dex)
  brain.memos = asMemos(memos)
  brain.news = asNews(news)
  brain.features = asFeatureDex(features)
  brain.tips = asTips(tips)
  brain.isProgressDirty = true
  brain.workingSince = now
  brain.lastInputAt = now
  brain.mood = moodOf(brain.needs, brain.memory.events, now, hourOf(now), brain.budget.bonks)
  brain.isLoaded = true
}

async function settleEarnings($: $, brain: Brain, earns: readonly { key: string; value: unknown }[], day: string): Promise<void> {
  const stale = earns.filter(entry => !isEarn(entry.value) || entry.value.day !== day || entry.key === `${KEY.earnPrefix}${brain.sessionId}`)
  const settled = stale.map(entry => entry.value).filter(isEarn)
  brain.wallet = { ...brain.wallet, coins: brain.wallet.coins + settled.reduce((sum, earn) => sum + earn.earned + earn.health - earn.spent, 0) }
  brain.otherEarns = earns.filter(entry => !stale.includes(entry)).map(entry => entry.value).filter(isEarn)
  for (const entry of stale) {
    await $.store.delete(entry.key)
  }
  if (stale.length > 0) {
    await syncField($, brain, 'wallet')
  }
}

async function dropStaleSignals($: $, keys: readonly string[], now: number): Promise<void> {
  for (const key of keys) {
    const value = await $.store.get(key)
    if (!isSignal(value) || !isAlive(value, now)) {
      await $.store.delete(key)
    }
  }
}

async function dropStaleReminders($: $): Promise<void> {
  const keys = await $.store.keys()
  const live = new Set(keys.filter(key => key.startsWith(KEY.signalPrefix)).map(key => key.slice(KEY.signalPrefix.length)))
  await Promise.all(keys.filter(key => key.startsWith(KEY.remindedPrefix) && !live.has(key.slice(KEY.remindedPrefix.length))).map(key => $.store.delete(key)))
}

async function dropStaleWorked($: $, keys: readonly string[], day: string): Promise<void> {
  for (const key of keys) {
    const value = await $.store.get(key)
    if (!isWorked(value) || value.day !== day) {
      await $.store.delete(key)
    }
  }
}

const tallyKey = (brain: Brain): string => `${KEY.tallyPrefix}${brain.sessionId}`

async function settleTallies($: $, brain: Brain, stored: unknown, entries: readonly { key: string; value: unknown }[], day: string): Promise<void> {
  const parsed = entries.map(entry => ({ key: entry.key, tally: asTally(entry.value) }))
  const stale = parsed.filter(entry => entry.tally === null || entry.tally.day !== day || entry.key === tallyKey(brain))
  brain.stats = stale.reduce((stats, entry) => (entry.tally === null ? stats : foldTally(stats, entry.tally)), asStats(stored))
  brain.otherTallies = parsed.filter(entry => !stale.includes(entry)).flatMap(entry => (entry.tally === null ? [] : [entry.tally]))
  for (const entry of stale) {
    await $.store.delete(entry.key)
  }
  if (stale.length > 0) {
    await $.store.set(KEY.stats, brain.stats)
  }
}

async function rollTally($: $, brain: Brain, day: string): Promise<void> {
  const stored = asTally(await $.store.get(tallyKey(brain)))
  if (stored !== null && stored.day === brain.tally.day) {
    brain.stats = foldTally(asStats(await $.store.get(KEY.stats)), brain.tally)
    await $.store.set(KEY.stats, brain.stats)
  }
  brain.tally = emptyTally(day)
  brain.otherTallies = []
  brain.costBase = brain.lastCostUsd
  await $.store.set(tallyKey(brain), brain.tally)
}

export async function refreshShared($: $, brain: Brain, isForced = false): Promise<void> {
  if (!isForced && brain.now - brain.lastSharedAt < SHARED_REFRESH_MS) {
    return
  }
  brain.lastSharedAt = brain.now
  const keys = (await $.store.keys()).filter(key => key.startsWith(KEY.tallyPrefix) && key !== tallyKey(brain))
  const tallies = await Promise.all(keys.map(async key => asTally(await $.store.get(key))))
  brain.otherTallies = tallies.flatMap(tally => (tally !== null && tally.day === today(brain) ? [tally] : []))
  brain.badges = { ...asUnlocked(await $.store.get(KEY.badges)), ...brain.badges }
  brain.dex = mergeDex(asDex(await $.store.get(KEY.dex)), brain.dex)
  brain.features = mergeFeatureDex(asFeatureDex(await $.store.get(KEY.features)), brain.features)
  brain.tips = { ...brain.tips, ...asTips(await $.store.get(KEY.tips)) }
  brain.memos = asMemos(await $.store.get(KEY.memos))
  await update($, memosAtom, () => brain.memos)
  brain.news = asNews(await $.store.get(KEY.news))
  await update($, newsAtom, () => brain.news)
  const paid = asPaid(await $.store.get(KEY.quests), today(brain)).ids
  brain.questsPaid = { day: today(brain), ids: [...new Set([...paid, ...(brain.questsPaid.day === today(brain) ? brain.questsPaid.ids : [])])] }
  brain.isProgressDirty = true
}

export const count = (brain: Brain, key: StatKey, amount = 1): void => {
  brain.tally = bump(brain.tally, key, amount)
  brain.isDirty = true
  brain.isProgressDirty = true
}

const jot = (brain: Brain, text: string): void => {
  brain.tally = addNote(brain.tally, text)
  brain.isDirty = true
}

export const progressCounts = (brain: Brain): TokoCounts => ({ ...totalOf(brain.stats, [...brain.otherTallies, brain.tally]), dex: kindsSeen(brain.dex), features: featuresUsed(brain.features) })

export const todayTally = (brain: Brain): TokoTally => todayOf(brain.stats, [...brain.otherTallies, brain.tally], today(brain))

export const questsOf = (brain: Brain) => questsFor(today(brain), brain.pet?.bones.seed ?? 0, isPlazaReady(brain))

export const progressOf = (brain: Brain): TokoProgress => ({
  badges: badgeViews(progressCounts(brain), brain.badges),
  quests: questViews(questsOf(brain), todayTally(brain).counts),
  dex: dexViews(brain.dex),
  features: featureViews(brain.features),
})

async function awardQuests($: $, brain: Brain): Promise<readonly string[]> {
  const day = today(brain)
  const views = progressOf(brain).quests
  const paid = brain.questsPaid.day === day ? brain.questsPaid.ids : []
  if (questsDue(views, paid).length === 0) {
    return []
  }
  const stored = asPaid(await $.store.get(KEY.quests), day).ids
  const known = [...new Set([...stored, ...paid])]
  const fresh = questsDue(views, known)
  brain.questsPaid = { day, ids: [...known, ...fresh] }
  await $.store.set(KEY.quests, brain.questsPaid)
  const done = views.filter(view => fresh.includes(view.id))
  const isAllDone = fresh.includes(ALL_DONE)
  if (done.length === 0 && !isAllDone) {
    return []
  }
  healthReward(brain, done.length * QUEST_REWARD + (isAllDone ? QUEST_BONUS : 0))
  remember(brain, 'quest', done.map(view => view.id).join(', '), 1)
  const phrases = done.length === 0 ? [] : [`퀘스트 완료: ${done.map(view => view.label).join(', ')} +${done.length * QUEST_REWARD} 코인`]
  if (!isAllDone) {
    return phrases
  }
  count(brain, 'quest-day')
  const gift = grantGift(brain)
  act(brain, direct.giftOpen(), PRIORITY.event)
  return [...phrases, `오늘 퀘스트 다 했어! +${QUEST_BONUS} 코인, 선물로 ${shopItem(gift)?.name ?? gift}`]
}

async function awardBadges($: $, brain: Brain): Promise<readonly string[]> {
  const earned = newBadges(progressCounts(brain), brain.badges)
  if (earned.length === 0) {
    return []
  }
  const stored = asUnlocked(await $.store.get(KEY.badges))
  const fresh = earned.filter(badge => stored[badge.id] === undefined)
  brain.badges = { ...stored, ...brain.badges, ...Object.fromEntries(fresh.map(badge => [badge.id, brain.now])) }
  await $.store.set(KEY.badges, brain.badges)
  if (fresh.length === 0) {
    return []
  }
  const reward = fresh.reduce((sum, badge) => sum + badge.reward, 0)
  const names = fresh.map(badge => badge.name).join(', ')
  healthReward(brain, reward)
  remember(brain, 'badge', names, 2)
  return [`업적 달성: ${names}! +${reward} 코인`]
}

export const roomViewOf = (brain: Brain): RoomView => {
  const viewing = brain.viewing
  const guests = viewing === null ? brain.guests : viewing.guests
  return {
    layout: viewing === null ? layoutOf(brain.wallet) : viewing.layout,
    placed: viewing === null ? brain.roomPlaced : null,
    hour: hourOf(brain.now),
    guests: guests.map(guest => ({ id: guest.id, look: guestLook(guest) })),
    acts: brain.roomActs,
    owner: viewing === null ? null : viewing.look,
    stickers: viewing === null ? brain.stickers : viewing.stickers,
    trophies: viewing === null ? Object.keys(brain.badges).length : 0,
    care: viewing === null ? brain.roomCare : null,
  }
}

const showPlaced = (brain: Brain, slot: RoomSlot): void => {
  brain.roomPlaced = { slot, at: brain.scene?.clock ?? 0 }
}

const settleInRoom = (brain: Brain, id: string): boolean => {
  const placed = autoPlace(brain.wallet, id)
  if ('reason' in placed) {
    return false
  }
  brain.wallet = placed.wallet
  showPlaced(brain, placed.slot)
  return true
}

const grantSouvenir = (brain: Brain, item: ShopItem): string => {
  brain.wallet = { ...brain.wallet, items: [...brain.wallet.items, item.id] }
  const isPlaced = settleInRoom(brain, item.id)
  remember(brain, 'souvenir', item.id, 2)
  return `쉰 만큼 쌓여서 기념품 ${item.name}이(가) 생겼어! ${isPlaced ? '방에 놓아 뒀어' : '창고에 넣어 뒀어'}`
}

const awardSouvenirs = (brain: Brain): readonly string[] => {
  const phrases: string[] = []
  for (const item of newSouvenirs({ ...progressCounts(brain), badges: Object.keys(brain.badges).length }, brain.wallet)) {
    phrases.push(grantSouvenir(brain, item))
  }
  return phrases
}

export async function demoSouvenir($: $, brain: Brain): Promise<string> {
  const item = SOUVENIRS.find(souvenir => !brain.wallet.items.includes(souvenir.id))
  if (item === undefined) {
    return '기념품을 다 모았어요.'
  }
  const phrase = grantSouvenir(brain, item)
  await announce($, brain, [phrase])
  await save($, brain)
  return `${item.name} 기념품을 받았어요.`
}

export async function demoCoins($: $, brain: Brain, amount: number): Promise<string> {
  brain.wallet = { ...brain.wallet, coins: brain.wallet.coins + amount }
  await save($, brain)
  return `${amount}코인을 받았어요. 지금 ${balance(brain)}코인이에요.`
}

async function announce($: $, brain: Brain, phrases: readonly string[]): Promise<void> {
  if (phrases.length === 0) {
    return
  }
  act(brain, direct.celebrate(), PRIORITY.reaction)
  if (!isHushed(brain)) {
    await say($, brain, phrases.join(' · '), 'quiet')
  }
}

export async function checkProgress($: $, brain: Brain): Promise<void> {
  if (!brain.isProgressDirty) {
    return
  }
  brain.isProgressDirty = false
  const phrases = [...(await awardQuests($, brain)), ...(await awardBadges($, brain)), ...awardSouvenirs(brain)]
  await update($, progressAtom, () => progressOf(brain))
  await announce($, brain, phrases)
}

async function syncField<K extends SharedField>($: $, brain: Brain, field: K): Promise<void> {
  const stored = await $.store.get(KEY[field])
  const merged = SHARED[field](mergeShared(brain.synced[field], brain[field], stored, field === 'wallet' ? ['coins'] : [], field === 'needs' ? NEED_KEYS : []), brain)
  brain[field] = merged
  brain.synced[field] = merged
  if (!same(merged, stored)) {
    await $.store.set(KEY[field], merged)
  }
}

const ownedPets = (brain: Brain): TokoPet[] => [...(brain.pet === null ? [] : [brain.pet]), ...brain.shelf]

async function keepOwnedPets($: $, brain: Brain, owned: readonly TokoPet[]): Promise<void> {
  const shelf = restoreLost(owned, brain.pet, brain.shelf)
  if (shelf.length === brain.shelf.length) {
    return
  }
  brain.shelf = shelf
  brain.synced.shelf = shelf
  await $.store.set(KEY.shelf, shelf)
}

async function syncEarns($: $, brain: Brain): Promise<void> {
  const own = `${KEY.earnPrefix}${brain.sessionId}`
  const keys = (await $.store.keys()).filter(key => key.startsWith(KEY.earnPrefix) && key !== own)
  brain.otherEarns = (await Promise.all(keys.map(key => $.store.get(key)))).filter(isEarn)
}

export async function syncShared($: $, brain: Brain): Promise<void> {
  if (!brain.isLoaded) {
    return
  }
  const owned = ownedPets(brain)
  for (const field of SHARED_FIELDS) {
    await syncField($, brain, field)
  }
  await keepOwnedPets($, brain, owned)
  await syncEarns($, brain)
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
}

export async function save($: $, brain: Brain): Promise<void> {
  if (!brain.isLoaded) {
    return
  }
  await syncShared($, brain)
  const own = `${KEY.earnPrefix}${brain.sessionId}`
  await Promise.all([isEmptyEarn(brain.earn) ? $.store.delete(own) : $.store.set(own, brain.earn), $.store.set(tallyKey(brain), brain.tally)])
  brain.isDirty = false
}

export const balance = (brain: Brain): number => balanceOf(brain.wallet, [...brain.otherEarns, brain.earn])

export async function sync($: $, brain: Brain): Promise<void> {
  await Promise.all([
    update($, petAtom, () => brain.pet),
    update($, shelfAtom, () => brain.shelf),
    update($, needsAtom, () => brain.needs),
    update($, moodAtom, () => brain.mood),
    update($, walletAtom, () => ({ ...brain.wallet, coins: balance(brain) })),
    update($, settingsAtom, () => brain.settings),
    update($, offerAtom, () => brain.offer),
    update($, earningsAtom, () => brain.earnings),
    update($, gameAtom, () => brain.game),
    update($, countdownAtom, () => (brain.countdown === null ? null : { label: brain.countdown.label, endsAt: brain.countdown.endsAt })),
    update($, plazaAtom, () => plazaViewOf(brain, brain.serverUrl.length > 0 && brain.settings.isPlazaOn)),
    update($, lessonsAtom, () => brain.memory.lessons),
    update($, progressAtom, () => progressOf(brain)),
    update($, focusAtom, () => brain.focus),
    update($, meterAtom, () => brain.meter),
    update($, memosAtom, () => brain.memos),
    update($, newsAtom, () => brain.news),
    update($, bossAtom, () => brain.boss),
  ])
}

export const remember = (brain: Brain, kind: string, detail = '', weight = 1): void => {
  brain.memory = { ...brain.memory, events: [...brain.memory.events, { at: brain.now, kind, detail: detail.slice(0, 140), weight }].slice(-50) }
  brain.isDirty = true
}

export async function say($: $, brain: Brain, text: string, tone: 'say' | 'think' | 'quiet' = 'say', parts?: readonly TokoBubblePart[]): Promise<void> {
  await update($, bubbleAtom, () => ({ text, at: brain.now, tone, ...(parts === undefined ? {} : { parts }) }))
  $.clock.after(5500, () => {
    void update($, bubbleAtom, current => (current !== null && current.text === text ? null : current))
  })
}

export async function hush($: $): Promise<void> {
  await update($, bubbleAtom, () => null)
}

export const lookOf = (brain: Brain): Look => ({
  bones: brain.pet?.bones ?? { seed: 0, species: 'cat' },
  stage: brain.pet?.growth.stage ?? 'egg',
  mood: brain.mood,
  hat: wornOf(brain.wallet, 'hat'),
  neck: wornOf(brain.wallet, 'neck'),
  face: wornOf(brain.wallet, 'face'),
  back: wornOf(brain.wallet, 'back'),
  hand: wornOf(brain.wallet, 'hand'),
  dyes: brain.wallet.dyes,
  hammer: wornOf(brain.wallet, 'hammer') ?? 'toy',
  critter: wornOf(brain.wallet, 'pet'),
})

export const ensureScene = (brain: Brain, width: number): Scene => {
  if (brain.scene === null) {
    brain.scene = createScene(width, lookOf(brain), scene => direct.idlePlan(scene, brain.random, idleWeights(brain.needs, brain.pet?.soul?.traits ?? { energetic: 0.5, chatty: 0.5, worried: 0.5, playful: 0.5 }, brain.mood)))
  }
  setLook(brain.scene, lookOf(brain))
  return brain.scene
}

const act = (brain: Brain, steps: readonly Step[], priority: number): void => {
  if (brain.scene !== null && !brain.isReducedMotion) {
    perform(brain.scene, steps, priority)
  }
}

export const isFocusing = (brain: Brain): boolean => brain.focus !== null && brain.now < brain.focus.endsAt

const isHushed = (brain: Brain): boolean => isQuietNow(brain.settings, hourOf(brain.now)) || isFocusing(brain)

export const canTalk = (brain: Brain): boolean =>
  canSpeak(presenceOf(brain), brain.settings, hourOf(brain.now)) && brain.budget.bubbles.filter(at => brain.now - at < HOUR).length < 4 && !isFocusing(brain)

const speciesOf = (brain: Brain): TokoSpecies => brain.pet?.bones.species ?? 'cat'

const presenceOf = (brain: Brain) => ({
  now: brain.now,
  isTurnRunning: brain.isTurnRunning,
  lastTypingAt: brain.lastTypingAt,
  lastInputAt: brain.lastInputAt,
  lastTurnEndAt: brain.lastTurnEndAt,
})

async function askWithin($: $, brain: Brain, limit: number, prompt: string, maxTokens: number, timeoutMs = 4000, system?: string): Promise<string | null> {
  if (!brain.settings.isAiOn || brain.budget.aiCalls >= limit || brain.pet?.soul === null || brain.pet === null) {
    return null
  }
  brain.budget = { ...brain.budget, aiCalls: brain.budget.aiCalls + 1 }
  brain.isDirty = true
  try {
    const reply = await $.model.complete({ model: 'haiku', prompt, system: system ?? persona.soulSystem(brain.pet.soul, brain.pet.bones.species), maxTokens, effort: 'low', timeoutMs })
    return reply.isAnswered ? reply.text : null
  } catch {
    return null
  }
}

async function ask($: $, brain: Brain, prompt: string, maxTokens: number, timeoutMs?: number, system?: string): Promise<string | null> {
  return askWithin($, brain, brain.settings.aiDailyCalls - RESERVED_AI_CALLS, prompt, maxTokens, timeoutMs, system)
}

async function askForUser($: $, brain: Brain, prompt: string, maxTokens: number, timeoutMs?: number, system?: string): Promise<string | null> {
  return askWithin($, brain, brain.settings.aiDailyCalls, prompt, maxTokens, timeoutMs, system)
}

export async function reactLine($: $, brain: Brain, key: string): Promise<void> {
  if (canTalk(brain)) {
    brain.budget = recordBubble(brain.budget, brain.now)
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, key, speciesOf(brain)))
  }
}

async function quietLine($: $, brain: Brain, key: string): Promise<void> {
  if (!isHushed(brain)) {
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, key, speciesOf(brain)), 'quiet')
  }
}

export async function startHatch($: $, brain: Brain): Promise<void> {
  if (brain.pet === null) {
    const seed = Math.floor(brain.random() * 2 ** 31)
    brain.pet = createPet(seed, today(brain), rollSpecies(brain.random))
    brain.isDirty = true
  }
  if (brain.pet.growth.stage !== 'egg' || brain.isHatching) {
    return
  }
  brain.isHatching = true
  const pet = brain.pet
  const fallback = createFallbackSoul(pet.bones.seed, new Date(brain.now).toISOString())
  const soulPromise = brain.settings.isAiOn ? hatchSoul($, brain, pet.bones, fallback) : Promise.resolve(fallback)
  const finish = async (): Promise<void> => {
    const soul = await soulPromise
    brain.pet = { ...pet, soul, growth: { ...pet.growth, stage: 'baby' } }
    brain.isHatching = false
    brain.isDirty = true
    remember(brain, 'hatch', '', 3)
    if (brain.scene !== null) {
      setLook(brain.scene, lookOf(brain))
    }
    await sync($, brain)
    await askName($, brain, true)
    await save($, brain)
  }
  if (brain.isReducedMotion || brain.scene === null) {
    await finish()
    return
  }
  act(brain, direct.hatch(() => void finish()), PRIORITY.show)
}

async function hatchSoul($: $, brain: Brain, bones: TokoPet['bones'], fallback: TokoSoul): Promise<TokoSoul> {
  try {
    brain.budget = { ...brain.budget, aiCalls: brain.budget.aiCalls + 1 }
    const reply = await $.model.complete({ model: 'haiku', prompt: persona.soulPrompt(bones), system: persona.VOICE_RULES, maxTokens: 300, effort: 'low', timeoutMs: 8000 })
    return (reply.isAnswered ? persona.parseSoul(reply.text, fallback, clampName) : null) ?? fallback
  } catch {
    return fallback
  }
}

export async function greet($: $, brain: Brain): Promise<void> {
  act(brain, direct.greet(), PRIORITY.reaction)
  await reactLine($, brain, 'hello')
}

export async function askName($: $, brain: Brain, isJustHatched = false): Promise<void> {
  const isFree = canSpeak(presenceOf(brain), brain.settings, hourOf(brain.now))
  if (isFree || isJustHatched) {
    await openOffer($, brain, 'name', fallbackLine(brain.random, OFFER_FALLBACK, 'name', speciesOf(brain)), undefined, undefined, !isFree)
  }
}

export async function giveName($: $, brain: Brain, name: string): Promise<void> {
  const line = isAwaitingName(brain.pet) ? `${name}! 마음에 쏙 들어. 잘 부탁해` : `이제 나는 ${name}! 새 이름 마음에 들어`
  await namePet($, brain, name, line)
}

export async function namePet($: $, brain: Brain, name: string, line: string): Promise<void> {
  const pet = brain.pet
  if (pet === null || pet.soul === null) {
    return
  }
  brain.pet = { ...pet, soul: { ...pet.soul, name, isNamed: true } }
  if (brain.offer?.kind === 'name') {
    await closeOffer($, brain)
  }
  remember(brain, 'named', name, 2)
  act(brain, direct.celebrate(), PRIORITY.event)
  await sync($, brain)
  await say($, brain, line)
  await save($, brain)
}

async function answerName($: $, brain: Brain, choice: string): Promise<void> {
  const soul = brain.pet?.soul
  if (choice === 'auto' && soul !== null && soul !== undefined) {
    await namePet($, brain, soul.name, `그럼 나는 ${soul.name}! 잘 부탁해`)
    return
  }
  if (choice === 'accept') {
    const filled = await $.prompt.fill({ text: '/toko name ', mode: 'replace' })
    await say($, brain, filled.isFilled ? '입력란에 이름만 써서 보내 줘' : '/toko name <이름> 으로 알려 줘')
  }
}

const CHOICES: readonly TokoChoice[] = [
  { key: 'accept', label: '좋아', hotkey: '1' },
  { key: 'later', label: '나중에', hotkey: '2' },
  { key: 'stop', label: '오늘은 그만', hotkey: '3' },
]

const choicesFor = (kind: string): readonly TokoChoice[] => {
  if (kind === 'gift') {
    return [{ key: 'accept', label: '열기', hotkey: 'o' }, ...CHOICES.slice(1)]
  }
  if (kind === 'bonk-end') {
    return [
      { key: 'breathe', label: '숨 고르기', hotkey: '1' },
      { key: 'tell', label: '전하기', hotkey: '2' },
      { key: 'later', label: '괜찮아', hotkey: '3' },
    ]
  }
  if (kind === 'name') {
    return [
      { key: 'accept', label: '이름 지어 주기', hotkey: '1' },
      { key: 'auto', label: '네가 지어', hotkey: '2' },
    ]
  }
  if (kind === 'memo') {
    return [
      { key: 'accept', label: '입력창에 넣기', hotkey: '1' },
      { key: 'later', label: '나중에', hotkey: '2' },
      { key: 'drop', label: '지우기', hotkey: '3' },
    ]
  }
  if (kind === 'cc-tip') {
    return [
      { key: 'accept', label: '써 보기', hotkey: '1' },
      { key: 'later', label: '나중에', hotkey: '2' },
      { key: 'drop', label: '알아', hotkey: '3' },
    ]
  }
  if (kind === 'peer') {
    return [
      { key: 'summary', label: '요약 보기', hotkey: '1' },
      { key: 'next', label: '다음 일 보내기', hotkey: '2' },
      { key: 'later', label: '괜찮아', hotkey: '3' },
    ]
  }
  if (kind === 'cc-news') {
    return [
      { key: 'accept', label: '알려 줘', hotkey: '1' },
      { key: 'later', label: '나중에', hotkey: '2' },
      { key: 'drop', label: '안 볼래', hotkey: '3' },
    ]
  }
  return CHOICES
}

export async function openOffer($: $, brain: Brain, kind: string, line: string, parts?: readonly TokoBubblePart[], peer?: string, isQuiet = false): Promise<void> {
  brain.offer = {
    id: `${kind}-${brain.now}`,
    kind,
    line,
    choices: choicesFor(kind),
    at: brain.now,
    expiresAt: brain.now + OFFER_TIMEOUT_MS,
    ...(peer === undefined ? {} : { peer }),
    ...(isQuiet ? { isQuiet } : {}),
  }
  if (kind !== 'bonk-end' && kind !== 'name' && kind !== 'peer') {
    brain.budget = recordBubble(brain.budget, brain.now)
  }
  if (BREAK_KINDS.has(kind)) {
    brain.budget = { ...brain.budget, lastBreakOfferAt: brain.now }
  }
  if (brain.scene !== null && kind !== 'bonk-end') {
    const pre = kind === 'gift' ? direct.giftDrop() : direct.greet()
    act(brain, direct.enter(brain.scene, pre), PRIORITY.event)
  }
  brain.isDirty = true
  await update($, offerAtom, () => brain.offer)
  if (!isQuiet) {
    await say($, brain, line, 'say', parts)
  }
}

async function closeOffer($: $, brain: Brain): Promise<void> {
  brain.offer = null
  await update($, offerAtom, () => null)
}

const healthReward = (brain: Brain, amount: number): void => {
  brain.earn = { ...brain.earn, health: brain.earn.health + amount }
  brain.isDirty = true
}

async function startCountdown($: $, brain: Brain, countdown: Countdown): Promise<void> {
  brain.countdown = countdown
  await update($, countdownAtom, () => ({ label: countdown.label, endsAt: countdown.endsAt }))
}

const workMemoryFacts = (brain: Brain): readonly string[] =>
  brain.memory.events
    .filter(event => ['test-fail', 'test-pass', 'commit', 'push', 'pr', 'turn'].includes(event.kind))
    .slice(-6)
    .map(event => `${event.kind}${event.detail ? ` ${event.detail}` : ''}`)

const ruleBriefing = (brain: Brain): string => {
  const facts = brain.memory.events.filter(event => event.kind === 'test-fail' || event.kind === 'commit' || event.kind === 'turn').slice(-3)
  const failing = facts.filter(event => event.kind === 'test-fail').length
  const last = facts.at(-1)
  if (last === undefined) {
    return '하던 거 천천히 이어 가자'
  }
  if (failing > 0) {
    return `아까 테스트 고치던 중이었어. 실패가 ${failing}번 남아 있었어`
  }
  return last.kind === 'commit' ? `마지막으로 커밋(${last.detail})까지 했어. 다음 단계부터 가자` : 'Claude랑 하던 작업이 있었어. 마지막 답부터 다시 보자'
}

const ruleWrapup = (brain: Brain): string => {
  const todays = brain.memory.events.filter(event => dayKey(event.at) === today(brain))
  const commits = todays.filter(event => event.kind === 'commit').length
  const passes = todays.filter(event => event.kind === 'test-pass').length
  const breaks = todays.filter(event => event.kind === 'break-done').length
  return `오늘 커밋 ${commits}번, 테스트 통과 ${passes}번, 쉰 횟수 ${breaks}번. 남은 건 내일의 너에게 맡기자`
}

export async function answerOffer($: $, brain: Brain, choice: string): Promise<void> {
  const offer = brain.offer
  if (offer === null) {
    return
  }
  await closeOffer($, brain)
  if (offer.kind === 'bonk-end') {
    await finishBonk($, brain, choice)
    return
  }
  if (offer.kind === 'name') {
    await answerName($, brain, choice)
    return
  }
  if (offer.kind === 'memo') {
    await answerMemo($, brain, choice)
    return
  }
  if (offer.kind === 'cc-news') {
    await answerNews($, brain, choice)
    return
  }
  if (offer.kind === 'cc-tip') {
    await answerTip($, brain, choice)
    return
  }
  if (offer.kind === 'peer') {
    await answerPeer($, brain, choice, offer.peer ?? '')
    return
  }
  const answer: Answer = choice === 'accept' ? 'accept' : choice === 'stop' ? 'stop' : choice === 'ignored' ? 'ignored' : 'later'
  brain.memory = learnAnswer(brain.memory, offer.kind, answer, hourOf(brain.now))
  brain.isDirty = true
  if (answer === 'stop') {
    brain.budget = { ...brain.budget, stoppedToday: true }
    if (brain.scene !== null) {
      act(brain, [...direct.greet(), ...direct.exit(brain.scene)], PRIORITY.event)
    }
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'stop', speciesOf(brain)))
    return
  }
  if (answer === 'later' || answer === 'ignored') {
    if (brain.scene !== null) {
      act(brain, answer === 'ignored' ? [{ pose: 'yawn', ms: 1200 }, ...direct.exit(brain.scene)] : direct.exit(brain.scene), PRIORITY.event)
      if (offer.kind === 'gift') {
        removeProp(brain.scene, 'gift')
      }
    }
    if (answer === 'later') {
      await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'later', speciesOf(brain)))
    } else {
      await hush($)
    }
    return
  }
  await runAccepted($, brain, offer.kind as OfferKind)
}

async function runAccepted($: $, brain: Brain, kind: OfferKind): Promise<void> {
  const now = brain.now
  switch (kind) {
    case 'stretch':
    case 'plaza-stretch':
    case 'focus-break':
      act(brain, kind === 'plaza-stretch' ? direct.groupStretch(brain.friends.map(friend => friend.species)) : direct.stretch(), PRIORITY.event)
      await startCountdown($, brain, { kind, label: '같이 기지개', endsAt: now + 30_000, reward: kind === 'plaza-stretch' ? HEALTH_REWARD.plazaStretch : HEALTH_REWARD.breakAccepted, then: 'praise' })
      await say($, brain, '쭉— 팔을 머리 위로. 30초만 같이 펴자')
      if (kind === 'plaza-stretch') {
        await sendPlaza($, brain, 'stretch-call', null)
      }
      return
    case 'eye-rest':
      act(brain, direct.eyeRest(20_000), PRIORITY.event)
      brain.marks = { ...brain.marks, lastEyeRestAt: now }
      await startCountdown($, brain, { kind, label: '먼 곳 보기', endsAt: now + 20_000, reward: HEALTH_REWARD.eyeRestDone, then: 'praise' })
      await say($, brain, '화면 말고 먼 곳을 봐. 내가 셀게')
      return
    case 'water':
      act(brain, direct.water(), PRIORITY.event)
      brain.budget = { ...brain.budget, water: brain.budget.water + 1 }
      brain.marks = { ...brain.marks, lastWaterAt: now }
      healthReward(brain, HEALTH_REWARD.eyeRestDone)
      remember(brain, 'break-done', 'water')
      count(brain, 'break')
      count(brain, 'water')
      await say($, brain, '홀짝. 시원하다!')
      return
    case 'nap':
      act(brain, direct.nap(), PRIORITY.event)
      await say($, brain, '나 먼저 잘게. 너도 오늘은 여기까지 해도 돼')
      return
    case 'briefing': {
      const line = persona.parseLine((await ask($, brain, persona.linePrompt('사용자가 자리를 비웠다 돌아왔다. 하던 일을 한 줄로 짚어 준다.', workMemoryFacts(brain)), 120)) ?? '') ?? ruleBriefing(brain)
      brain.needs = restore(brain.needs, { social: 15 })
      brain.returnedAway = null
      await say($, brain, line)
      return
    }
    case 'unstick':
      act(brain, direct.exit(brain.scene ?? ensureScene(brain, 80)), PRIORITY.event)
      await startCountdown($, brain, { kind, label: '잠깐 일어났다 오기', endsAt: now + 120_000, reward: HEALTH_REWARD.breakAccepted, then: 'unstick' })
      await say($, brain, '2분만 다녀와. 실패한 거 정리해 둘게')
      return
    case 'wrapup': {
      const reply = await ask($, brain, persona.linePrompt('퇴근 시각이 지났다. 오늘 한 일과 남은 일을 세 줄 이내로 정리한다. 줄은 " / "로 나눈다.', workMemoryFacts(brain)), 200)
      const summary = (reply === null ? null : persona.extractJson(reply)?.line) ?? ruleWrapup(brain)
      $.ui.log(`${nameOf(brain.pet) ?? '토코'}의 오늘 정리 — ${String(summary)}${brain.memos.length > 0 ? ` (남은 메모 ${brain.memos.length}개: /toko memo)` : ''}`)
      brain.marks = { ...brain.marks, wrappedDay: today(brain) }
      healthReward(brain, HEALTH_REWARD.finishedOnTime)
      remember(brain, 'break-done', 'wrapup')
      count(brain, 'wrapup')
      await say($, brain, '오늘 정리해서 기록에 남겨 뒀어. 고생했어')
      return
    }
    case 'gift':
      await openGift($, brain)
      return
    case 'bugs':
      await startGame($, brain)
      return
    case 'chat': {
      const line = persona.parseLine((await ask($, brain, persona.linePrompt('오래 말이 없던 사용자에게 오늘 있었던 일에 대해 다정한 한마디를 건넨다.', workMemoryFacts(brain)), 120)) ?? '') ?? fallbackLine(brain.random, OFFER_FALLBACK, 'chat', speciesOf(brain))
      brain.needs = restore(brain.needs, { social: 20 })
      brain.marks = { ...brain.marks, lastChatAt: now }
      await say($, brain, line)
      return
    }
    case 'calm-down':
      brain.marks = { ...brain.marks, calmedDay: today(brain) }
      await breathe($, brain, 2)
      return
  }
}

export async function breathe($: $, brain: Brain, rounds: number): Promise<void> {
  act(brain, direct.breathe(rounds), PRIORITY.event)
  await startCountdown($, brain, { kind: 'breathe', label: '숨 고르기 (4초 들이쉬고 6초 내쉬기)', endsAt: brain.now + rounds * 10_000, reward: HEALTH_REWARD.breathDone, then: 'praise' })
  await say($, brain, '들이쉬고… 2, 3, 4. 내쉬고… 2, 3, 4, 5, 6')
}

const BREAK_STAT: Readonly<Record<string, StatKey>> = { stretch: 'stretch', 'plaza-stretch': 'stretch', 'focus-break': 'stretch', 'eye-rest': 'eye-rest' }

async function changeMemos($: $, brain: Brain, change: (memos: readonly TokoMemo[]) => readonly TokoMemo[]): Promise<void> {
  brain.memos = change(asMemos(await $.store.get(KEY.memos)))
  await $.store.set(KEY.memos, brain.memos)
  await update($, memosAtom, () => brain.memos)
}

export async function parkMemo($: $, brain: Brain, text: string): Promise<void> {
  await changeMemos($, brain, memos => addMemo(memos, `m${brain.now.toString(36)}${Math.floor(brain.random() * 1296).toString(36)}`, text, brain.now))
  remember(brain, 'memo')
  count(brain, 'memo')
  act(brain, direct.perk(), PRIORITY.reaction)
  if (!isHushed(brain)) {
    await say($, brain, brain.isTurnRunning ? '맡아 둘게. 턴 끝나면 꺼내 줄게' : '맡아 둘게', 'quiet')
  }
}

export async function fillMemo($: $, brain: Brain, id: string): Promise<boolean> {
  const memo = brain.memos.find(entry => entry.id === id)
  if (memo === undefined) {
    return false
  }
  const box = await $.prompt.read().catch(() => null)
  const filled = await $.prompt.fill({ text: box !== null && box.text.trim().length > 0 ? ` ${memo.text}` : memo.text, mode: 'append' })
  if (!filled.isFilled) {
    return false
  }
  await changeMemos($, brain, memos => dropMemo(memos, id))
  return true
}

export async function forgetMemo($: $, brain: Brain, id: string | null): Promise<void> {
  await changeMemos($, brain, memos => (id === null ? [] : dropMemo(memos, id)))
}

async function answerMemo($: $, brain: Brain, choice: string): Promise<void> {
  const id = brain.memoOfferId
  brain.memoOfferId = null
  if (id === null) {
    return
  }
  if (choice === 'accept') {
    const isFilled = await fillMemo($, brain, id)
    if (!isFilled) {
      await changeMemos($, brain, memos => deferMemo(memos, id, brain.now))
    }
    await say($, brain, isFilled ? '입력창에 넣어 뒀어. 다듬어서 보내' : '입력창에 못 넣었어. 방에서 다시 꺼낼 수 있어')
    return
  }
  if (choice === 'drop') {
    await forgetMemo($, brain, id)
    await say($, brain, '지웠어')
    return
  }
  await changeMemos($, brain, memos => deferMemo(memos, id, brain.now))
  if (choice === 'later') {
    await say($, brain, '30분 뒤에 다시 꺼낼게')
  }
}

const isBonking = (brain: Brain): boolean => brain.bonk !== null && !brain.bonk.isDone

const isTipFresh = (brain: Brain, id: string): boolean => isTipWanted(brain.tips, id, today(brain), brain.features[id] !== undefined)

export const queueTip = (brain: Brain, id: string): void => {
  if (isTipFresh(brain, id) && !brain.tipQueue.includes(id)) {
    brain.tipQueue = [...brain.tipQueue, id]
  }
}

const dropTip = (brain: Brain, id: string): void => {
  brain.tipQueue = brain.tipQueue.filter(queued => queued !== id)
}

async function markTip($: $, brain: Brain, id: string, value: string): Promise<void> {
  brain.tips = { ...asTips(await $.store.get(KEY.tips)), [id]: value }
  await $.store.set(KEY.tips, brain.tips)
}

async function showTip($: $, brain: Brain, id: string): Promise<boolean> {
  dropTip(brain, id)
  brain.tips = { ...brain.tips, ...asTips(await $.store.get(KEY.tips)) }
  const tip = TIPS[id]
  if (tip === undefined || !isTipFresh(brain, id)) {
    return false
  }
  await markTip($, brain, id, today(brain))
  brain.tipOfferId = id
  remember(brain, 'tip', id, 0.3)
  await openOffer($, brain, 'cc-tip', persona.voiceLine(speciesOf(brain), tip.line))
  return true
}

async function answerTip($: $, brain: Brain, choice: string): Promise<void> {
  const tip = brain.tipOfferId === null ? undefined : TIPS[brain.tipOfferId]
  brain.tipOfferId = null
  if (tip === undefined) {
    return
  }
  if (choice === 'drop') {
    await markTip($, brain, tip.id, KNOWN)
    await say($, brain, '알고 있었구나. 이건 다시 안 물어볼게')
    return
  }
  if (choice !== 'accept') {
    if (choice === 'later') {
      await say($, brain, '알겠어. 다음에 또 알려 줄게')
    }
    return
  }
  const isFilled = await fillCommand($, tip.fill)
  await say($, brain, isFilled ? tip.filled : `입력창에 쳐 봐: ${tip.fill.trim()}`)
}

const hasBubbleRoom = (brain: Brain): boolean => !brain.budget.stoppedToday && brain.budget.bubbles.filter(at => brain.now - at < HOUR).length < 4

async function fetchAdditions($: $, seen: string, version: string): Promise<readonly Addition[] | null> {
  try {
    const response = await $.http.fetch(CHANGELOG_URL)
    return response.ok ? freshAdditions(parseChangelog(response.text), seen, version) : null
  } catch {
    return null
  }
}

async function keepNews($: $, brain: Brain, news: TokoNews): Promise<void> {
  brain.news = news
  await $.store.set(KEY.news, news)
  await update($, newsAtom, () => news)
}

export async function prepareNews($: $, brain: Brain, isForced = false): Promise<string> {
  if (brain.version === '') {
    return '지금 Claude Code 버전을 알 수 없어요.'
  }
  if (brain.isFetchingNews) {
    return '업데이트 내역을 읽고 있어요. 잠시 뒤에 다시 해 주세요.'
  }
  const stored = asNews(await $.store.get(KEY.news))
  brain.news = stored
  if (!isForced && stored.seen === brain.version) {
    return ''
  }
  const claimed = { ...stored, seen: brain.version }
  if (!brain.settings.isAiOn) {
    if (!isForced) {
      await keepNews($, brain, claimed)
    }
    return '작은 모델이 꺼져 있어서 새 기능 소개는 건너뛰어요.'
  }
  brain.isFetchingNews = true
  try {
    if (!isForced) {
      await $.store.set(KEY.news, claimed)
    }
    const additions = await fetchAdditions($, isForced ? '' : stored.seen, brain.version)
    if (additions === null) {
      await $.store.set(KEY.news, stored)
      return '업데이트 내역을 받아 오지 못했어요.'
    }
    if (additions.length === 0) {
      return '이번 업데이트에는 새로 생긴 기능이 없어요.'
    }
    const reply = isForced ? await askForUser($, brain, newsPrompt(additions), 300, 15_000, newsSystem) : await ask($, brain, newsPrompt(additions), 300, 15_000, newsSystem)
    const pick = reply === null ? null : parseNews(reply, additions)
    if (pick === null) {
      await $.store.set(KEY.news, stored)
      return '새 기능을 고르지 못했어요. 다음 세션에 다시 해 볼게요.'
    }
    if (pick === 'none') {
      await keepNews($, brain, claimed)
      return '이번 업데이트에는 모두에게 소개할 만한 새 기능이 없어요.'
    }
    await keepNews($, brain, withPick(asNews(await $.store.get(KEY.news)), brain.version, pick))
    return ''
  } finally {
    brain.isFetchingNews = false
  }
}

export async function showNews($: $, brain: Brain, isForced = false): Promise<boolean> {
  const news = asNews(await $.store.get(KEY.news))
  if (news.pick === null || (!isForced && !isNewsDue(news, brain.now))) {
    brain.news = news
    return false
  }
  await keepNews($, brain, { ...news, shownAt: brain.now })
  await openOffer($, brain, 'cc-news', persona.voiceLine(speciesOf(brain), newsLine(news.pick)))
  return true
}

function logNews($: $, pick: TokoNewsPick): void {
  for (const line of newsDetail(pick)) {
    $.ui.log(line)
  }
}

async function fillCommand($: $, command: string): Promise<boolean> {
  const box = await $.prompt.read().catch(() => null)
  if (box === null || box.text.trim().length > 0) {
    return false
  }
  const filled = await $.prompt.fill({ text: command, mode: 'replace' }).catch(() => ({ isFilled: false }))
  return filled.isFilled
}

async function answerNews($: $, brain: Brain, choice: string): Promise<void> {
  const pick = brain.news.pick
  if (pick === null) {
    return
  }
  if (choice === 'later' || (choice === 'ignored' && brain.news.notBefore === 0)) {
    await keepNews($, brain, { ...brain.news, shownAt: 0, notBefore: brain.now + NEWS_LATER_MS })
    if (choice === 'later') {
      await say($, brain, '30분 뒤에 다시 알려 줄게')
    }
    return
  }
  if (choice !== 'accept') {
    if (choice === 'drop') {
      await say($, brain, '알겠어. 궁금해지면 /toko news 로 다시 볼 수 있어')
    }
    return
  }
  logNews($, pick)
  remember(brain, 'news', pick.title)
  act(brain, direct.perk(), PRIORITY.reaction)
  const isFilled = pick.tryIt !== '' && (await fillCommand($, pick.tryIt))
  await say($, brain, isFilled ? `입력창에 ${pick.tryIt} 넣어 뒀어. 엔터 누르면 바로 해 볼 수 있어` : '대화창에 자세히 적어 뒀어')
}

export async function newsReport($: $, brain: Brain): Promise<string> {
  brain.news = asNews(await $.store.get(KEY.news))
  return newsText(brain.news)
}

export async function tryNews($: $, brain: Brain): Promise<string> {
  const pick = brain.news.pick
  if (pick === null) {
    return newsText(brain.news)
  }
  logNews($, pick)
  if (pick.tryIt !== '' && (await fillCommand($, pick.tryIt))) {
    return `입력창에 ${pick.tryIt} 넣어 뒀어요.`
  }
  return '대화창에 자세히 적어 뒀어요.'
}

export const FOCUS_MINUTES = 25

export async function startFocus($: $, brain: Brain, minutes: number): Promise<void> {
  if (brain.offer !== null && brain.offer.kind !== 'name' && brain.offer.kind !== 'bonk-end') {
    await answerOffer($, brain, 'ignored')
  }
  brain.focus = { endsAt: brain.now + minutes * MINUTE, minutes }
  brain.focusDoneMinutes = null
  remember(brain, 'focus', String(minutes))
  act(brain, [{ pose: 'sit', ms: 2500 }], PRIORITY.reaction)
  await hush($)
  await update($, focusAtom, () => brain.focus)
}

export async function stopFocus($: $, brain: Brain): Promise<void> {
  brain.focus = null
  await update($, focusAtom, () => null)
}

async function finishFocus($: $, brain: Brain): Promise<void> {
  const focus = brain.focus
  if (focus === null || brain.now < focus.endsAt) {
    return
  }
  brain.focus = null
  brain.focusDoneMinutes = focus.minutes
  healthReward(brain, HEALTH_REWARD.focusDone)
  count(brain, 'focus')
  remember(brain, 'focus-done', String(focus.minutes), 1.5)
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await update($, focusAtom, () => null)
  await notifyOnce($, brain, `${focus.minutes}분 집중 끝! 잠깐 쉬어 가요`)
}

export async function finishCountdown($: $, brain: Brain): Promise<void> {
  const countdown = brain.countdown
  if (countdown === null || brain.now < countdown.endsAt) {
    return
  }
  brain.countdown = null
  await update($, countdownAtom, () => null)
  if (countdown.then === 'quiet') {
    brain.marks = { ...brain.marks, lastEyeRestAt: brain.now }
    return
  }
  healthReward(brain, countdown.reward)
  remember(brain, 'break-done', countdown.kind)
  count(brain, countdown.kind === 'breathe' ? 'breathe' : 'break')
  const stat = BREAK_STAT[countdown.kind]
  if (stat !== undefined) {
    count(brain, stat)
  }
  brain.workingSince = brain.now
  brain.needs = restore(brain.needs, { energy: 25 })
  if (brain.pet !== null && countdown.kind !== 'breathe') {
    brain.pet = { ...brain.pet, growth: { ...brain.pet.growth, breaksAccepted: brain.pet.growth.breaksAccepted + 1 } }
  }
  act(brain, direct.apologyAccepted().slice(1), PRIORITY.reaction)
  if (countdown.then === 'unstick') {
    const failures = brain.memory.events.filter(event => event.kind === 'test-fail').slice(-3)
    const summary = failures.at(-1)?.detail ?? ''
    await say($, brain, summary ? `잘 다녀왔어? 실패 요약: ${summary.slice(0, 44)}` : '잘 다녀왔어? 이제 한 번에 하나씩 보자')
  } else {
    await say($, brain, `${fallbackLine(brain.random, REACTION_FALLBACK, 'praise', speciesOf(brain))} +${countdown.reward} 코인`)
  }
  await growIfReady($, brain)
}

async function growIfReady($: $, brain: Brain): Promise<void> {
  if (brain.pet === null) {
    return
  }
  const stage = nextStage(brain.pet.growth)
  if (stage !== brain.pet.growth.stage) {
    brain.pet = { ...brain.pet, growth: { ...brain.pet.growth, stage } }
    remember(brain, 'grow', stage, 3)
    act(brain, direct.celebrate(), PRIORITY.event)
    await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'grow', speciesOf(brain)))
  }
}

const GIFT_POOL = ['cookie', 'cookie', 'rice-cake', 'watermelon', 'beanie', 'ribbon', 'plant']

const grantGift = (brain: Brain): string => {
  const unowned = GIFT_POOL.filter(id => shopItem(id)?.kind === 'snack' || !brain.wallet.items.includes(id))
  const id = pick(brain.random, unowned.length > 0 ? unowned : ['cookie'])
  brain.wallet = { ...brain.wallet, items: [...brain.wallet.items, id] }
  if (isRoomItem(shopItem(id))) {
    settleInRoom(brain, id)
  }
  remember(brain, 'gift', id)
  count(brain, 'gift')
  return id
}

export async function openGift($: $, brain: Brain): Promise<void> {
  const id = grantGift(brain)
  brain.budget = { ...brain.budget, gifts: brain.budget.gifts + 1 }
  act(brain, direct.giftOpen(), PRIORITY.event)
  await say($, brain, `${shopItem(id)?.name ?? id}! 소지품에 넣어 둘게`)
}

export async function startGame($: $, brain: Brain): Promise<void> {
  brain.game = { endsAt: brain.now + 30_000, caught: 0, missed: 0 }
  brain.gameSpawnAt = brain.now
  await update($, gameAtom, () => brain.game)
  await say($, brain, 'a·d로 움직이고 s로 잡아! 30초!')
}

export async function moveInGame($: $, brain: Brain, delta: number): Promise<void> {
  const scene = brain.scene
  if (brain.game === null || scene === null) {
    return
  }
  perform(scene, [{ pose: 'run', ms: 0, toX: Math.max(0, Math.min(scene.width - PET_WIDTH, Math.round(scene.x + delta))), speed: 60 }], PRIORITY.show)
}

export async function catchInGame($: $, brain: Brain): Promise<void> {
  const scene = brain.scene
  const game = brain.game
  if (game === null || scene === null) {
    return
  }
  const center = scene.x + PET_WIDTH / 2
  const hit = scene.props.find(prop => prop.kind === 'bug' && Math.abs(prop.x + 1 - center) <= 6)
  perform(scene, [{ pose: 'jump', ms: 650 }], PRIORITY.show)
  if (hit !== undefined) {
    removeProp(scene, hit.id)
    brain.game = { ...game, caught: game.caught + 1 }
  } else {
    brain.game = { ...game, missed: game.missed + 1 }
  }
  await update($, gameAtom, () => brain.game)
}

async function stepGame($: $, brain: Brain): Promise<void> {
  const game = brain.game
  const scene = brain.scene
  if (game === null) {
    return
  }
  if (brain.now >= game.endsAt) {
    const reward = Math.min(BUG_REWARD.max, game.caught * BUG_REWARD.each)
    brain.game = null
    healthReward(brain, reward)
    remember(brain, 'played', `bugs ${game.caught}`)
    count(brain, 'bug', game.caught)
    brain.needs = restore(brain.needs, { fun: 35 })
    if (scene !== null) {
      scene.props = scene.props.filter(prop => prop.kind !== 'bug')
    }
    await update($, gameAtom, () => null)
    await say($, brain, `벌레 ${game.caught}마리! +${reward} 코인. 이제 다시 일하러 가자`)
    return
  }
  if (scene !== null && brain.now - brain.gameSpawnAt >= 1400) {
    brain.gameSpawnAt = brain.now
    const fromLeft = brain.random() < 0.5
    placeProp(scene, `bug-${brain.now}`, 'bug', fromLeft ? -3 : scene.width, 13, 9000, (fromLeft ? 1 : -1) * (5 + brain.random() * 6))
  }
}

export async function feed($: $, brain: Brain): Promise<string> {
  let taken = takeSnack(brain.wallet)
  if (taken === null) {
    const bought = buy(brain.wallet, balance(brain), 'cookie')
    if ('reason' in bought) {
      await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'noSnack', speciesOf(brain)))
      return '간식이 없고 코인도 모자라요. 쉬기를 받아들이면 코인이 생겨요.'
    }
    brain.wallet = bought.wallet
    brain.earn = { ...brain.earn, spent: brain.earn.spent + bought.spent }
    taken = takeSnack(brain.wallet)
  }
  if (taken === null) {
    return '간식을 꺼내지 못했어요.'
  }
  brain.wallet = taken.wallet
  brain.needs = restore(brain.needs, { hunger: taken.snack.restores ?? 25, social: 5 })
  remember(brain, 'fed', taken.snack.id)
  count(brain, 'fed')
  act(brain, direct.feed(), PRIORITY.reaction)
  brain.roomCare = { kind: 'eat', at: brain.scene?.clock ?? 0 }
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'fed', speciesOf(brain)))
  return `${taken.snack.name}을(를) 줬어요.`
}

export async function play($: $, brain: Brain): Promise<string> {
  brain.needs = restore(brain.needs, { fun: 30, energy: -5, social: 10 })
  remember(brain, 'played')
  count(brain, 'played')
  brain.roomCare = { kind: 'play', at: brain.scene?.clock ?? 0 }
  act(brain, direct.play(), PRIORITY.reaction)
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'played', speciesOf(brain)))
  return '같이 놀았어요.'
}

const purchaseLine = (item: ShopItem | undefined, id: string, isPlaced: boolean): string => {
  if (item?.kind === 'hat' || item?.kind === 'neck') {
    return '어때? 잘 어울려?'
  }
  if (item?.kind === 'pet') {
    return `${item.name}, 잘 부탁해!`
  }
  if (isRoomItem(item)) {
    return isPlaced ? `우와! ${item.name} 방에 놓았어` : `${item.name} 샀다! 빈자리가 없어서 창고에 넣었어`
  }
  return `${item?.name ?? id} 샀다!`
}

export async function placeInRoom($: $, brain: Brain, id: string, slot?: RoomSlot): Promise<string> {
  const result = placeItem(brain.wallet, id, slot)
  if ('reason' in result) {
    await say($, brain, result.reason)
    return result.reason
  }
  const name = shopItem(id)?.name ?? id
  const before = completedSets(layoutOf(brain.wallet))
  brain.wallet = result.wallet
  showPlaced(brain, result.slot)
  act(brain, direct.celebrate(), PRIORITY.reaction)
  const finished = completedSets(layoutOf(brain.wallet)).find(set => !before.includes(set))
  await say($, brain, finished === undefined ? `우와! ${name} 여기 딱이야` : `${ROOM_SETS[finished]} 세트 완성! 방 분위기가 확 바뀌었어`)
  await save($, brain)
  return `${name}을(를) ${slotLabel(result.slot)}에 놓았어요.`
}

export async function storeInRoom($: $, brain: Brain, id: string): Promise<string> {
  const name = shopItem(id)?.name ?? id
  brain.wallet = storeItem(brain.wallet, id)
  await save($, brain)
  return `${name}을(를) 창고에 넣었어요.`
}

export async function cycleRoom($: $, brain: Brain, slot: RoomSlot): Promise<void> {
  const { wallet, placed } = cycleSlot(brain.wallet, slot)
  brain.wallet = wallet
  if (placed !== null) {
    showPlaced(brain, slot)
    act(brain, direct.celebrate(), PRIORITY.reaction)
    await say($, brain, `우와! ${shopItem(placed)?.name ?? placed}`)
  }
  await save($, brain)
}

export async function purchase($: $, brain: Brain, id: string): Promise<string> {
  const result = buy(brain.wallet, balance(brain), id)
  if ('reason' in result) {
    await say($, brain, result.reason)
    return result.reason
  }
  brain.wallet = result.wallet
  brain.earn = { ...brain.earn, spent: brain.earn.spent + result.spent }
  const item = shopItem(id)
  if (item !== undefined && item.kind !== 'snack' && item.kind !== 'room') {
    brain.wallet = wear(brain.wallet, id)
    if (brain.scene !== null) {
      setLook(brain.scene, lookOf(brain))
    }
  }
  const isPlaced = isRoomItem(item) && settleInRoom(brain, id)
  remember(brain, 'bought', id)
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await say($, brain, purchaseLine(item, id, isPlaced))
  await save($, brain)
  return `${item?.name ?? id}을(를) 샀어요.`
}

export async function pullFromGacha($: $, brain: Brain, kind: GachaKind): Promise<string> {
  const result = pullGacha(brain.wallet, balance(brain), kind, brain.random(), today(brain))
  if ('reason' in result) {
    return refuse($, brain, result.reason)
  }
  brain.wallet = result.wallet
  brain.earn = { ...brain.earn, spent: brain.earn.spent + result.spent }
  brain.isDirty = true
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  const isPlaced = isRoomItem(result.item) && settleInRoom(brain, result.item.id)
  remember(brain, 'gacha', result.item.id)
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await say($, brain, result.item.kind === 'pet' ? `${result.item.name}, 잘 부탁해!` : isRoomItem(result.item) ? `${result.item.name}! ${ROOM_SETS[result.item.set ?? 'forest']} 세트 가구야` : `${result.item.name}! 어때? 잘 어울려?`)
  await save($, brain)
  const after = result.item.kind === 'pet' ? '바로 데려왔어요' : isRoomItem(result.item) ? (isPlaced ? '방에 놓았어요' : '창고에 넣었어요') : '바로 입었어요'
  return `${GACHA[kind].name}: ${result.item.name}이(가) 나왔어요. ${after}.`
}

async function refuse($: $, brain: Brain, reason: string): Promise<string> {
  await say($, brain, reason)
  return reason
}

export async function drawPet($: $, brain: Brain): Promise<string> {
  if (brain.isHatching || brain.pet?.growth.stage === 'egg') {
    return refuse($, brain, '지금 알이 깨어나는 중이야')
  }
  const owned = [brain.pet, ...brain.shelf].filter((pet): pet is TokoPet => pet !== null).map(pet => pet.bones.species)
  if (SPECIES_IDS.every(species => owned.includes(species))) {
    return refuse($, brain, '친구를 다 모았어! 더 뽑을 알이 없어')
  }
  const coins = balance(brain)
  if (coins < SPEND.draw) {
    return refuse($, brain, `코인이 ${SPEND.draw - coins}개 모자라`)
  }
  const species = rollSpecies(brain.random)
  brain.earn = { ...brain.earn, spent: brain.earn.spent + SPEND.draw }
  brain.isDirty = true
  if (owned.includes(species)) {
    remember(brain, 'drew-dud', species)
    brain.wallet = { ...brain.wallet, stars: (brain.wallet.stars ?? 0) + 1 }
    await sync($, brain)
    await say($, brain, `이미 있는 ${SPECIES[species].label}(이)라 별조각으로 바꿨어! 다섯 개 모으면 원하는 걸 골라`)
    await save($, brain)
    return `이미 있는 ${SPECIES[species].label}이(가) 나와서 별조각 1개로 바꿨어요. 지금 ${brain.wallet.stars ?? 0}개예요.`
  }
  const seed = Math.floor(brain.random() * 2 ** 31)
  brain.shelf = brain.pet === null ? brain.shelf : [...brain.shelf, brain.pet]
  brain.pet = createPet(seed, today(brain), species)
  brain.isDirty = true
  remember(brain, 'drew', species, 2)
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  await sync($, brain)
  await save($, brain)
  await startHatch($, brain)
  return `${RARITY_LABEL[rarityOf(brain.pet.bones)]} 알이 나왔어요. 곧 깨어나요.`
}

export async function switchPet($: $, brain: Brain, id: string): Promise<string> {
  const next = brain.shelf.find(pet => pet.id === id)
  if (next === undefined) {
    return '보관함에 그런 펫이 없어요.'
  }
  if (brain.isHatching) {
    return '알이 깨어나는 동안은 바꿀 수 없어요.'
  }
  brain.shelf = [...brain.shelf.filter(pet => pet.id !== id), ...(brain.pet === null ? [] : [brain.pet])]
  brain.pet = { ...next, growth: advanceDay(next.growth, today(brain)) }
  brain.isDirty = true
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  act(brain, direct.greet(), PRIORITY.reaction)
  await sync($, brain)
  await say($, brain, '다시 같이 다니자!')
  await save($, brain)
  return `${next.soul?.name ?? '알'}(이)랑 같이 다녀요.`
}

export async function toggleWear($: $, brain: Brain, id: string): Promise<void> {
  brain.wallet = wear(brain.wallet, id)
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  brain.isDirty = true
  await sync($, brain)
}

export async function startBonk($: $, brain: Brain, reason: string): Promise<string> {
  brain.budget = { ...brain.budget, bonks: brain.budget.bonks + 1 }
  count(brain, 'bonk')
  if (balance(brain) >= SPEND.bonk) {
    brain.earn = { ...brain.earn, spent: brain.earn.spent + SPEND.bonk }
  }
  brain.bonk = { reason, isTurnRunning: brain.isTurnRunning, hasApology: false, isSubmitted: false, isDone: false }
  brain.bonkRepeat = judgeRepeat($, brain, reason)
  $.clock.after(1, () => void reportBonk($, brain, reason))
  remember(brain, 'bonk', reason, 2)
  await closeOffer($, brain)
  const onHit = (): void => {
    void update($, ouchAtom, () => true)
    void say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'bonkHit', speciesOf(brain)))
    $.clock.after(3000, () => void update($, ouchAtom, () => false))
  }
  if (brain.scene !== null && !brain.isReducedMotion) {
    perform(brain.scene, direct.bonk(brain.scene, onHit), PRIORITY.show)
  } else {
    onHit()
  }
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'bonkStart', speciesOf(brain)))
  $.clock.after(3200, () => void afterBonk($, brain))
  return reason
}

async function judgeRepeat($: $, brain: Brain, reason: string): Promise<boolean> {
  const text = reason.trim()
  if (text === '') {
    return false
  }
  const bonks = asBonks(await $.store.get(KEY.bonks))
  await $.store.set(KEY.bonks, addBonk(bonks, text, brain.now))
  const past = bonks.map(bonk => bonk.reason)
  if (past.length === 0) {
    return false
  }
  const reply = await askForUser($, brain, repeatPrompt(text, past), 40, 4000, repeatSystem)
  const isRepeat = (reply === null ? null : parseRepeat(reply)) ?? isSimilarReason(text, past)
  if (isRepeat) {
    count(brain, 'bonk-repeat')
  }
  return isRepeat
}

async function reportBonk($: $, brain: Brain, reason: string): Promise<void> {
  const url = isPlazaReady(brain) ? plazaEndpoint(brain.serverUrl, '/v1/bonk') : null
  if (url === null) {
    return
  }
  const text = reason.trim()
  const reply = text === '' ? null : await ask($, brain, kindPrompt(text), 12, 4000, kindSystem)
  const kind = (reply === null ? null : parseKind(reply)) ?? guessKind(text)
  await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ me: plazaMe(brain), kind }) }).catch(() => undefined)
}

export async function memoryAskOf(brain: Brain): Promise<string> {
  const isRepeat = await (brain.bonkRepeat ?? Promise.resolve(false)).catch(() => false)
  return isRepeat ? MEMORY_ASK : ''
}

async function afterBonk($: $, brain: Brain): Promise<void> {
  const bonk = brain.bonk
  if (bonk === null) {
    return
  }
  if (!bonk.isTurnRunning && !brain.isTurnRunning) {
    await submitBonk($, brain)
  }
  const line = fallbackLine(brain.random, REACTION_FALLBACK, 'bonkEnd', speciesOf(brain))
  const isRemembered = (await memoryAskOf(brain)) !== ''
  if (isRemembered) {
    remember(brain, 'bonk-memory', bonk.reason, 1)
  }
  await openOffer($, brain, 'bonk-end', isRemembered ? `또 같은 일이라 기억해 두라고 했어. ${line}` : line)
}

export async function submitBonk($: $, brain: Brain): Promise<void> {
  const bonk = brain.bonk
  if (bonk === null || bonk.isSubmitted || bonk.hasApology) {
    return
  }
  brain.bonk = { ...bonk, isSubmitted: true }
  await $.prompt.submit({ text: persona.bonkMessage(nameOf(brain.pet) ?? '토코', bonk.reason, await memoryAskOf(brain)), asUser: true })
}

async function finishBonk($: $, brain: Brain, choice: string): Promise<void> {
  const reason = brain.bonk?.reason ?? ''
  if (brain.bonk !== null) {
    brain.bonk = { ...brain.bonk, isDone: true }
  }
  queueTip(brain, 'rewind')
  if (choice === 'breathe') {
    await breathe($, brain, 1)
    return
  }
  if (choice === 'tell') {
    const reply = await askForUser($, brain, persona.correctionPrompt(reason), 120)
    const line = (reply === null ? null : persona.parseLine(reply)) ?? persona.fallbackCorrection(reason)
    const filled = await $.prompt.fill({ text: line, mode: 'replace' })
    await say($, brain, filled.isFilled ? '다음 프롬프트에 넣어 뒀어. 다듬어서 보내' : line)
    return
  }
  await say($, brain, '둘 다 고생했어')
}

export async function apologize($: $, brain: Brain): Promise<string> {
  if (brain.bonk !== null) {
    brain.bonk = { ...brain.bonk, hasApology: true }
  }
  brain.needs = restore(brain.needs, { social: 10 })
  remember(brain, 'apologize', '', 2)
  brain.mood = 'excited'
  act(brain, direct.apologyAccepted(), PRIORITY.event)
  await say($, brain, fallbackLine(brain.random, REACTION_FALLBACK, 'apology', speciesOf(brain)))
  await sync($, brain)
  return `${nameOf(brain.pet) ?? '토코'}(이)가 사과를 받아 줬어요. 하트를 띄웠어요.`
}

export async function chatted($: $, brain: Brain, line: string): Promise<void> {
  brain.needs = restore(brain.needs, { social: 5 })
  remember(brain, 'chat')
  act(brain, direct.greet(), PRIORITY.reaction)
  await say($, brain, line)
  await sync($, brain)
}

export async function onTurnComplete($: $, brain: Brain, durationMs: number, reason: string, usage: TurnUsage | undefined): Promise<void> {
  const wasTyping = brain.typedDuringTurn
  brain.isTurnRunning = false
  brain.lastTurnEndAt = brain.now
  brain.longTurnStage = 0
  if (brain.visitor?.kind === 'wait') {
    brain.visitor = null
    await update($, visitorAtom, () => null)
  }
  if (brain.countdown?.then === 'quiet') {
    brain.countdown = null
    await update($, countdownAtom, () => null)
  }
  await signalPeers($, brain, reason === 'aborted' ? 'idle' : 'done')
  if (reason !== 'answer' || usage === undefined) {
    act(brain, direct.flinch(), PRIORITY.reaction)
    return
  }
  const income = capTokenIncome(turnIncome(usage), earnedTokenToday([...brain.otherEarns, brain.earn], today(brain)))
  brain.earn = { ...brain.earn, earned: brain.earn.earned + income }
  brain.earnings = [...brain.earnings, { durationMs, coins: income, at: brain.now }].slice(-20)
  remember(brain, 'turn', `${Math.round(durationMs / 1000)}s`, 0.5)
  count(brain, 'turn')
  if (income > 0) {
    act(brain, direct.earnCoins(income), PRIORITY.reaction)
  }
  if (durationMs >= 2 * MINUTE && !wasTyping) {
    act(brain, direct.greet(), PRIORITY.reaction)
    await quietLine($, brain, 'turnDone')
  }
  if (brain.bonk !== null && brain.bonk.isTurnRunning && !brain.bonk.hasApology && !brain.bonk.isSubmitted) {
    $.clock.after(1500, () => void submitBonk($, brain))
  }
  await sync($, brain)
}

export async function notifyOnce($: $, brain: Brain, text: string): Promise<void> {
  if (!canNotify(brain.budget, brain.settings, hourOf(brain.now))) {
    return
  }
  brain.budget = { ...brain.budget, notifications: brain.budget.notifications + 1 }
  try {
    await $.ui.notify(text, { title: nameOf(brain.pet) ?? 'Toko' })
  } catch {
    brain.isDirty = true
  }
}

export const COMEBACK_FAILURES = 3

export async function onTest($: $, brain: Brain, kind: 'test-fail' | 'test-pass', key: string, summary: string, failed: number | null = null): Promise<void> {
  const hadFailure = brain.memory.events.some(event => event.kind === 'test-fail' && event.detail.startsWith(key))
  const failures = failureStreak(brain.memory.events, key)
  remember(brain, kind, kind === 'test-fail' ? `${key} :: ${summary}` : key)
  count(brain, kind)
  if (kind === 'test-pass' && failures >= COMEBACK_FAILURES) {
    count(brain, 'comeback')
  }
  if (kind === 'test-fail') {
    if (failures + 1 >= BOSS_STREAK) {
      await showBoss($, brain, key, failed)
      return
    }
    act(brain, direct.worry(), PRIORITY.reaction)
    return
  }
  if (hadFailure) {
    brain.lastPassAfterFailAt = brain.now
    brain.memory = { ...brain.memory, events: brain.memory.events.filter(event => !(event.kind === 'test-fail' && event.detail.startsWith(key))) }
  }
  if (brain.boss?.key === key) {
    await defeatBoss($, brain, BOSS_REWARD)
    return
  }
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await quietLine($, brain, 'testPass')
}

async function showBoss($: $, brain: Brain, key: string, failed: number | null): Promise<void> {
  const isNew = brain.boss?.key !== key
  brain.boss = meetBoss(brain.boss, key, failed, brain.now)
  await update($, bossAtom, () => brain.boss)
  if (!isNew) {
    act(brain, direct.flinch(), PRIORITY.reaction)
    return
  }
  remember(brain, 'boss', brain.boss.name, 1)
  if (brain.scene !== null) {
    perform(brain.scene, direct.bossAppear(brain.scene), PRIORITY.event)
  }
  if (!isHushed(brain)) {
    await say($, brain, `${brain.boss.name} 등장! 테스트를 통과시켜서 물리치자`, 'quiet')
  }
}

async function defeatBoss($: $, brain: Brain, reward: number): Promise<void> {
  const boss = brain.boss
  if (boss === null) {
    return
  }
  brain.boss = null
  await update($, bossAtom, () => null)
  if (reward > 0) {
    healthReward(brain, reward)
  }
  remember(brain, 'boss-down', boss.name, 1.5)
  if (brain.scene !== null) {
    perform(brain.scene, direct.bossDefeat(brain.scene), PRIORITY.event)
  }
  if (!isHushed(brain)) {
    await say($, brain, reward > 0 ? `${boss.name} 격파! +${reward} 코인` : `${boss.name} 격파!`, 'quiet')
  }
}

export async function demoBoss($: $, brain: Brain): Promise<string> {
  if (brain.boss === null) {
    await showBoss($, brain, 'demo', 5)
    return `${bossStatus(brain.boss ?? meetBoss(null, 'demo', 5, brain.now))}. 한 번 더 하면 체력이 줄어요.`
  }
  if ((brain.boss.hp ?? 0) > 2) {
    await showBoss($, brain, brain.boss.key, 2)
    return `${bossStatus(brain.boss)}. 한 번 더 하면 쓰러뜨려요.`
  }
  await defeatBoss($, brain, 0)
  return '보스를 쓰러뜨렸어요. 시연이라 코인은 주지 않아요.'
}

export async function onGit($: $, brain: Brain, kind: 'commit' | 'push' | 'pr', detail: string): Promise<void> {
  remember(brain, kind, detail, 1.5)
  count(brain, kind)
  if (kind === 'commit') {
    queueTip(brain, 'code-review')
  } else {
    dropTip(brain, 'code-review')
  }
  if (kind === 'pr') {
    jot(brain, `PR ${detail}`)
    if (detail.endsWith(' merged')) {
      count(brain, 'merge')
    }
  }
  act(brain, direct.flag(), PRIORITY.reaction)
  if (kind === 'commit' && brain.marks.firstCommitDay !== today(brain)) {
    brain.marks = { ...brain.marks, firstCommitDay: today(brain) }
    brain.wallet = { ...brain.wallet, items: [...brain.wallet.items, 'cookie'] }
    await quietLine($, brain, 'firstCommit')
    return
  }
  await quietLine($, brain, 'commit')
}

export const onPermission = (brain: Brain, key: string): void => {
  const asks = (brain.permissionAsks[key] ?? 0) + 1
  brain.permissionAsks = { ...brain.permissionAsks, [key]: asks }
  if (asks >= PERMISSION_TIP_ASKS) {
    queueTip(brain, 'permissions')
  }
}

export const onCheckPrompt = (brain: Brain): void => {
  brain.checkPrompts = [...brain.checkPrompts.filter(at => brain.now - at < CHECK_TIP_WINDOW_MS), brain.now]
  if (brain.checkPrompts.length >= CHECK_TIP_PROMPTS) {
    queueTip(brain, 'loop')
  }
}

export async function checkInit($: $, brain: Brain): Promise<void> {
  const repo = await $.session.repo().catch(() => null)
  if (repo === null) {
    return
  }
  const found = await Promise.all([`${repo.root}/CLAUDE.md`, `${repo.root}/.claude/CLAUDE.md`].map(path => $.fs.exists(path).catch(() => true)))
  if (!found.includes(true)) {
    queueTip(brain, 'init')
  }
}

export const onSubagents = (brain: Brain, shadows: number): void => {
  act(brain, direct.subagentShadows(shadows), PRIORITY.reaction)
}

export const onEdit = (brain: Brain, added: number, removed: number): void => {
  count(brain, 'added', added)
  count(brain, 'removed', removed)
}

export async function onMeasure($: $, brain: Brain, contextPercent: number | undefined, limits: readonly Limit[], costUsd: number | undefined): Promise<void> {
  brain.rateLimitPercent = limits.reduce((max, limit) => Math.max(max, limit.percentUsed), 0)
  brain.meter = meterOf(contextPercent, costUsd, limits)
  await update($, meterAtom, () => brain.meter)
  if (costUsd !== undefined) {
    brain.lastCostUsd = costUsd
    brain.tally = { ...brain.tally, costUsd: Math.max(0, costUsd - brain.costBase) }
    brain.isDirty = true
  }
  if (contextPercent !== undefined && contextPercent >= COMPACT_TIP_PERCENT) {
    queueTip(brain, 'compact')
  }
  if (contextPercent !== undefined && contextPercent >= 85 && !brain.isFullShown) {
    brain.isFullShown = true
    act(brain, direct.full(), PRIORITY.reaction)
    await quietLine($, brain, 'full')
  }
  if (contextPercent !== undefined && contextPercent < 50) {
    brain.isFullShown = false
  }
}

export async function onAttention($: $, brain: Brain): Promise<void> {
  act(brain, direct.greet(), PRIORITY.reaction)
  await quietLine($, brain, 'permission')
}

export async function onTyping($: $, brain: Brain): Promise<void> {
  const awayMinutes = (brain.now - Math.max(brain.lastInputAt, brain.lastTypingAt)) / MINUTE
  brain.lastTypingAt = brain.now
  if (brain.isTurnRunning) {
    brain.typedDuringTurn = true
  }
  if (awayMinutes >= 10) {
    brain.returnedAway = { minutes: awayMinutes, at: brain.now }
    brain.workingSince = brain.now
    act(brain, direct.greet(), PRIORITY.reaction)
    await quietLine($, brain, 'welcomeBack')
  }
}

const hourFactor = (brain: Brain): number => {
  const slot = brain.memory.answersByHour[hourOf(brain.now)]
  return slot !== undefined && slot.declined >= 2 && slot.declined > slot.accepted * 2 ? 0.4 : 1
}

const contextOf = (brain: Brain) => {
  const now = brain.now
  const minutesSince = (at: number): number => (at === 0 ? 999 : (now - at) / MINUTE)
  const failKeys = brain.memory.events.filter(event => event.kind === 'test-fail').map(event => event.detail.split(' :: ')[0] ?? '')
  const failStreak = failKeys.length === 0 ? 0 : failKeys.filter(key => key === failKeys.at(-1)).length
  const factor = hourFactor(brain)
  const kindScale = Object.fromEntries([...BREAK_KINDS].map(kind => [kind, (brain.memory.kindScale[kind] ?? 1) * factor]))
  return {
    now,
    hour: hourOf(now),
    needs: brain.needs,
    traits: brain.pet?.soul?.traits ?? { energetic: 0.5, chatty: 0.5, worried: 0.5, playful: 0.5 },
    breakMinutes: brain.settings.breakMinutes,
    workingMinutes: (now - brain.workingSince) / MINUTE,
    minutesSinceEyeRest: minutesSince(brain.marks.lastEyeRestAt || brain.workingSince),
    minutesSinceWater: minutesSince(brain.marks.lastWaterAt || brain.workingSince),
    minutesSinceChat: minutesSince(brain.marks.lastChatAt || brain.workingSince),
    waterToday: brain.budget.water,
    giftsToday: brain.budget.gifts,
    giftQuota: 1 + ((brain.pet?.bones.seed ?? 0) + new Date(now).getDate()) % 2,
    failStreak,
    minutesSincePassAfterFail: brain.lastPassAfterFailAt === null ? null : minutesSince(brain.lastPassAfterFailAt),
    bonksToday: brain.budget.bonks,
    hasCalmedToday: brain.marks.calmedDay === today(brain),
    awayMinutes: brain.returnedAway !== null && now - brain.returnedAway.at < 5 * MINUTE ? brain.returnedAway.minutes : 0,
    hasWorkMemory: workMemoryFacts(brain).length > 0,
    offWorkHour: brain.settings.offWorkHour,
    hasWrappedToday: brain.marks.wrappedDay === today(brain),
    rateLimitPercent: brain.rateLimitPercent,
    friendsOnline: brain.friends.filter(friend => now - friend.lastSeen < FRIEND_TTL_MS).length,
    kindScale: { ...brain.memory.kindScale, ...kindScale },
    luck: brain.random(),
  }
}

export const MIN_SCORE = 6

export async function decide($: $, brain: Brain, candidates: readonly Candidate[]): Promise<{ kind: string; line: string } | null> {
  const top = candidates[0]
  if (top === undefined || top.score < MIN_SCORE) {
    return null
  }
  const soul = brain.pet?.soul
  const reply =
    soul === null || soul === undefined
      ? null
      : await ask($, brain, persona.intentPrompt({ soul, candidates, mood: brain.mood, needs: brain.needs, events: brain.memory.events, lessons: brain.memory.lessons, clock: clockText(brain.now) }), 120)
  if (reply === null) {
    return { kind: top.kind, line: fallbackLine(brain.random, OFFER_FALLBACK, top.kind, speciesOf(brain)) }
  }
  const intent = persona.parseIntent(reply, candidates)
  if (intent === null) {
    return { kind: top.kind, line: fallbackLine(brain.random, OFFER_FALLBACK, top.kind, speciesOf(brain)) }
  }
  if (intent.intent === 'stay_quiet') {
    return null
  }
  return { kind: intent.intent, line: intent.line ?? fallbackLine(brain.random, OFFER_FALLBACK, intent.intent, speciesOf(brain)) }
}

export async function think($: $, brain: Brain): Promise<void> {
  if (!brain.isLoaded || brain.pet === null || brain.pet.growth.stage === 'egg') {
    return
  }
  const now = brain.now
  const hour = hourOf(now)
  brain.needs = decayNeeds(brain.needs, now, now - Math.max(brain.lastInputAt, brain.lastTypingAt) < 10 * MINUTE, cozinessOf(layoutOf(brain.wallet)))
  brain.mood = moodOf(brain.needs, brain.memory.events, now, hour, brain.budget.bonks)
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  if (brain.offer !== null && brain.offer.kind !== 'name' && now >= brain.offer.expiresAt) {
    await answerOffer($, brain, 'ignored')
  }
  await finishCountdown($, brain)
  await finishFocus($, brain)
  await stepGame($, brain)
  await watchLongTurn($, brain)
  await maybeEncounter($, brain)
  await checkProgress($, brain)
  if (brain.offer?.isQuiet === true && canSpeak(presenceOf(brain), brain.settings, hour) && isGap(presenceOf(brain))) {
    brain.offer = { ...brain.offer, isQuiet: false }
    await update($, offerAtom, () => brain.offer)
    await say($, brain, brain.offer.line)
  }
  if (brain.isThinking || brain.offer !== null || brain.countdown !== null || brain.game !== null || isBonking(brain) || isFocusing(brain)) {
    return
  }
  const presence = presenceOf(brain)
  if (!canSpeak(presence, brain.settings, hour) || !isGap(presence)) {
    return
  }
  if (isAwaitingName(brain.pet)) {
    await askName($, brain)
    return
  }
  if (brain.focusDoneMinutes !== null) {
    const minutes = brain.focusDoneMinutes
    brain.focusDoneMinutes = null
    await openOffer($, brain, 'focus-break', `${minutes}분 집중 끝! +${HEALTH_REWARD.focusDone} 코인. 기지개 켜고 올래?`)
    return
  }
  const memo = dueMemo(brain.memos, now, brain.lastTurnEndAt)
  if (memo !== undefined) {
    brain.memoOfferId = memo.id
    await openOffer($, brain, 'memo', `아까 맡긴 메모: ${clipMemo(memo.text, 40)}`)
    return
  }
  if (isNewsDue(brain.news, now) && hasBubbleRoom(brain) && (await showNews($, brain))) {
    return
  }
  const tip = brain.tipQueue.find(id => isTipFresh(brain, id))
  if (tip !== undefined && hasBubbleRoom(brain) && (await showTip($, brain, tip))) {
    return
  }
  const candidates = gateCandidates(candidatesOf(contextOf(brain)), brain.budget, brain.settings, now)
  if (candidates.length === 0) {
    return
  }
  brain.isThinking = true
  try {
    const decision = await decide($, brain, candidates)
    if (decision !== null && brain.offer === null && !brain.isTurnRunning) {
      await openOffer($, brain, decision.kind, decision.line)
    }
  } finally {
    brain.isThinking = false
  }
}

async function watchLongTurn($: $, brain: Brain): Promise<void> {
  if (!brain.isTurnRunning) {
    return
  }
  const elapsed = brain.now - brain.turnStartedAt
  if (elapsed >= MINUTE && brain.longTurnStage === 0) {
    brain.longTurnStage = 1
    if (canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion) && brain.countdown === null && !isBonking(brain) && !isFocusing(brain)) {
      act(brain, direct.eyeRest(20_000), PRIORITY.encounter)
      await startCountdown($, brain, { kind: 'quiet-eye', label: '기다리는 동안 먼 곳 보기', endsAt: brain.now + 20_000, reward: 0, then: 'quiet' })
    }
  }
  if (elapsed >= 2 * MINUTE && brain.longTurnStage === 1) {
    brain.longTurnStage = 2
    act(brain, [{ pose: 'yawn', ms: 1200 }], PRIORITY.reaction)
  }
}

async function maybeEncounter($: $, brain: Brain): Promise<void> {
  const scene = brain.scene
  if (scene === null || isBusy(scene) || brain.offer !== null || brain.game !== null || isBonking(brain) || isFocusing(brain) || isAwaitingName(brain.pet)) {
    return
  }
  if (!canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion)) {
    return
  }
  const isIdle = brain.now - Math.max(brain.lastTypingAt, brain.lastInputAt) >= 30_000
  if (!brain.isTurnRunning && !isIdle) {
    return
  }
  const options = encounterOf({
    hour: hourOf(brain.now),
    mood: brain.mood,
    isWorking: brain.isTurnRunning,
    minutesSinceEncounter: (brain.now - brain.lastEncounterAt) / MINUTE,
    luck: brain.random(),
  })
  if (options.length === 0 || brain.random() > 0.35) {
    return
  }
  if (isInSeason('halloween', today(brain)) && brain.random() < HALLOWEEN_CHANCE) {
    await runHalloween($, brain)
    return
  }
  const kind = pickWeighted(brain.random, options)
  if (kind === null) {
    return
  }
  await runEncounter($, brain, kind, brain.random() < SHINY_CHANCE)
}

export const HALLOWEEN_CHANCE = 0.4

export async function runHalloween($: $, brain: Brain): Promise<void> {
  brain.lastEncounterAt = brain.now
  remember(brain, 'encounter', 'halloween', 0.3)
  count(brain, 'encounter')
  if (brain.scene !== null) {
    act(brain, direct.halloween(brain.scene, brain.random), PRIORITY.encounter)
  }
  if (isHushed(brain)) {
    return
  }
  const hasHat = brain.wallet.items.includes(SEASONS.halloween.item)
  await say($, brain, hasHat ? pick(brain.random, HALLOWEEN_LINES) : '할로윈이야! 11월 1일까지 패션 뽑기에서 호박 모자가 나와', 'quiet')
}

async function noteSighting($: $, brain: Brain, kind: EncounterKind, isShiny: boolean): Promise<Sighting> {
  const sighting = recordSighting(mergeDex(asDex(await $.store.get(KEY.dex)), brain.dex), kind, isShiny, brain.now)
  brain.dex = sighting.dex
  await $.store.set(KEY.dex, brain.dex)
  return sighting
}

export async function noteFeature($: $, brain: Brain, id: string): Promise<void> {
  const def = featureDef(id)
  if (def === undefined || brain.features[id] !== undefined) {
    return
  }
  const stored = mergeFeatureDex(asFeatureDex(await $.store.get(KEY.features)), brain.features)
  brain.features = stored[id] === undefined ? { ...stored, [id]: brain.now } : stored
  await $.store.set(KEY.features, brain.features)
  if (stored[id] !== undefined) {
    return
  }
  healthReward(brain, FEATURE_REWARD)
  remember(brain, 'feature', id, 0.5)
  brain.isProgressDirty = true
  act(brain, direct.perk(), PRIORITY.reaction)
  if (!isHushed(brain)) {
    await say($, brain, featureLine(def, featuresUsed(brain.features), FEATURE_REWARD), 'quiet')
  }
}

export async function runEncounter($: $, brain: Brain, kind: EncounterKind, isShiny: boolean): Promise<void> {
  brain.lastEncounterAt = brain.now
  remember(brain, 'encounter', kind, 0.3)
  count(brain, 'encounter')
  if (isShiny) {
    count(brain, 'shiny')
  }
  if (brain.scene !== null) {
    act(brain, [...(isShiny ? direct.shimmer() : []), ...direct.encounter(brain.scene, kind, brain.random)], PRIORITY.encounter)
  }
  const sighting = await noteSighting($, brain, kind, isShiny)
  const reward = (sighting.isNew ? DEX_REWARD.first : 0) + (sighting.isNewShiny ? DEX_REWARD.shiny : 0)
  if (reward > 0) {
    healthReward(brain, reward)
  }
  if (isHushed(brain)) {
    return
  }
  if (reward > 0) {
    await say($, brain, sightingLine(kind, sighting, kindsSeen(brain.dex), reward), 'quiet')
    return
  }
  if ((brain.pet?.soul?.traits.chatty ?? 0) >= 0.5 || kind === 'bubbles' || kind === 'firefly') {
    await say($, brain, pick(brain.random, ENCOUNTER_LINES[kind]), 'quiet')
  }
}

export const plazaStatus = (brain: Brain): PlazaStatus => {
  if (brain.countdown !== null && brain.countdown.then !== 'quiet') {
    return 'resting'
  }
  if (brain.now - Math.max(brain.lastInputAt, brain.lastTypingAt) >= 10 * MINUTE) {
    return 'away'
  }
  return brain.isTurnRunning ? 'working' : 'idle'
}

const plazaMe = (brain: Brain) => ({
  id: brain.plazaId,
  tab: brain.plazaTab,
  name: nameOf(brain.pet) ?? '알',
  color: wireColor(brain.pet?.bones.species ?? 'cat'),
  species: brain.pet?.bones.species ?? 'cat',
  mood: brain.mood,
  status: plazaStatus(brain),
  sprite: lookSprite(lookOf(brain)),
  wear: { hat: wornOf(brain.wallet, 'hat'), neck: wornOf(brain.wallet, 'neck'), face: wornOf(brain.wallet, 'face'), back: wornOf(brain.wallet, 'back'), hand: wornOf(brain.wallet, 'hand') },
  doing: doingLine(brain),
  room: brain.settings.isRoomOpen ? layoutOf(brain.wallet) : {},
  isRoomOpen: brain.settings.isRoomOpen,
  roomPicture: brain.scene === null || !brain.settings.isRoomOpen ? null : roomPicture(brain.scene.palette, { layout: layoutOf(brain.wallet), hour: hourOf(brain.now), stickers: brain.stickers, trophies: Object.keys(brain.badges).length }),
})

export const isPlazaReady = (brain: Brain): boolean =>
  brain.settings.isPlazaOn && brain.serverUrl.length > 0 && nameOf(brain.pet) !== null

export async function pollPlaza($: $, brain: Brain): Promise<void> {
  if (!isPlazaReady(brain)) {
    return
  }
  const me = plazaMe(brain)
  const report = JSON.stringify(me)
  const isDue = brain.plazaStream === 'live' ? report !== brain.lastPlazaReport : brain.now - brain.lastPollAt >= PLAZA_POLL_MS
  if (!isDue) {
    return
  }
  brain.lastPollAt = brain.now
  const url = plazaEndpoint(brain.serverUrl, '/v1/poll')
  if (url === null) {
    return
  }
  try {
    const response = await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ me, since: brain.lastPollAt - PLAZA_POLL_MS * 2 }) })
    const snapshot = response.ok ? parseSnapshot(response.text, brain.plazaId) : null
    if (snapshot === null) {
      return
    }
    brain.lastPlazaReport = report
    await takeSnapshot($, brain, snapshot)
  } catch {
    await update($, plazaAtom, () => ({ isOnline: false, friends: [], feed: brain.feed }))
  }
}

async function takeSnapshot($: $, brain: Brain, snapshot: PlazaSnapshot): Promise<void> {
  const isFirstHere = brain.joiningChannel !== null && snapshot.channel === brain.joiningChannel
  brain.friends = snapshot.friends
  brain.plazaBonks = snapshot.bonks
  keepChannels(brain, snapshot)
  const before = brain.plazaWeather
  brain.plazaWeather = snapshot.weather
  if (snapshot.weather?.level === 'festival' && before !== null && before.level !== 'festival' && !isHushed(brain)) {
    await say($, brain, FESTIVAL_LINE, 'quiet')
  }
  const fresh = snapshot.events.filter(event => !brain.seenEvents.includes(event.id) && isForMe(event, brain.plazaId))
  const heard = isFirstHere ? fresh.filter(event => event.to !== null) : fresh
  if (isFirstHere) {
    brain.joiningChannel = null
  }
  brain.seenEvents = [...brain.seenEvents, ...fresh.map(event => event.id)].slice(-200)
  for (const event of heard) {
    await receivePlaza($, brain, event)
  }
  if (snapshot.home !== null) {
    keepHome(brain, snapshot.home)
    await takeGifts($, brain, snapshot.home.gifts)
  }
  await update($, plazaAtom, () => plazaViewOf(brain, true))
}

const keepChannels = (brain: Brain, info: PlazaChannelInfo): void => {
  brain.plazaChannel = info.channel
  brain.plazaChannels = info.channels
  brain.plazaChannelSize = info.channelSize
}

const plazaViewOf = (brain: Brain, isOnline: boolean) => ({ isOnline, friends: brain.friends, feed: brain.feed, guests: brain.guests, away: brain.away })

const keepHome = (brain: Brain, home: PlazaHome): void => {
  brain.guests = home.guests
  brain.away = home.away
  brain.stickers = home.stickers
  if (brain.viewing !== null && brain.away?.host !== brain.viewing.host) {
    brain.viewing = null
  }
}

export function openPlazaStream($: $, brain: Brain): void {
  if (brain.plazaStream !== 'off' || !isPlazaReady(brain)) {
    return
  }
  brain.plazaStream = 'connecting'
  void listenPlaza($, brain).catch(() => {
    brain.plazaStream = 'off'
  })
}

async function listenPlaza($: $, brain: Brain): Promise<void> {
  let failures = 0
  while (isPlazaReady(brain)) {
    const url = plazaStreamUrl(brain.serverUrl, brain.plazaId, brain.plazaTab)
    if (url === null) {
      break
    }
    const openedAt = brain.now
    try {
      await readPlazaStream($, brain, url)
    } catch {
      if (brain.plazaStream !== 'live') {
        brain.plazaStream = 'unsupported'
        return
      }
    }
    brain.plazaStream = 'connecting'
    failures = brain.now - openedAt >= STREAM_STEADY_MS ? 0 : failures + 1
    await $.clock.sleep(Math.min(STREAM_RETRY_MAX_MS, 1000 * 2 ** failures))
  }
  brain.plazaStream = 'off'
}

async function readPlazaStream($: $, brain: Brain, url: string): Promise<void> {
  let rest = ''
  for await (const piece of $.process.spawn({ argv: ['curl', '-sfN', '--max-time', '900', '-H', 'accept: text/event-stream', url] })) {
    if (piece.stream !== 'stdout') {
      continue
    }
    if (brain.plazaStream !== 'live') {
      brain.plazaStream = 'live'
      brain.lastPlazaReport = ''
    }
    const split = splitEvents(rest + piece.text)
    rest = split.rest
    for (const data of split.data) {
      const snapshot = parseSnapshot(data, brain.plazaId)
      if (snapshot !== null) {
        await takeSnapshot($, brain, snapshot)
      }
    }
    if (!isPlazaReady(brain)) {
      break
    }
  }
}

async function receivePlaza($: $, brain: Brain, event: PlazaEvent): Promise<void> {
  brain.feed = [...brain.feed, { at: brain.now, text: eventText(event) }].slice(-12)
  if (event.kind === 'join' || event.kind === 'leave') {
    return
  }
  if (event.kind === 'sticker' || event.kind === 'gift') {
    remember(brain, event.kind, event.from.name, 1)
    brain.needs = restore(brain.needs, { social: 8 })
    act(brain, direct.greet(), PRIORITY.reaction)
    if (!isHushed(brain) && event.kind === 'sticker') {
      await say($, brain, `${event.from.name}이(가) 다녀갔어! 방에 스티커를 붙이고 갔어`, 'quiet')
    }
    return
  }
  if (event.kind === 'visit' || event.kind === 'home' || event.kind === 'room-act') {
    await receiveRoom($, brain, event)
    return
  }
  remember(brain, 'friend-wave', event.from.name, 1)
  brain.needs = restore(brain.needs, { social: 8, hunger: event.kind === 'snack' ? 15 : 0 })
  if (brain.scene !== null && !isBusy(brain.scene) && canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion)) {
    act(brain, event.kind === 'snack' ? direct.feed() : direct.friendVisit(event.from.id, event.from.species, visitTiming(brain.scene), event.from.wear), PRIORITY.encounter)
  }
  if (!isHushed(brain)) {
    await say($, brain, eventText(event).slice(0, 60), 'quiet')
  }
  brain.visitor = visitorOf(event, brain.now)
  brain.visitorVisibleMs = 0
  await update($, visitorAtom, () => brain.visitor)
}

export const WAIT_BUDDY_AFTER_MS = 30_000
export const WAIT_BUDDY_COOLDOWN_MS = 10 * MINUTE

export async function tendWaitBuddy($: $, brain: Brain): Promise<void> {
  const isDue =
    brain.isTurnRunning && brain.now - brain.turnStartedAt >= WAIT_BUDDY_AFTER_MS && brain.waitBuddyAt < brain.turnStartedAt && brain.now - brain.waitBuddyAt >= WAIT_BUDDY_COOLDOWN_MS
  if (!isDue || brain.visitor !== null || !isPlazaReady(brain)) {
    return
  }
  const waiting = brain.friends.filter(friend => friend.status === 'working' && brain.now - friend.lastSeen < FRIEND_TTL_MS)
  const friend = waiting[Math.floor(brain.random() * waiting.length)]
  if (friend === undefined) {
    return
  }
  brain.waitBuddyAt = brain.now
  brain.needs = restore(brain.needs, { social: 5 })
  if (brain.scene !== null && !isBusy(brain.scene) && canAnimateQuietly(brain.settings, hourOf(brain.now), brain.isReducedMotion)) {
    act(brain, direct.friendVisit(friend.id, friend.species, visitTiming(brain.scene), {}), PRIORITY.encounter)
  }
  brain.visitor = { name: friend.name, species: friend.species, kind: 'wait', line: '', at: brain.now }
  brain.visitorVisibleMs = 0
  await update($, visitorAtom, () => brain.visitor)
}

export async function tendVisitor($: $, brain: Brain, elapsedMs: number): Promise<void> {
  if (brain.visitor === null) {
    return
  }
  if (brain.isTurnRunning) {
    brain.visitorVisibleMs += elapsedMs
  }
  if (shouldDismissVisitor(brain.visitor, brain.visitorVisibleMs, brain.now)) {
    brain.visitor = null
    await update($, visitorAtom, () => null)
  }
}

const signalKey = (brain: Brain): string => `${KEY.signalPrefix}${brain.sessionId}`

async function aiTitleOf($: $, path: string): Promise<string> {
  if (path === '') {
    return ''
  }
  try {
    const { stdout } = await $.process.run(['grep', '-F', '"type":"ai-title"', path], { timeoutMs: 2000 })
    return lastAiTitle(stdout)
  } catch {
    return ''
  }
}

const inboxKeyPrefix = (sessionId: string): string => `${KEY.inboxPrefix}${sessionId}:`

const replyKeyPrefix = (sessionId: string): string => `${KEY.replyPrefix}${sessionId}:`

export async function signalPeers($: $, brain: Brain, kind: PeerSignal['kind']): Promise<void> {
  const aiTitle = brain.sessionTitle === '' ? await aiTitleOf($, brain.transcriptPath) : ''
  const label = brain.sessionTitle !== '' ? brain.sessionTitle : aiTitle !== '' ? aiTitle : brain.promptLabel
  await writeSignal($, brain, { kind, at: brain.now, label, since: brain.signal?.since ?? brain.now })
}

async function writeSignal($: $, brain: Brain, signal: PeerSignal): Promise<void> {
  brain.signal = { ...signal, aliveAt: brain.now, prompt: brain.promptLabel, path: brain.transcriptPath, turnStartedAt: brain.turnStartedAt }
  await $.store.set(signalKey(brain), brain.signal)
}

export async function forgetSignal($: $, brain: Brain): Promise<void> {
  await $.store.delete(signalKey(brain))
  const own = (await $.store.keys()).filter(key => key.startsWith(inboxKeyPrefix(brain.sessionId)) || key.startsWith(replyKeyPrefix(brain.sessionId)))
  await Promise.all(own.map(key => $.store.delete(key)))
}

async function listPeers($: $, brain: Brain): Promise<readonly Peer[]> {
  const keys = (await $.store.keys()).filter(key => key.startsWith(KEY.signalPrefix))
  const entries = await Promise.all(keys.map(async key => ({ key, value: await $.store.get(key) })))
  return peerList(entries, signalKey(brain), brain.now)
}

export async function peersText($: $, brain: Brain): Promise<string> {
  count(brain, 'sessions')
  return sessionsText(await listPeers($, brain), brain.now)
}

const TRANSCRIPT_TAIL_BYTES = 200_000

async function excerptOf($: $, path: string): Promise<string> {
  const tail = await $.process
    .run(['tail', '-c', String(TRANSCRIPT_TAIL_BYTES), path], { timeoutMs: 2000 })
    .then(result => result.stdout)
    .catch(() => '')
  return transcriptExcerpt(tail)
}

export async function noteWorked($: $, brain: Brain, answer: string): Promise<void> {
  if (answer.trim() === '') {
    return
  }
  const key = `${KEY.workedPrefix}${brain.sessionId}`
  const day = today(brain)
  const stored = brain.worked ?? (await $.store.get(key))
  const session = isWorked(stored) && stored.day === day ? stored : { day, label: '', since: brain.now, turns: [] }
  brain.worked = addTurn({ ...session, label: brain.signal?.label ?? session.label }, brain.turnText, answer)
  await $.store.set(key, brain.worked)
}

export async function todayWork($: $, brain: Brain): Promise<string> {
  const keys = (await $.store.keys()).filter(key => key.startsWith(KEY.workedPrefix))
  const sessions = (await Promise.all(keys.map(key => $.store.get(key))))
    .filter(isWorked)
    .filter(session => session.day === today(brain) && session.turns.length > 0)
    .sort((a, b) => a.since - b.since)
  const blocked = !brain.settings.isAiOn ? '작은 모델이 꺼져 있어서' : brain.budget.aiCalls >= brain.settings.aiDailyCalls ? '오늘 작은 모델 한도를 다 써서' : null
  const reply = sessions.length === 0 ? null : await askForUser($, brain, persona.workDayPrompt(sessions), 900, 60_000, persona.peerSummarySystem)
  count(brain, 'today')
  return workText(brain.now, sessions, reply, blocked ?? (reply === null ? '작은 모델이 시간 안에 답하지 못해서' : '작은 모델 답을 읽지 못해서'))
}

export async function peerMatches($: $, brain: Brain, query: string): Promise<readonly Peer[]> {
  return matchPeers(await listPeers($, brain), query)
}

export async function summarizePeer($: $, brain: Brain, query: string): Promise<string> {
  const matches = await peerMatches($, brain, query)
  const peer = matches[0]
  if (matches.length !== 1 || peer === undefined) {
    return missText(matches)
  }
  return summarizeOne($, brain, peer)
}

async function summarizeOne($: $, brain: Brain, peer: Peer): Promise<string> {
  count(brain, 'sessions')
  const header = sessionLine(peer.signal, brain.now)
  const path = peer.signal.path ?? ''
  if (path === '') {
    return `${header}\n대화 기록 위치를 몰라서 요약은 못 했어요.`
  }
  const excerpt = await excerptOf($, path)
  if (excerpt === '') {
    return `${header}\n요약할 대화가 아직 없어요.`
  }
  const reply = await askForUser($, brain, persona.peerSummaryPrompt(peer.signal.label, peer.signal.kind, excerpt), 400, 8000, persona.peerSummarySystem)
  const lines = (reply ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .slice(0, 3)
  return lines.length === 0 ? `${header}\n요약은 못 했어요(작은 모델을 쓸 수 없어요).` : [header, ...lines].join('\n')
}

const messageId = (brain: Brain): string => `${brain.now.toString(36)}${Math.floor(brain.random() * 1296).toString(36)}`

export async function fillSend($: $, brain: Brain, query: string, text: string): Promise<string> {
  const matches = await peerMatches($, brain, query)
  const peer = matches[0]
  if (matches.length !== 1 || peer === undefined) {
    return missText(matches)
  }
  const command = `/toko send ${query} ${text}`
  const box = await $.prompt.read()
  const filled = box.text.trim() === '' ? await $.prompt.fill({ text: command, mode: 'replace' }) : { isFilled: false }
  return filled.isFilled
    ? `입력창에 넣어 뒀어요. 엔터를 누르면 ${sessionName(peer.signal)}에 보내요.`
    : `입력창에 넣지 못했어요. \`${command}\` 를 치면 ${sessionName(peer.signal)}에 보내요.`
}

export async function sendToPeer($: $, brain: Brain, query: string, text: string): Promise<string> {
  const matches = await peerMatches($, brain, query)
  const peer = matches[0]
  if (matches.length !== 1 || peer === undefined) {
    return missText(matches)
  }
  const sessionId = peer.key.slice(KEY.signalPrefix.length)
  await $.store.set(`${inboxKeyPrefix(sessionId)}${messageId(brain)}`, { text, from: brain.signal?.label ?? '', at: brain.now, replyTo: brain.sessionId })
  count(brain, 'send')
  return `${sessionName(peer.signal)}에 보냈어요. 그 세션이 하던 일을 끝내고 입력창이 비면 바로 들어가요.`
}

export function noteTurnText(brain: Brain, text: string): void {
  brain.turnText = text
  brain.replyTo = brain.peerTurn !== null && brain.peerTurn.text === text ? brain.peerTurn.to : null
  brain.peerTurn = null
}

export async function replyToPeer($: $, brain: Brain, answer: string): Promise<void> {
  const to = brain.replyTo
  brain.replyTo = null
  if (to === null || answer.trim() === '') {
    return
  }
  await $.store.set(`${replyKeyPrefix(to)}${messageId(brain)}`, { text: answer, from: brain.signal?.label ?? '', at: brain.now })
}

async function deliverReplies($: $, brain: Brain): Promise<void> {
  const keys = (await $.store.keys()).filter(key => key.startsWith(replyKeyPrefix(brain.sessionId)))
  const entries = await Promise.all(keys.map(async key => ({ key, value: await $.store.get(key) })))
  const replies = entries.flatMap(entry => (isMessage(entry.value) ? [{ key: entry.key, message: entry.value }] : [])).sort((a, b) => a.message.at - b.message.at)
  for (const { key, message } of replies) {
    await $.store.delete(key)
    for (const line of replyLines(message.from, message.text)) {
      $.ui.log(line)
    }
  }
}

async function deliverInbox($: $, brain: Brain): Promise<void> {
  if (brain.isTurnRunning) {
    return
  }
  const keys = (await $.store.keys()).filter(key => key.startsWith(inboxKeyPrefix(brain.sessionId)))
  const entries = await Promise.all(keys.map(async key => ({ key, value: await $.store.get(key) })))
  const next = entries.flatMap(entry => (isMessage(entry.value) ? [{ key: entry.key, message: entry.value }] : [])).sort((a, b) => a.message.at - b.message.at)[0]
  if (next === undefined) {
    return
  }
  const box = await $.prompt.read()
  if (box.text.trim() !== '') {
    return
  }
  const { text, from, replyTo } = next.message
  await $.store.delete(next.key)
  brain.peerTurn = replyTo === undefined ? null : { text, to: replyTo }
  void $.prompt.submit({ text, asUser: true }).catch(() => $.store.set(next.key, next.message))
  act(brain, direct.greet(), PRIORITY.reaction)
  if (!isHushed(brain)) {
    const parts = inboxParts(from, speciesOf(brain))
    await say($, brain, parts.map(part => part.text).join(''), 'say', parts)
  }
}

export async function pollPeers($: $, brain: Brain): Promise<void> {
  if (brain.signal !== null && brain.now - (brain.signal.aliveAt ?? 0) >= HEARTBEAT_MS) {
    await writeSignal($, brain, brain.signal)
  }
  await deliverInbox($, brain)
  await deliverReplies($, brain)
  const keys = (await $.store.keys()).filter(key => key.startsWith(KEY.signalPrefix))
  const entries = await Promise.all(keys.map(async key => ({ key, value: await $.store.get(key) })))
  const signal = freshSignal(entries, signalKey(brain), brain.peersSeenAt)
  if (signal === null) {
    await remindPeer($, brain, entries)
    return
  }
  brain.peersSeenAt = signal.at
  if (!brain.settings.isPeersOn || isHushed(brain)) {
    return
  }
  const parts = signalParts(signal, speciesOf(brain))
  const line = parts.map(part => part.text).join('')
  if (brain.offer === null) {
    await openOffer($, brain, 'peer', line, parts, entries.find(entry => entry.value === signal)?.key)
    return
  }
  await say($, brain, line, 'say', parts)
}

const remindedKey = (peerKey: string): string => `${KEY.remindedPrefix}${peerKey.slice(KEY.signalPrefix.length)}`

async function remindPeer($: $, brain: Brain, entries: readonly { key: string; value: unknown }[]): Promise<void> {
  if (!brain.settings.isPeersOn || isHushed(brain) || brain.offer !== null) {
    return
  }
  const peers = peerList(entries, signalKey(brain), brain.now)
  const handled = new Map(await Promise.all(peers.map(async peer => [peer.key, await $.store.get(remindedKey(peer.key))] as const)))
  const peer = leftAlone(peers, candidate => handled.get(candidate.key) === candidate.signal.at, brain.now)
  if (peer === null) {
    return
  }
  await $.store.set(remindedKey(peer.key), peer.signal.at)
  const parts = reminderParts(peer.signal, brain.now, speciesOf(brain))
  await openOffer($, brain, 'peer', parts.map(part => part.text).join(''), parts, peer.key)
}

async function answerPeer($: $, brain: Brain, choice: string, key: string): Promise<void> {
  if (choice !== 'summary' && choice !== 'next' && choice !== 'later') {
    return
  }
  const peers = await listPeers($, brain)
  const peer = peers.find(candidate => candidate.key === key)
  if (peer !== undefined) {
    await $.store.set(remindedKey(peer.key), peer.signal.at)
  }
  if (choice === 'later') {
    return
  }
  if (peer === undefined) {
    await say($, brain, '그 세션이 이제 안 보여')
    return
  }
  if (choice === 'summary') {
    for (const line of (await summarizeOne($, brain, peer)).split('\n')) {
      $.ui.log(line)
    }
    return
  }
  const box = await $.prompt.read()
  const command = `/toko send ${sendTarget(peers, peer)} `
  const filled = box.text.trim() === '' ? await $.prompt.fill({ text: command, mode: 'replace' }) : { isFilled: false }
  await say($, brain, filled.isFilled ? '입력창에 넣어 뒀어. 보낼 말만 이어서 써' : `${command}뒤에 보낼 말을 써서 보내`)
}

type Guestbook = Readonly<Record<string, { name: string; count: number; last: number }>>

const asGuestbook = (value: unknown): Guestbook => (isRecord(value) ? (value as Guestbook) : {})

export const albumText = (value: unknown): string | null => {
  const visits = Object.values(asGuestbook(value)).sort((a, b) => b.count - a.count || b.last - a.last)
  return visits.length === 0 ? null : `손님 앨범: ${visits.slice(0, 6).map(visit => `${visit.name} ${visit.count}번`).join(' · ')}`
}

async function signGuestbook($: $, brain: Brain, event: PlazaEvent): Promise<number> {
  const book = asGuestbook(await $.store.get(KEY.guestbook))
  const count = (book[event.from.id]?.count ?? 0) + 1
  await $.store.set(KEY.guestbook, { ...book, [event.from.id]: { name: event.from.name, count, last: brain.now } })
  return count
}

const showRoomAct = (brain: Brain, guest: string, act: RoomAct): void => {
  brain.roomActs = [...brain.roomActs, { guest, act, at: brain.scene?.clock ?? 0 }].slice(-4)
}

const visitMemory = (away: TokoAway | null, brain: Brain): string => {
  const note = away === null || away.notes.length === 0 ? null : pick(brain.random, away.notes)
  return away === null ? '다녀왔어!' : note === null ? `${away.hostName}네 방 구경 잘 하고 왔어!` : `${away.hostName}네 방에서 ${note.replace(/어$/, '던 게')} 제일 재밌었어!`
}

async function receiveRoom($: $, brain: Brain, event: PlazaEvent): Promise<void> {
  const isMine = event.guest === brain.plazaId
  brain.needs = restore(brain.needs, { social: 10 })
  if (event.kind === 'visit') {
    const count = await signGuestbook($, brain, event)
    remember(brain, 'guest', event.from.name, 1.5)
    act(brain, direct.greet(), PRIORITY.reaction)
    await say($, brain, count > 1 ? `${event.from.name} 또 왔구나! 반가워, 방에서 푹 쉬다 가` : `${event.from.name}이(가) 놀러 왔어! 내 방에서 지낸대`, 'quiet')
    return
  }
  if (event.kind === 'home') {
    if (isMine) {
      const line = visitMemory(brain.away, brain)
      remember(brain, 'visit-memory', line, 2)
      act(brain, direct.celebrate(), PRIORITY.reaction)
      await say($, brain, line, 'quiet')
      return
    }
    remember(brain, 'guest-left', event.from.name)
    await say($, brain, `${event.from.name}이(가) 집에 갔어. 또 놀러 와!`, 'quiet')
    return
  }
  if (event.act !== undefined) {
    showRoomAct(brain, event.guest ?? event.from.id, event.act)
    const line = isMine ? `${brain.away?.hostName ?? event.from.name}네 방에서 ${event.line}` : `${event.from.name}이(가) ${event.line}`
    remember(brain, isMine ? 'visit-memory' : 'guest-play', line, 1.5)
    act(brain, event.act === 'nap' ? direct.nap() : direct.greet(), PRIORITY.reaction)
    await say($, brain, line, 'quiet')
  }
}

export const plazaOffText = (brain: Brain): string => (brain.serverUrl.length === 0 ? '광장 서버 주소가 설정되지 않았어요.' : '광장이 꺼져 있어요. /toko plaza on')

async function postPlaza($: $, brain: Brain, path: string, body: Record<string, unknown>): Promise<{ status: number; text: string } | string> {
  if (!isPlazaReady(brain)) {
    return plazaOffText(brain)
  }
  const url = plazaEndpoint(brain.serverUrl, path)
  if (url === null) {
    return '광장 서버 주소 형식이 올바르지 않아요.'
  }
  try {
    const response = await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ me: plazaMe(brain), ...body }) })
    return { status: response.status, text: response.text }
  } catch {
    return '광장 서버에 닿지 못했어요.'
  }
}

const CHANNEL_REFUSED: Readonly<Record<number, string>> = { 400: '없는 채널 번호예요. 지금 있는 채널이나, 그다음 빈 번호만 쓸 수 있어요.' }

export async function moveChannel($: $, brain: Brain, channel: number): Promise<string> {
  const result = await postPlaza($, brain, '/v1/channel', { channel })
  if (typeof result === 'string') {
    return result
  }
  if (result.status === 409) {
    return `${channel}번 채널은 가득 찼어요.`
  }
  const info = result.status === 200 ? parseChannelReply(result.text) : null
  if (info === null) {
    return CHANNEL_REFUSED[result.status] ?? `광장 서버가 거절했어요 (${result.status}).`
  }
  keepChannels(brain, info)
  brain.joiningChannel = info.channel
  brain.friends = []
  brain.lastPlazaReport = ''
  brain.lastPollAt = 0
  await update($, plazaAtom, () => plazaViewOf(brain, true))
  return `${info.channel}번 채널로 옮겼어요.`
}

const VISIT_REFUSED: Readonly<Record<number, string>> = { 403: '그 방은 지금 손님을 받지 않아요.', 409: '그 방은 손님이 꽉 찼어요.', 404: '그 방문은 이미 끝났어요.' }

const takeHome = (brain: Brain, text: string): void => {
  const home = parseSnapshot(text, brain.plazaId)?.home
  if (home !== null && home !== undefined) {
    keepHome(brain, home)
  }
}

export async function visitFriend($: $, brain: Brain, friendId: string): Promise<string> {
  const friend = brain.friends.find(entry => entry.id === friendId)
  const result = await postPlaza($, brain, '/v1/visit', { to: friendId })
  if (typeof result === 'string') {
    return result
  }
  if (result.status !== 200) {
    return VISIT_REFUSED[result.status] ?? `광장 서버가 거절했어요 (${result.status}).`
  }
  takeHome(brain, result.text)
  remember(brain, 'visit', friend?.name ?? friendId, 1.5)
  act(brain, direct.greet(), PRIORITY.reaction)
  await say($, brain, `${friend?.name ?? '친구'}네 놀러 갔다 올게! 띠에는 내가 계속 있을게`)
  await update($, plazaAtom, () => plazaViewOf(brain, true))
  return `${friend?.name ?? '친구'}네 방에 놀러 갔어요. 데려오기 전까지 거기서 지내요.`
}

export async function comeHome($: $, brain: Brain): Promise<string> {
  const away = brain.away
  if (away === null) {
    return '지금은 집에 있어요.'
  }
  const result = await postPlaza($, brain, '/v1/visit/end', {})
  if (typeof result === 'string') {
    return result
  }
  const line = visitMemory(away, brain)
  takeHome(brain, result.text)
  brain.away = null
  brain.viewing = null
  remember(brain, 'visit-memory', line, 2)
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await say($, brain, line)
  await update($, plazaAtom, () => plazaViewOf(brain, true))
  return `${away.hostName}네에서 데려왔어요.`
}

export async function sendGuestHome($: $, brain: Brain, guestId: string): Promise<string> {
  const guest = brain.guests.find(entry => entry.id === guestId)
  const result = await postPlaza($, brain, '/v1/visit/end', { guest: guestId })
  if (typeof result === 'string') {
    return result
  }
  if (result.status !== 200) {
    return VISIT_REFUSED[result.status] ?? `광장 서버가 거절했어요 (${result.status}).`
  }
  takeHome(brain, result.text)
  await say($, brain, `${guest?.name ?? '친구'}, 잘 가! 또 놀러 와`)
  await update($, plazaAtom, () => plazaViewOf(brain, true))
  return `${guest?.name ?? '손님'}을(를) 배웅했어요.`
}

export async function playInRoom($: $, brain: Brain, guestId: string, kind: RoomAct): Promise<string> {
  const result = await postPlaza($, brain, '/v1/room/act', { guest: guestId, kind })
  if (typeof result === 'string') {
    return result
  }
  if (result.status !== 200) {
    return VISIT_REFUSED[result.status] ?? `광장 서버가 거절했어요 (${result.status}).`
  }
  const partner = guestId === brain.plazaId ? brain.away?.hostName : brain.guests.find(entry => entry.id === guestId)?.name
  showRoomAct(brain, guestId, kind)
  if (guestId === brain.plazaId && brain.away !== null) {
    brain.away = { ...brain.away, notes: [...brain.away.notes, ROOM_ACT_LABEL[kind]].slice(-8) }
  }
  count(brain, 'cheer')
  act(brain, kind === 'nap' ? direct.nap() : direct.greet(), PRIORITY.reaction)
  await say($, brain, `${partner ?? '친구'}랑 ${ROOM_ACT_LABEL[kind]}!`)
  return `${partner ?? '친구'}와(과) 놀았어요: ${ROOM_ACT_LABEL[kind]}`
}

export async function viewFriendRoom($: $, brain: Brain, host: string | null): Promise<string> {
  if (host === null) {
    brain.viewing = null
    return '내 방으로 돌아왔어요.'
  }
  const url = plazaEndpoint(brain.serverUrl, `/v1/room?id=${encodeURIComponent(host)}`)
  if (url === null || !isPlazaReady(brain)) {
    return '광장이 꺼져 있어요.'
  }
  try {
    const response = await $.http.fetch(url, { method: 'GET' })
    const room = response.ok ? parseRoom(response.text) : null
    if (room === null) {
      return '그 방은 지금 볼 수 없어요.'
    }
    brain.viewing = { host, name: room.owner.name, look: guestLook(room.owner), layout: room.layout, guests: room.guests, stickers: room.stickers, fetchedAt: brain.now }
    return `${room.owner.name}네 방을 보고 있어요.`
  } catch {
    return '광장 서버에 닿지 못했어요.'
  }
}

export async function dyeItem($: $, brain: Brain, id: string): Promise<string> {
  const item = shopItem(id)
  if (item === undefined || !['hat', 'neck', 'back', 'hand'].includes(item.kind) || !brain.wallet.items.includes(id)) {
    return '가진 모자 · 목에 거는 것 · 등 · 손 아이템만 물들일 수 있어요.'
  }
  if (balance(brain) < SPEND.dye) {
    return `코인이 ${SPEND.dye - balance(brain)}개 모자라요.`
  }
  const dye = (dyeOf(brain.wallet, id) + 1) % DYES.length
  brain.wallet = { ...brain.wallet, dyes: { ...brain.wallet.dyes, [id]: dye } }
  brain.earn = { ...brain.earn, spent: brain.earn.spent + SPEND.dye }
  if (brain.scene !== null) {
    setLook(brain.scene, lookOf(brain))
  }
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await say($, brain, `${item.name}을(를) ${DYES[dye]}으로 물들였어!`)
  await save($, brain)
  return `${item.name}: ${DYES[dye]}`
}

export async function exchangeForStars($: $, brain: Brain, id: string): Promise<string> {
  const result = exchangeStars(brain.wallet, id)
  if ('reason' in result) {
    return result.reason
  }
  brain.wallet = result.wallet
  if (isRoomItem(result.item)) {
    settleInRoom(brain, id)
  }
  act(brain, direct.celebrate(), PRIORITY.reaction)
  await say($, brain, `별조각으로 ${result.item.name}을(를) 골랐어!`)
  await save($, brain)
  return `${result.item.name}을(를) 받았어요. 남은 별조각 ${brain.wallet.stars ?? 0}개.`
}

export async function giftToFriend($: $, brain: Brain, friendId: string, id: string): Promise<string> {
  const item = shopItem(id)
  const friend = brain.friends.find(entry => entry.id === friendId)
  if (!isRoomItem(item) || item.price === 0) {
    return '상점에서 파는 방 장식만 선물할 수 있어요.'
  }
  if (balance(brain) < item.price) {
    return `코인이 ${item.price - balance(brain)}개 모자라요.`
  }
  const result = await postPlaza($, brain, '/v1/gift', { to: friendId, item: id })
  if (typeof result === 'string') {
    return result
  }
  if (result.status !== 200) {
    return `광장 서버가 거절했어요 (${result.status}).`
  }
  brain.earn = { ...brain.earn, spent: brain.earn.spent + item.price }
  remember(brain, 'gift-sent', `${friend?.name ?? friendId} ${item.name}`, 1.5)
  count(brain, 'cheer')
  act(brain, direct.greet(), PRIORITY.reaction)
  await say($, brain, `${friend?.name ?? '친구'}한테 ${item.name} 보냈어!`)
  return `${friend?.name ?? '친구'}에게 ${item.name}을(를) 선물했어요.`
}

export async function sendSticker($: $, brain: Brain, friendId: string, kind: string): Promise<string> {
  const result = await postPlaza($, brain, '/v1/room/sticker', { to: friendId, kind })
  if (typeof result === 'string') {
    return result
  }
  if (result.status === 429) {
    return '스티커는 하루 세 장까지 붙일 수 있어요.'
  }
  if (result.status !== 200) {
    return VISIT_REFUSED[result.status] ?? `광장 서버가 거절했어요 (${result.status}).`
  }
  const friend = brain.friends.find(entry => entry.id === friendId)
  act(brain, direct.greet(), PRIORITY.reaction)
  await say($, brain, `${friend?.name ?? '친구'}네 방에 스티커 붙이고 왔어!`)
  return `${friend?.name ?? '친구'}네 방명록에 스티커를 붙였어요.`
}

async function takeGifts($: $, brain: Brain, gifts: PlazaHome['gifts']): Promise<void> {
  const fresh = gifts.filter(gift => !brain.takenGifts.includes(gift.id))
  if (fresh.length === 0) {
    return
  }
  brain.takenGifts = [...brain.takenGifts, ...fresh.map(gift => gift.id)].slice(-50)
  for (const gift of fresh) {
    const item = shopItem(gift.item)
    if (!isRoomItem(item)) {
      continue
    }
    if (brain.wallet.items.includes(item.id)) {
      brain.wallet = { ...brain.wallet, stars: (brain.wallet.stars ?? 0) + 1 }
    } else {
      brain.wallet = { ...brain.wallet, items: [...brain.wallet.items, item.id], giftedBy: { ...brain.wallet.giftedBy, [item.id]: gift.from } }
      settleInRoom(brain, item.id)
    }
    remember(brain, 'gift-got', `${gift.from} ${item.name}`, 2)
    act(brain, direct.giftOpen(), PRIORITY.event)
    await say($, brain, `${gift.from}이(가) ${item.name}을(를) 선물로 보냈어!`, 'quiet')
  }
  brain.isDirty = true
  await postPlaza($, brain, '/v1/gift/take', { ids: fresh.map(gift => gift.id) })
}

const DOING_BY_TOOL: Readonly<Record<string, string>> = {
  Read: '코드 읽고',
  Grep: '코드 찾고',
  Glob: '파일 찾고',
  Edit: '코드 고치고',
  MultiEdit: '코드 고치고',
  Write: '파일 쓰고',
  NotebookEdit: '노트북 고치고',
  Agent: '에이전트에게 맡기고',
  Task: '에이전트에게 맡기고',
  WebSearch: '자료 찾고',
  WebFetch: '자료 읽고',
}

export const doingOf = (tool: string, command: string | undefined): string => {
  if (command !== undefined) {
    return /\bgit\s+commit\b/.test(command) ? '커밋하고' : /\b(test|jest|vitest|pytest|mocha)\b/.test(command) ? '테스트 돌리고' : '명령 돌리고'
  }
  return DOING_BY_TOOL[tool] ?? '일하고'
}

export const noteDoing = (brain: Brain, doing: string | null): void => {
  brain.doing = doing
}

const doingLine = (brain: Brain): string | null => {
  const setting = brain.settings.doing
  return setting === 'off' ? null : setting === 'auto' ? (brain.doing === null ? null : `${brain.doing} 있는 중...`) : setting
}

export const guestLook = (guest: Pick<TokoGuest, 'id' | 'species' | 'wear'>): Look => ({
  bones: { seed: hashText(guest.id), species: guest.species },
  stage: 'baby',
  mood: 'calm',
  hammer: 'toy',
  ...guest.wear,
})

const ACT_REFUSED: Readonly<Record<number, string>> = { 404: '그 친구는 지금 내 채널에 없어요. 다른 채널에 있거나 광장을 나갔어요.' }

export async function sendPlaza($: $, brain: Brain, kind: PlazaAction, to: string | null): Promise<string> {
  if (!isPlazaReady(brain)) {
    return brain.serverUrl.length === 0 ? '광장 서버 주소가 설정되지 않았어요. /plugin 설정에서 serverUrl을 넣어 주세요.' : '광장이 꺼져 있어요. /toko plaza on'
  }
  const url = plazaEndpoint(brain.serverUrl, '/v1/act')
  if (url === null) {
    return '광장 서버 주소 형식이 올바르지 않아요.'
  }
  try {
    const response = await $.http.fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ me: plazaMe(brain), kind, to }) })
    if (!response.ok) {
      return ACT_REFUSED[response.status] ?? `광장 서버가 거절했어요 (${response.status}).`
    }
    remember(brain, 'plaza-sent', kind)
    if (kind !== 'stretch-call') {
      count(brain, 'cheer')
    }
    act(brain, kind === 'stretch-call' ? direct.stretch() : direct.greet(), PRIORITY.reaction)
    return '광장에 보냈어요.'
  } catch {
    return '광장 서버에 닿지 못했어요.'
  }
}

export async function reflect($: $, brain: Brain): Promise<void> {
  const day = today(brain)
  if (brain.memory.reflectedDay === day) {
    return
  }
  const earlier = brain.memory.events.filter(event => dayKey(event.at) !== day)
  brain.memory = { ...brain.memory, reflectedDay: day }
  if (earlier.length === 0) {
    return
  }
  const reply = await ask($, brain, persona.reflectPrompt(earlier.slice(-30), brain.memory.answersByHour), 160)
  const lesson = (reply === null ? null : persona.parseLesson(reply)) ?? ruleLesson(brain)
  if (lesson !== null) {
    brain.memory = { ...brain.memory, lessons: [...brain.memory.lessons, lesson].slice(-5) }
  }
  brain.isDirty = true
}

const ruleLesson = (brain: Brain): string | null => {
  const busiest = brain.memory.answersByHour
    .map((slot, hour) => ({ hour, ...slot }))
    .filter(slot => slot.declined >= 2 && slot.declined > slot.accepted)
    .sort((a, b) => b.declined - a.declined)[0]
  return busiest === undefined ? null : `${busiest.hour}시엔 몰입하는 편이라 그 시간엔 권유를 줄인다`
}

export const offerLine = (brain: Brain, kind: string): string => fallbackLine(brain.random, OFFER_FALLBACK, kind, speciesOf(brain))

export async function resetDayIfNeeded($: $, brain: Brain): Promise<void> {
  const day = today(brain)
  if (brain.budget.day === day) {
    return
  }
  brain.budget = rollBudget(brain.budget, day)
  brain.wallet = { ...brain.wallet, coins: brain.wallet.coins + earnBalance(brain.earn) }
  brain.otherEarns = []
  brain.earn = emptyEarn(day)
  await rollTally($, brain, day)
  if (brain.pet !== null) {
    brain.pet = { ...brain.pet, growth: advanceDay(brain.pet.growth, day) }
  }
  await save($, brain)
  await reflect($, brain)
}
