import type { TokoAway, TokoFriend, TokoGuest, TokoMood, TokoSpecies, TokoVisitor } from '../../types'

import { BONK_KINDS } from './bonks'
import { SPECIES, isSpecies } from './pet'
import type { Canvas } from './raster'
import { DEFAULT, createCanvas } from './raster'
import type { Palette } from './sprites'
import type { DecorView, Look, Wear } from './scene'
import { dayPhase, paintDecor, portraitOf } from './scene'
import { BACKS, GLASSES, HANDS, HATS, NECKS } from './sprites'

export const PLAZA_POLL_MS = 20_000
export const STREAM_STEADY_MS = 30_000
export const STREAM_RETRY_MAX_MS = 60_000
export const FRIEND_TTL_MS = 90_000

export type PlazaStatus = 'working' | 'resting' | 'idle' | 'away'

export type PlazaAction = 'wave' | 'heart' | 'snack' | 'stretch-call' | 'cheer'

export const PLAZA_ACTIONS: readonly PlazaAction[] = ['wave', 'heart', 'snack', 'stretch-call', 'cheer']

export const ACTION_LABEL: Readonly<Record<PlazaAction, string>> = {
  wave: '손 흔들기',
  heart: '하트',
  snack: '간식 나눠 주기',
  'stretch-call': '다 같이 기지개',
  cheer: '응원',
}

export type RoomAct = 'hug' | 'snack' | 'play' | 'nap'

export const ROOM_ACTS: readonly RoomAct[] = ['hug', 'snack', 'play', 'nap']

export const ROOM_ACT_LABEL: Readonly<Record<RoomAct, string>> = {
  hug: '안아 주기',
  snack: '간식 나눠 먹기',
  play: '술래잡기',
  nap: '같이 낮잠',
}

export const isRoomAct = (value: string): value is RoomAct => (ROOM_ACTS as readonly string[]).includes(value)

type WireColor = 'honey' | 'mint' | 'peach' | 'lavender'

const WIRE_COLOR: Readonly<Record<TokoSpecies, WireColor>> = {
  cat: 'honey',
  bear: 'peach',
  chick: 'honey',
  bunny: 'lavender',
  frog: 'mint',
  penguin: 'lavender',
  fox: 'peach',
  dragon: 'mint',
  unicorn: 'lavender',
  ghost: 'lavender',
  phoenix: 'peach',
  robot: 'mint',
  axolotl: 'peach',
  debul: 'lavender',
}

export const wireColor = (species: TokoSpecies): WireColor => WIRE_COLOR[species]

type PlazaSprite = { palette: readonly string[]; rows: readonly string[] }

const SPRITE_KEYS = '0123456789abcdefghijklmnopqrstuvwxyz'

export const spriteOf = (canvas: Canvas): PlazaSprite | null => {
  const palette: string[] = []
  const keyOf = (color: number): string => {
    if (color === DEFAULT) {
      return '.'
    }
    const value = color.toString(16).padStart(6, '0')
    const index = palette.indexOf(value)
    return SPRITE_KEYS[index < 0 ? palette.push(value) - 1 : index] ?? '.'
  }
  const rows = Array.from({ length: canvas.height }, (_, y) => Array.from(canvas.pixels.subarray(y * canvas.width, (y + 1) * canvas.width), keyOf).join(''))
  return palette.length <= SPRITE_KEYS.length ? { palette, rows } : null
}

const sprites = new Map<string, PlazaSprite | null>()

export const lookSprite = (look: Look): PlazaSprite | null => {
  const key = [look.bones.species, look.stage, look.mood, look.hat, look.neck, look.face].join(':')
  const cached = sprites.get(key)
  if (cached !== undefined) {
    return cached
  }
  const sprite = spriteOf(portraitOf(look))
  sprites.set(key, sprite)
  return sprite
}

export const PICTURE_WIDTH = 96
export const PICTURE_ROWS = 20

const pictures = new Map<string, PlazaSprite | null>()

export const roomPicture = (palette: Palette, view: DecorView): PlazaSprite | null => {
  const key = JSON.stringify({ ...view, hour: dayPhase(view.hour) })
  const cached = pictures.get(key)
  if (cached !== undefined) {
    return cached
  }
  const canvas = createCanvas(PICTURE_WIDTH, PICTURE_ROWS)
  paintDecor(canvas, palette, view)
  const picture = spriteOf(canvas)
  pictures.set(key, picture)
  return picture
}

export type PlazaEvent = {
  id: string
  at: number
  kind: PlazaAction | 'join' | 'leave' | 'visit' | 'home' | 'room-act' | 'sticker' | 'gift'
  from: { id: string; name: string; species: TokoSpecies; wear: Wear }
  to: string | null
  line: string
  act?: RoomAct
  guest?: string
}

export type PlazaBonks = { total: number; top: readonly { kind: string; count: number }[] }

export const NO_BONKS: PlazaBonks = { total: 0, top: [] }

export type PlazaWeatherLevel = 'calm' | 'busy' | 'festival'

export type PlazaWeather = { level: PlazaWeatherLevel; reporting: number; atLimit: number; over60: number; average: number }

export type PlazaGift = { id: string; item: string; from: string }

export type PlazaHome = { guests: readonly TokoGuest[]; away: TokoAway | null; stickers: readonly string[]; gifts: readonly PlazaGift[] }

export type PlazaChannel = { channel: number; count: number }

export const DEFAULT_CHANNEL_SIZE = 20

export type PlazaSnapshot = {
  friends: readonly TokoFriend[]
  events: readonly PlazaEvent[]
  bonks: PlazaBonks
  weather: PlazaWeather | null
  now: number
  home: PlazaHome | null
  channel: number | null
  channels: readonly PlazaChannel[]
  channelSize: number | null
}

const COLORS: ReadonlySet<string> = new Set(['honey', 'mint', 'peach', 'lavender'])
const MOODS: ReadonlySet<string> = new Set(['excited', 'calm', 'sleepy', 'worried', 'sulky'])
const KINDS: ReadonlySet<string> = new Set([...PLAZA_ACTIONS, 'join', 'leave', 'visit', 'home', 'room-act', 'sticker', 'gift'])

const text = (value: unknown, max: number): string => (typeof value === 'string' ? [...value.replace(/\s+/g, ' ').trim()].slice(0, max).join('') : '')

const speciesOf = (raw: Record<string, unknown>): TokoSpecies => (isSpecies(raw.species) ? raw.species : 'cat')

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const parseFriend = (value: unknown): TokoFriend | null => {
  const raw = asRecord(value)
  if (raw === null || typeof raw.id !== 'string' || !COLORS.has(String(raw.color))) {
    return null
  }
  return {
    id: text(raw.id, 64),
    name: text(raw.name, 12) || '친구',
    species: speciesOf(raw),
    mood: MOODS.has(String(raw.mood)) ? (raw.mood as TokoMood) : 'calm',
    status: text(raw.status, 12) || 'idle',
    lastSeen: typeof raw.lastSeen === 'number' ? raw.lastSeen : 0,
    isRoomOpen: raw.isRoomOpen === true,
    ...(typeof raw.doing === 'string' && raw.doing.length > 0 ? { doing: text(raw.doing, 20) } : {}),
  }
}

const WEARABLE: Readonly<Record<'hat' | 'neck' | 'face' | 'back' | 'hand', Readonly<Record<string, unknown>>>> = { hat: HATS, neck: NECKS, face: GLASSES, back: BACKS, hand: HANDS }

export const wearOf = (value: unknown): Wear => {
  const raw = asRecord(value)
  return Object.fromEntries(
    (Object.keys(WEARABLE) as (keyof typeof WEARABLE)[]).map(slot => [slot, raw?.[slot]] as const).filter(([slot, id]) => typeof id === 'string' && Object.hasOwn(WEARABLE[slot], id)),
  )
}

const parseEvent = (value: unknown): PlazaEvent | null => {
  const raw = asRecord(value)
  const from = asRecord(raw?.from)
  if (raw === null || from === null || typeof raw.id !== 'string' || !KINDS.has(String(raw.kind)) || !COLORS.has(String(from.color))) {
    return null
  }
  return {
    id: text(raw.id, 64),
    at: typeof raw.at === 'number' ? raw.at : 0,
    kind: raw.kind as PlazaEvent['kind'],
    from: { id: text(from.id, 64), name: text(from.name, 12) || '친구', species: speciesOf(from), wear: wearOf(from.wear) },
    to: typeof raw.to === 'string' ? raw.to : null,
    line: text(raw.line, 80),
    ...(typeof raw.act === 'string' && isRoomAct(raw.act) ? { act: raw.act } : {}),
    ...(typeof raw.guest === 'string' ? { guest: text(raw.guest, 64) } : {}),
  }
}

const isPresent = <T>(value: T | null): value is T => value !== null

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

const parseBonks = (value: unknown): PlazaBonks => {
  const raw = asRecord(value)
  const top = (Array.isArray(raw?.top) ? raw.top : [])
    .map(asRecord)
    .filter(isPresent)
    .filter(row => typeof row.kind === 'string' && Object.hasOwn(BONK_KINDS, row.kind) && count(row.count) > 0)
    .map(row => ({ kind: String(row.kind), count: count(row.count) }))
  return { total: count(raw?.total), top: top.slice(0, 5) }
}

const WEATHER_WORDS: Readonly<Record<PlazaWeatherLevel, string>> = { calm: '맑음', busy: '북적북적', festival: '축제' }

const parseWeather = (value: unknown): PlazaWeather | null => {
  const raw = asRecord(value)
  if (raw === null || typeof raw.level !== 'string' || !Object.hasOwn(WEATHER_WORDS, raw.level)) {
    return null
  }
  return { level: raw.level as PlazaWeatherLevel, reporting: count(raw.reporting), atLimit: count(raw.atLimit), over60: count(raw.over60), average: Math.min(100, count(raw.average)) }
}

export const weatherText = (weather: PlazaWeather | null): string | null => {
  if (weather === null) {
    return null
  }
  const detail =
    weather.level === 'calm'
      ? `${weather.reporting}명 평균 5시간 한도 ${weather.average}% 사용 중`
      : `5시간 한도 60% 넘은 사람 ${weather.over60}명${weather.atLimit > 0 ? ` · 다 쓴 사람 ${weather.atLimit}명` : ''} · 평균 ${weather.average}%`
  return `데이블 Claude 날씨: ${WEATHER_WORDS[weather.level]} · ${detail}`
}

export const FESTIVAL_LINE = '광장에 축제가 열렸어! 데이블 사람들이 지금 Claude를 엄청 쓰고 있대'

export const bonkBoardText = (bonks: PlazaBonks): string | null =>
  bonks.total === 0
    ? null
    : `뿅망치 전광판: 오늘 Clawd가 ${bonks.total}번 맞았어요 · ${bonks.top
        .slice(0, 3)
        .map((row, index) => `${index + 1}위 ${BONK_KINDS[row.kind]}(${row.count}번)`)
        .join(', ')}`

const parseGuest = (value: unknown): TokoGuest | null => {
  const raw = asRecord(value)
  if (raw === null || typeof raw.id !== 'string') {
    return null
  }
  return { id: text(raw.id, 64), name: text(raw.name, 12) || '친구', species: speciesOf(raw), wear: wearOf(raw.wear), since: typeof raw.since === 'number' ? raw.since : 0 }
}

const parseAway = (value: unknown): TokoAway | null => {
  const raw = asRecord(value)
  if (raw === null || typeof raw.host !== 'string') {
    return null
  }
  const notes: unknown[] = Array.isArray(raw.notes) ? raw.notes : []
  return {
    host: text(raw.host, 64),
    hostName: text(raw.hostName, 12) || '친구',
    since: typeof raw.since === 'number' ? raw.since : 0,
    notes: notes.map(note => text(note, 40)).filter(note => note.length > 0),
  }
}

const STICKER_KINDS: ReadonlySet<string> = new Set(['heart', 'star', 'flower'])

const parseStickers = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((kind): kind is string => typeof kind === 'string' && STICKER_KINDS.has(kind)).slice(-12) : [])

const parseGift = (value: unknown): PlazaGift | null => {
  const raw = asRecord(value)
  return raw === null || typeof raw.id !== 'string' || typeof raw.item !== 'string' ? null : { id: text(raw.id, 64), item: text(raw.item, 24), from: text(raw.from, 12) || '친구' }
}

const parseHome = (raw: Record<string, unknown>): PlazaHome | null =>
  Array.isArray(raw.guests)
    ? {
        guests: raw.guests.map(parseGuest).filter(isPresent).slice(0, 4),
        away: parseAway(raw.away),
        stickers: parseStickers(raw.stickers),
        gifts: (Array.isArray(raw.gifts) ? raw.gifts : []).map(parseGift).filter(isPresent).slice(0, 20),
      }
    : null

const channelNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null)

const parsePlazaChannel = (value: unknown): PlazaChannel | null => {
  const raw = asRecord(value)
  const channel = channelNumber(raw?.channel)
  const count = raw?.count
  return channel !== null && typeof count === 'number' && Number.isInteger(count) && count >= 0 ? { channel, count } : null
}

export const parseChannels = (value: unknown): readonly PlazaChannel[] =>
  (Array.isArray(value) ? value : [])
    .map(parsePlazaChannel)
    .filter(isPresent)
    .sort((a, b) => a.channel - b.channel)
    .slice(0, 200)

export type PlazaChannelInfo = { channel: number | null; channels: readonly PlazaChannel[]; channelSize: number | null }

export const parseChannelInfo = (raw: Record<string, unknown>): PlazaChannelInfo => ({ channel: channelNumber(raw.channel), channels: parseChannels(raw.channels), channelSize: channelNumber(raw.channelSize) })

export const parseChannelReply = (body: string): PlazaChannelInfo | null => {
  try {
    const raw = asRecord(JSON.parse(body))
    const info = raw === null ? null : parseChannelInfo(raw)
    return info !== null && info.channel !== null ? info : null
  } catch {
    return null
  }
}

export const channelsText = (channel: number | null, channels: readonly PlazaChannel[], channelSize: number | null): string | null => {
  if (channels.length === 0) {
    return null
  }
  const size = channelSize ?? DEFAULT_CHANNEL_SIZE
  const lines = channels.map(entry => {
    const marks = [...(entry.count >= size ? ['가득'] : []), ...(entry.channel === channel ? ['내 채널'] : [])]
    return `${entry.channel}번 ${entry.count}/${size}${marks.length === 0 ? '' : ` (${marks.join(', ')})`}`
  })
  const next = Math.max(...channels.map(entry => entry.channel)) + 1
  return [...lines, `/toko plaza channel <번호>로 채널을 옮겨요. 다음 빈 번호(${next})를 쓰면 새 채널이 열려요.`].join('\n')
}

export const parseSnapshot = (body: string, myId: string): PlazaSnapshot | null => {
  try {
    const raw = asRecord(JSON.parse(body))
    if (raw === null) {
      return null
    }
    const friends = (Array.isArray(raw.friends) ? raw.friends : []).map(parseFriend).filter(isPresent).filter(friend => friend.id !== myId)
    const events = (Array.isArray(raw.events) ? raw.events : []).map(parseEvent).filter(isPresent).filter(event => event.from.id !== myId)
    return { friends: friends.slice(0, 30), events: events.slice(-20), bonks: parseBonks(raw.bonks), weather: parseWeather(raw.weather), now: typeof raw.now === 'number' ? raw.now : 0, home: parseHome(raw), ...parseChannelInfo(raw) }
  } catch {
    return null
  }
}

export type PlazaRoom = { owner: TokoGuest; layout: Readonly<Record<string, string>>; guests: readonly TokoGuest[]; stickers: readonly string[] }

export const parseRoom = (body: string): PlazaRoom | null => {
  try {
    const raw = asRecord(JSON.parse(body))
    const owner = parseGuest(raw?.owner)
    const layout = asRecord(raw?.layout)
    if (raw === null || owner === null || layout === null) {
      return null
    }
    return {
      owner,
      layout: Object.fromEntries(Object.entries(layout).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
      guests: (Array.isArray(raw.guests) ? raw.guests : []).map(parseGuest).filter(isPresent).slice(0, 4),
      stickers: parseStickers(raw.stickers),
    }
  } catch {
    return null
  }
}

export const plazaEndpoint = (base: string, path: string): string | null => {
  const trimmed = base.trim().replace(/\/+$/, '')
  return /^https?:\/\/[^\s]+$/.test(trimmed) ? `${trimmed}${path}` : null
}

export const plazaStreamUrl = (base: string, id: string, tab: string): string | null => {
  const url = plazaEndpoint(base, '/v1/stream')
  return url === null ? null : `${url}?id=${encodeURIComponent(id)}&tab=${encodeURIComponent(tab)}`
}

export const splitEvents = (text: string): { data: string[]; rest: string } => {
  const blocks = text.replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  const data = blocks
    .map(block => block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n'))
    .filter(payload => payload.length > 0)
  return { data, rest }
}

export const isForMe = (event: PlazaEvent, myId: string): boolean => event.to === null || event.to === myId

const VERB: Readonly<Record<PlazaEvent['kind'] | 'wait', string>> = {
  wait: 'Claude 기다리는 중이래. 같이 기다리자',
  wave: '손을 흔들었어',
  heart: '하트를 보냈어',
  snack: '간식을 나눠 줬어',
  'stretch-call': '다 같이 기지개 켜자고 해',
  cheer: '응원을 보냈어',
  join: '광장에 왔어',
  leave: '광장을 떠났어',
  visit: '내 방에 놀러 왔어',
  home: '집에 갔어',
  'room-act': '방에서 같이 놀았어',
  sticker: '방명록에 스티커를 붙였어',
  gift: '선물을 보냈어',
}

export const eventText = (event: PlazaEvent): string => `${event.from.name}: ${event.line || VERB[event.kind]}`

export const VISITOR_SHOW_MS = 15_000
export const VISITOR_STALE_MS = 30 * 60_000

export const visitorOf = (event: PlazaEvent, at: number): TokoVisitor => ({ name: event.from.name, species: event.from.species, kind: event.kind, line: event.line, at })

export const visitorText = (visitor: TokoVisitor): string => {
  const verb = VERB[visitor.kind as keyof typeof VERB] ?? VERB.wave
  return `${visitor.name}(${SPECIES[visitor.species].label}) (•ᴗ•)ﾉ ${verb}${visitor.line.length > 0 ? ` — ${visitor.line}` : ''}`
}

export const shouldDismissVisitor = (visitor: TokoVisitor, visibleMs: number, now: number): boolean =>
  visibleMs >= VISITOR_SHOW_MS || now - visitor.at >= VISITOR_STALE_MS

export const findFriend = (friends: readonly TokoFriend[], query: string): TokoFriend | undefined => {
  const needle = query.trim()
  return friends.find(friend => friend.name === needle) ?? friends.find(friend => friend.name.startsWith(needle)) ?? friends.find(friend => friend.id === needle)
}
