import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export type Color = 'honey' | 'mint' | 'peach' | 'lavender'
export type Mood = 'excited' | 'calm' | 'sleepy' | 'worried' | 'sulky'
export type Status = 'working' | 'resting' | 'idle' | 'away'
export type Action = 'wave' | 'heart' | 'snack' | 'stretch-call' | 'cheer'

export type Sprite = { palette: readonly string[]; rows: readonly string[] }

export type Wear = { hat?: string; neck?: string; face?: string; back?: string; hand?: string }

export type Member = { id: string; tab?: string; name: string; color: Color; species?: string; wear?: Wear; mood: Mood; status: Status; lastSeen: number; sprite?: Sprite; doing?: string }

export type RoomAct = 'hug' | 'snack' | 'play' | 'nap'

export type Card = { id: string; name: string; color: Color; species?: string; wear?: Wear }

export type PlazaEvent = {
  id: string
  at: number
  kind: Action | 'join' | 'visit' | 'home' | 'room-act' | 'sticker' | 'gift'
  from: Card
  to: string | null
  line: string
  act?: RoomAct
  guest?: string
  channel?: number
}

export type Layout = Readonly<Record<string, string>>

export type Sticker = { kind: string; from: string; at: number }

export type Room = { owner: Card; layout: Layout; isOpen: boolean; picture?: Sprite; stickers?: readonly Sticker[] }

export type Gift = { id: string; item: string; from: string; at: number }

export type Visit = { guest: Card; host: string; since: number; notes: readonly string[] }

export type Storage = { read: () => string | null; write: (text: string) => void }

export type Generate = (prompt: string) => Promise<string | null>

export type PlazaOptions = {
  now?: () => number
  generate?: Generate
  friendTtlMs?: number
  maxEvents?: number
  actionsPerMinute?: number
  keepAliveMs?: number
  flushMs?: number
  maxGuests?: number
  storage?: Storage
  channelSize?: number
}

const COLORS: ReadonlySet<string> = new Set(['honey', 'mint', 'peach', 'lavender'])
const MOODS: ReadonlySet<string> = new Set(['excited', 'calm', 'sleepy', 'worried', 'sulky'])
const STATUSES: ReadonlySet<string> = new Set(['working', 'resting', 'idle', 'away'])
const ACTIONS: ReadonlySet<string> = new Set(['wave', 'heart', 'snack', 'stretch-call', 'cheer'])
const ROOM_ACTS: ReadonlySet<string> = new Set(['hug', 'snack', 'play', 'nap'])
const MAX_LAYOUT = 9
const MAX_STICKERS = 12
const STICKERS_PER_DAY = 3
const MAX_GIFTS = 20
const STICKER_KINDS: ReadonlySet<string> = new Set(['heart', 'star', 'flower'])
const MAX_NOTES = 8

export const ROOM_ACT_NOTES: Readonly<Record<RoomAct, string>> = {
  hug: '꼭 안아 줬어',
  snack: '간식을 나눠 먹었어',
  play: '술래잡기를 했어',
  nap: '같이 낮잠을 잤어',
}
const FORBIDDEN = /(바보|멍청|병신|시발|씨발|ㅅㅂ|개새|꺼져|닥쳐|죽어|죽여|미친|한심|쓰레기)/
const MAX_BODY = 16_384
const SPRITE_KEYS = '0123456789abcdefghijklmnopqrstuvwxyz'
const MAX_SPRITE = 32

export const FALLBACK_LINES: Readonly<Record<Action, readonly string[]>> = {
  wave: ['안녕! 잠깐 숨 돌리고 가', '여기도 열심히 하는 중이야. 같이 천천히 가자'],
  heart: ['하트 하나 보낼게. 오늘도 수고 많아', '너무 무리하지 마'],
  snack: ['간식 나눠 줄게. 당 충전하고 가', '쿠키 하나 먹고 해'],
  'stretch-call': ['다 같이 기지개 켜자! 어깨 쭉', '1분만 다 같이 쉬어 가자'],
  cheer: ['응원해! 거의 다 왔어', '천천히 해도 괜찮아'],
}

export const BONK_KINDS: Readonly<Record<string, string>> = {
  unverified: '안 돌려 보고 됐다고 함',
  overreach: '시키지 않은 것까지 고침',
  repeat: '같은 실수를 또 함',
  ignored: '말한 걸 안 지킴',
  'made-up': '없는 걸 지어냄',
  'test-dodge': '테스트를 지우거나 건너뜀',
  'wrong-spot': '엉뚱한 데를 고침',
  risky: '묻지 않고 위험한 걸 함',
  wordy: '말이 너무 김',
  stuck: '같은 데서 맴돎',
  other: '그 밖의 실수',
  just: '그냥 때림',
}

export type BonkBoard = { total: number; top: { kind: string; label: string; count: number }[] }

const NO_BONKS: BonkBoard = { total: 0, top: [] }

const kstDayOf = (at: number): string => new Date(at + 9 * 3_600_000).toISOString().slice(0, 10)

export type WeatherLevel = 'calm' | 'busy' | 'festival'

export type Weather = { level: WeatherLevel; reporting: number; atLimit: number; over60: number; average: number; at: number }

export const WEATHER_MIN_PEOPLE = 5
export const WEATHER_LEVELS = { busy: { average: 10, over60: 2 }, festival: { average: 20, over60: 5 } } as const
export const WEATHER_EVERY_MS = 180_000
export const WEATHER_KEEP_MS = 15 * 60_000
export const TUNER_USAGE_URL = 'https://api.claudetuner.com/api/v1/usage/current'
const TUNER_MAX_PAGES = 10

const ACTION_WORDS: Readonly<Record<Action, string>> = {
  wave: '손 흔들기',
  heart: '하트',
  snack: '간식 나눠 주기',
  'stretch-call': '다 같이 기지개 켜자는 부름',
  cheer: '응원',
}

const clean = (value: unknown, max: number): string =>
  typeof value === 'string'
    ? [...value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('')
    : ''

export const sanitizeLine = (text: string | null): string | null => {
  if (text === null) {
    return null
  }
  const rows = text.split('\n').map(row => row.trim().replace(/^(?:[-*>]\s+|\d+\.\s+)/, ''))
  const first = rows.find(row => row.length > 0 && !row.startsWith('#')) ?? ''
  const line = clean(first.replace(/[*_`]/g, ''), 40).replace(/^["'「“]+|["'」”]+$/g, '')
  return line.length === 0 || FORBIDDEN.test(line) ? null : line
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const fiveHourOf = (row: Record<string, unknown>): number | null => {
  const window = asRecord(asRecord(row.windows)?.five_hour)
  const utilization = window?.utilization
  if (typeof utilization !== 'number' || !Number.isFinite(utilization)) {
    return null
  }
  return window?.seconds_to_reset === 0 ? 0 : Math.min(100, Math.max(0, utilization))
}

export const weatherOf = (rows: readonly unknown[], at: number): Weather | null => {
  const usage = rows
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => row !== null && row.provider === 'claude' && row.default_org === true && row.status === 'ok')
    .map(fiveHourOf)
    .filter((value): value is number => value !== null)
  if (usage.length < WEATHER_MIN_PEOPLE) {
    return null
  }
  const average = usage.reduce((sum, value) => sum + value, 0) / usage.length
  const over60 = usage.filter(value => value >= 60).length
  const reaches = (level: Exclude<WeatherLevel, 'calm'>): boolean => average >= WEATHER_LEVELS[level].average || over60 >= WEATHER_LEVELS[level].over60
  const level: WeatherLevel = reaches('festival') ? 'festival' : reaches('busy') ? 'busy' : 'calm'
  return { level, reporting: usage.length, atLimit: usage.filter(value => value >= 100).length, over60, average: Math.round(average), at }
}

export const readTunerUsage = async (key: string, fetcher: typeof fetch = fetch): Promise<unknown[] | null> => {
  const rows: unknown[] = []
  let cursor: string | null = null
  for (let page = 0; page < TUNER_MAX_PAGES; page += 1) {
    const url: string = cursor === null ? TUNER_USAGE_URL : `${TUNER_USAGE_URL}?cursor=${encodeURIComponent(cursor)}`
    try {
      const response = await fetcher(url, { headers: { authorization: `Bearer ${key}`, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        console.log(`claude tuner usage: http ${response.status}`)
        return null
      }
      const body = asRecord(await response.json())
      rows.push(...(Array.isArray(body?.data) ? body.data : []))
      cursor = typeof body?.next_cursor === 'string' && body.next_cursor.length > 0 ? body.next_cursor : null
    } catch {
      console.log('claude tuner usage: unreachable')
      return null
    }
    if (cursor === null) {
      return rows
    }
  }
  return rows
}

const weatherKey = (weather: Weather | null): string =>
  weather === null ? '' : [weather.level, weather.reporting, weather.atLimit, weather.over60, weather.average].join(':')

export const nextWeather = (rows: readonly unknown[] | null, last: Weather | null, at: number): Weather | null =>
  rows !== null ? weatherOf(rows, at) : last !== null && at - last.at < WEATHER_KEEP_MS ? last : null

export const watchWeather = (key: string, onWeather: (weather: Weather | null) => void, fetcher: typeof fetch = fetch, now: () => number = () => Date.now()): (() => void) => {
  let last: Weather | null = null
  const check = async (): Promise<void> => {
    last = nextWeather(await readTunerUsage(key, fetcher), last, now())
    onWeather(last)
  }
  void check()
  const timer = setInterval(() => void check(), WEATHER_EVERY_MS)
  return () => clearInterval(timer)
}

export const parseSprite = (value: unknown): Sprite | null => {
  const raw = asRecord(value)
  const palette: unknown[] = Array.isArray(raw?.palette) ? raw.palette : []
  const rows: unknown[] = Array.isArray(raw?.rows) ? raw.rows : []
  const keys = SPRITE_KEYS.slice(0, palette.length)
  const isPalette = palette.length > 0 && palette.length <= SPRITE_KEYS.length && palette.every(color => typeof color === 'string' && /^[0-9a-f]{6}$/i.test(color))
  const isRows = rows.length > 0 && rows.length <= MAX_SPRITE && rows.every(row => typeof row === 'string' && row.length <= MAX_SPRITE && [...row].every(char => char === '.' || keys.includes(char)))
  return isPalette && isRows ? { palette: palette.map(color => String(color).toLowerCase()), rows: rows.map(String) } : null
}

const WEAR_SLOTS = ['hat', 'neck', 'face', 'back', 'hand'] as const

const MAX_PICTURE_ROWS = 40
const MAX_PICTURE_COLUMNS = 128

export const parsePicture = (value: unknown): Sprite | null => {
  const raw = asRecord(value)
  const palette: unknown[] = Array.isArray(raw?.palette) ? raw.palette : []
  const rows: unknown[] = Array.isArray(raw?.rows) ? raw.rows : []
  const keys = SPRITE_KEYS.slice(0, palette.length)
  const isPalette = palette.length > 0 && palette.length <= SPRITE_KEYS.length && palette.every(color => typeof color === 'string' && /^[0-9a-f]{6}$/i.test(color))
  const isRows = rows.length > 0 && rows.length <= MAX_PICTURE_ROWS && rows.every(row => typeof row === 'string' && row.length <= MAX_PICTURE_COLUMNS && [...row].every(char => char === '.' || keys.includes(char)))
  return isPalette && isRows ? { palette: palette.map(color => String(color).toLowerCase()), rows: rows.map(String) } : null
}

export const parseWear = (value: unknown): Wear => {
  const raw = asRecord(value)
  return Object.fromEntries(WEAR_SLOTS.map(slot => [slot, clean(raw?.[slot], 24)] as const).filter(([, id]) => /^[a-z][a-z-]{0,23}$/.test(id)))
}

export const parseMe = (value: unknown, now: number): Member | null => {
  const raw = asRecord(value)
  const id = clean(raw?.id, 64)
  if (raw === null || !/^[a-z0-9-]{4,64}$/i.test(id) || !COLORS.has(String(raw.color))) {
    return null
  }
  const species = clean(raw.species, 16)
  const tab = clean(raw.tab, 16)
  const sprite = parseSprite(raw.sprite)
  const wear = parseWear(raw.wear)
  const doing = doingOf(raw.doing)
  return {
    id,
    ...(/^[a-z0-9]{1,16}$/i.test(tab) ? { tab } : {}),
    name: clean(raw.name, 12) || '친구',
    color: raw.color as Color,
    ...(/^[a-z]{2,16}$/.test(species) ? { species } : {}),
    ...(Object.keys(wear).length === 0 ? {} : { wear }),
    mood: MOODS.has(String(raw.mood)) ? (raw.mood as Mood) : 'calm',
    status: STATUSES.has(String(raw.status)) ? (raw.status as Status) : 'idle',
    lastSeen: now,
    ...(sprite === null ? {} : { sprite }),
    ...(doing === null ? {} : { doing }),
  }
}

export const doingOf = (value: unknown): string | null => {
  const doing = clean(value, 20)
  return doing.length === 0 || FORBIDDEN.test(doing) ? null : doing
}

const friendOf = ({ sprite, ...friend }: Member): Omit<Member, 'sprite'> => friend

export const parseLayout = (value: unknown): Layout | null => {
  const raw = asRecord(value)
  if (raw === null) {
    return null
  }
  const entries = Object.entries(raw)
    .map(([slot, id]) => [clean(slot, 16), clean(id, 24)] as const)
    .filter(([slot, id]) => /^[a-z0-9-]{1,16}$/.test(slot) && /^[a-z][a-z-]{0,23}$/.test(id))
  return Object.fromEntries(entries.slice(0, MAX_LAYOUT))
}

const parseCard = (value: unknown): Card | null => {
  const raw = asRecord(value)
  const id = clean(raw?.id, 64)
  if (raw === null || !/^[a-z0-9-]{4,64}$/i.test(id) || !COLORS.has(String(raw.color))) {
    return null
  }
  const species = clean(raw.species, 16)
  const wear = parseWear(raw.wear)
  return {
    id,
    name: clean(raw.name, 12) || '친구',
    color: raw.color as Color,
    ...(/^[a-z]{2,16}$/.test(species) ? { species } : {}),
    ...(Object.keys(wear).length === 0 ? {} : { wear }),
  }
}

type Saved = { rooms: Room[]; visits: Visit[]; gifts: [string, Gift[]][]; spots: [string, Spot][] }

const toSpot = (value: number): number => Math.round(Math.max(-1, Math.min(1, value)) * 1000) / 1000

const SPOT_TRIES = 24

const isClearOfFountain = (spot: Spot): boolean => (spot.u / 0.38) ** 2 + ((spot.v - 0.05) / 0.5) ** 2 > 1

const roomAround = (spot: Spot, taken: readonly Spot[]): number => Math.min(Infinity, ...taken.map(other => Math.hypot(spot.u - other.u, (spot.v - other.v) * 2)))

export const pickSpot = (id: string, taken: readonly Spot[]): Spot => {
  let seed = parseInt(hashOf(id), 36)
  const next = (): number => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  const candidates = Array.from({ length: SPOT_TRIES }, () => {
    const angle = next() * Math.PI * 2
    const reach = 0.5 + next() * 0.4
    return { u: toSpot(Math.cos(angle) * reach), v: toSpot(Math.sin(angle) * reach) }
  }).filter(isClearOfFountain)
  return candidates.reduce((best, spot) => (roomAround(spot, taken) > roomAround(best, taken) ? spot : best), candidates[0] ?? { u: 0, v: 0.75 })
}

const isSpot = (value: Record<string, unknown> | null): value is { u: number; v: number } =>
  typeof value?.u === 'number' && typeof value.v === 'number' && Number.isFinite(value.u) && Number.isFinite(value.v)

export const parseSaved = (text: string | null): Saved => {
  try {
    const raw = asRecord(JSON.parse(text ?? '{}'))
    const rooms = (Array.isArray(raw?.rooms) ? raw.rooms : [])
      .map(entry => {
        const room = asRecord(entry)
        const owner = parseCard(room?.owner)
        const layout = parseLayout(room?.layout)
        const picture = parsePicture(room?.picture)
        const stickers: unknown[] = Array.isArray(room?.stickers) ? room.stickers : []
        const kept = stickers
          .map(entry => asRecord(entry))
          .filter((entry): entry is Record<string, unknown> => entry !== null && STICKER_KINDS.has(String(entry.kind)))
          .map(entry => ({ kind: String(entry.kind), from: clean(entry.from, 12), at: typeof entry.at === 'number' ? entry.at : 0 }))
          .slice(-MAX_STICKERS)
        return owner === null || layout === null ? null : { owner, layout, isOpen: room?.isOpen !== false, ...(picture === null ? {} : { picture }), stickers: kept }
      })
      .filter((room): room is NonNullable<typeof room> => room !== null)
    const visits = (Array.isArray(raw?.visits) ? raw.visits : [])
      .map(entry => {
        const visit = asRecord(entry)
        const guest = parseCard(visit?.guest)
        const host = clean(visit?.host, 64)
        const notes: unknown[] = Array.isArray(visit?.notes) ? visit.notes : []
        return guest === null || host.length === 0
          ? null
          : { guest, host, since: typeof visit?.since === 'number' ? visit.since : 0, notes: notes.map(note => clean(note, 40)).filter(note => note.length > 0).slice(-MAX_NOTES) }
      })
      .filter((visit): visit is NonNullable<typeof visit> => visit !== null)
    const gifts: [string, Gift[]][] = (Array.isArray(raw?.gifts) ? raw.gifts : [])
      .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length === 2)
      .map(([to, list]) => [clean(to, 64), (Array.isArray(list) ? list : []).map(gift => asRecord(gift)).filter((gift): gift is Record<string, unknown> => gift !== null).map(gift => ({ id: clean(gift.id, 64), item: clean(gift.item, 24), from: clean(gift.from, 12), at: typeof gift.at === 'number' ? gift.at : 0 }))])
    const spots: [string, Spot][] = (Array.isArray(raw?.spots) ? raw.spots : [])
      .filter((entry): entry is [unknown, unknown] => Array.isArray(entry) && entry.length === 2)
      .map(([id, value]) => [clean(id, 64), asRecord(value)] as const)
      .filter((entry): entry is readonly [string, { u: number; v: number }] => entry[0].length > 0 && isSpot(entry[1]))
      .map(([id, spot]) => [id, { u: toSpot(spot.u), v: toSpot(spot.v) }])
    return { rooms, visits, gifts, spots }
  } catch {
    return { rooms: [], visits: [], gifts: [], spots: [] }
  }
}

const TAB_TTL_MS = 45_000

type Listener = { id: string | null; watch: number; isSocket: boolean; send: (text: string) => void }

export type ChannelCount = { channel: number; count: number }

export type Seat = { channel: number; channels: ChannelCount[]; channelSize: number }

export const CHANNEL_SIZE = 20

const MAX_CHANNEL = 999

const WALK_GAP_MS = 100

export const pickChannel = (counts: ReadonlyMap<number, number>, size: number): number =>
  Array.from({ length: counts.size + 1 }, (_, index) => index + 1).find(channel => (counts.get(channel) ?? 0) < size) ?? counts.size + 1

const channelParam = (url: URL): number => {
  const value = Number(url.searchParams.get('channel'))
  return Number.isInteger(value) && value >= 1 && value <= MAX_CHANNEL ? value : 1
}

type SocketData = { id: string | null; watch: number }

type Upgrader = { upgrade: (request: Request, options: { data: SocketData }) => boolean }

type Peer = { data: SocketData; send: (text: string) => unknown }

const sseMessage = (name: string, data: unknown): string => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`

const sameLook = (a: Member | undefined, b: Member | undefined): boolean =>
  a !== undefined && b !== undefined && JSON.stringify({ ...a, lastSeen: 0 }) === JSON.stringify({ ...b, lastSeen: 0 })

const STATUS_RANK: Readonly<Record<Status, number>> = { away: 0, idle: 1, resting: 2, working: 3 }

export const mergeTabs = ([first, ...rest]: readonly [Member, ...Member[]]): Member => {
  const lead = rest.reduce(
    (best, report) =>
      STATUS_RANK[report.status] > STATUS_RANK[best.status] || (STATUS_RANK[report.status] === STATUS_RANK[best.status] && report.lastSeen > best.lastSeen) ? report : best,
    first,
  )
  const { tab, ...member } = lead
  return { ...member, lastSeen: Math.max(first.lastSeen, ...rest.map(report => report.lastSeen)) }
}

const senderOf = (me: Member): PlazaEvent['from'] => ({ id: me.id, name: me.name, color: me.color, ...(me.species === undefined ? {} : { species: me.species }), ...(me.wear === undefined ? {} : { wear: me.wear }) })

export const actionPrompt = (from: Member, to: Member | null, kind: Action): string =>
  [
    `"${from.name}"(이)라는 작은 픽셀 펫이 ${to === null ? '광장의 모두' : `"${to.name}"(이)라는 다른 펫`}에게 ${ACTION_WORDS[kind]}를 건넨다.`,
    '받는 사람은 AI와 코딩하느라 지친 개발자다. 이 도구의 목적은 인지 부하를 덜고 잠깐 숨을 돌리게 하는 것이다.',
    '펫이 건넬 다정한 반말 한 줄을 30자 이내로 써. 재촉하지 말고, 이모지와 따옴표 없이 문장만.',
  ].join('\n')

export const dllmGenerator = (env: Readonly<Record<string, string | undefined>>, fetcher: typeof fetch = fetch): Generate => {
  const base = (env.TOKO_DLLM_URL ?? '').trim().replace(/\/+$/, '')
  if (base.length === 0) {
    return async () => null
  }
  const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
  const timeoutMs = Number(env.TOKO_DLLM_TIMEOUT_MS ?? 2500)
  return async prompt => {
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(env.TOKO_DLLM_KEY ? { authorization: `Bearer ${env.TOKO_DLLM_KEY}` } : {}),
        },
        body: JSON.stringify({
          model: env.TOKO_DLLM_MODEL ?? 'claude-haiku-4-5',
          messages: [
            { role: 'system', content: '너는 개발자 곁에 사는 다정한 픽셀 펫이다. 한국어 반말 한 줄로만 답한다.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 60,
          temperature: 0.8,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        return null
      }
      const json = asRecord(await response.json())
      const choice = asRecord(Array.isArray(json?.choices) ? json.choices[0] : null)
      const content = asRecord(choice?.message)?.content
      return typeof content === 'string' ? content : null
    } catch {
      return null
    }
  }
}

const COLOR_HEX: Readonly<Record<Color, string>> = { honey: 'ffdd99', mint: 'aaeecc', peach: 'ffbbaa', lavender: 'ccbbee' }
const MOOD_LABEL: Readonly<Record<Mood, string>> = { excited: '신남', calm: '평온', sleepy: '졸림', worried: '걱정', sulky: '삐짐' }

const STAND_IN: readonly string[] = [
  '................',
  '....oooooooo....',
  '..oobbbbbbbboo..',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  'obbwebbbbbbwebbo',
  'obbeebbbbbbeebbo',
  'obpbbbbmmbbbbpbo',
  'obbbbbbbbbbbbbbo',
  'obbbbbbbbbbbbbbo',
  '.obbbbbbbbbbbbo.',
  '.obbbbbbbbbbbbo.',
  '..obbbbbbbbbbo..',
  '...oooooooooo...',
  '...oo......oo...',
  '................',
]

const STAND_IN_KEYS: Readonly<Record<string, string>> = { o: '0', b: '1', w: '2', e: '3', p: '4', m: '5' }

const standIn = (color: Color): Sprite => ({
  palette: ['332233', COLOR_HEX[color], 'ffffff', '221122', 'ff9999', '883344'],
  rows: STAND_IN.map(row => row.replace(/[a-z]/g, key => STAND_IN_KEYS[key] ?? '.')),
})

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)

const hashOf = (text: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
  }
  return hash.toString(36)
}

export type Spot = { u: number; v: number }

export type Chat = { id: string; from: string; at: number; text: string; channel: number }

export const CHAT_TTL_MS = 30_000
const MAX_CHATS = 20

export type RoomView = { key: string; name: string; isOwnerOut: boolean; picture: Sprite; owner: Sprite; guests: { name: string; sprite: Sprite }[] }

export type PlazaView = {
  now: number
  pets: { key: string; name: string; mood: Mood; sprite: Sprite; spot?: [number, number] }[]
  events: { key: string; at: number; kind: Action; from: string; to: string | null; line: string }[]
  bonks: BonkBoard
  rooms: RoomView[]
  weather: Weather | null
  chats: { key: string; from: string; at: number; text: string }[]
} & Seat

const isAction = (kind: PlazaEvent['kind']): kind is Action => ACTIONS.has(kind)

export const plazaView = (
  members: readonly Member[],
  events: readonly PlazaEvent[],
  now: number,
  bonks: BonkBoard = NO_BONKS,
  rooms: RoomView[] = [],
  weather: Weather | null = null,
  spots: ReadonlyMap<string, Spot> = new Map(),
  chats: readonly Chat[] = [],
  seat: Seat = { channel: 1, channels: [{ channel: 1, count: members.length }], channelSize: CHANNEL_SIZE },
): PlazaView => ({
  ...seat,
  now,
  bonks,
  weather,
  pets: members.map(member => {
    const spot = spots.get(member.id)
    return { key: hashOf(member.id), name: member.name, mood: member.mood, sprite: member.sprite ?? standIn(member.color), ...(spot === undefined ? {} : { spot: [spot.u, spot.v] as [number, number] }) }
  }),
  events: events
    .flatMap(event => (isAction(event.kind) ? [{ key: hashOf(event.id), at: event.at, kind: event.kind, from: hashOf(event.from.id), to: event.to === null ? null : hashOf(event.to), line: event.line }] : []))
    .slice(-20),
  rooms,
  chats: chats.filter(chat => now - chat.at < CHAT_TTL_MS).map(chat => ({ key: hashOf(chat.id), from: hashOf(chat.from), at: chat.at, text: chat.text })),
})

const PAGE = await Bun.file(`${import.meta.dir}/page.html`).text()

export const statusPage = (view: PlazaView): string => {
  const roster = view.pets.map(pet => `<li>${escapeHtml(pet.name)} · ${MOOD_LABEL[pet.mood]}</li>`).join('')
  return PAGE.replace('{{count}}', () => String(view.pets.length))
    .replace('{{empty}}', () => (view.pets.length === 0 ? '' : 'hidden'))
    .replace('{{roster}}', () => roster || '<li>아직 아무도 없어요</li>')
    .replace('{{state}}', () => JSON.stringify(view).replace(/</g, '\\u003c'))
}

export type Runner = (argv: readonly string[], timeoutMs: number) => Promise<string | null>

const runProcess: Runner = async (argv, timeoutMs) => {
  try {
    const child = Bun.spawn([...argv], { stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' })
    const timer = setTimeout(() => child.kill(), timeoutMs)
    const [text, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
    clearTimeout(timer)
    return code === 0 ? text : null
  } catch {
    return null
  }
}

export const claudeCodeGenerator = (env: Readonly<Record<string, string | undefined>>, run: Runner = runProcess): Generate => {
  if (!env.CLAUDE_CODE_OAUTH_TOKEN) {
    return async () => null
  }
  const timeoutMs = Number(env.TOKO_CLAUDE_TIMEOUT_MS ?? 20000)
  const model = env.TOKO_CLAUDE_MODEL ?? 'haiku'
  let running = 0
  return async prompt => {
    if (running >= 2) {
      return null
    }
    running += 1
    try {
      return await run(['claude', '-p', '--model', model, '--max-turns', '1', '--output-format', 'text', prompt], timeoutMs)
    } finally {
      running -= 1
    }
  }
}

export const pickGenerator = (env: Readonly<Record<string, string | undefined>>): { generate: Generate; source: string } => {
  if ((env.TOKO_DLLM_URL ?? '').trim().length > 0) {
    return { generate: dllmGenerator(env), source: 'LLM gateway' }
  }
  if (env.CLAUDE_CODE_OAUTH_TOKEN) {
    return { generate: claudeCodeGenerator(env), source: 'Claude Code (OAuth)' }
  }
  return { generate: async () => null, source: 'fallback lines' }
}

const POST_PATHS: ReadonlySet<string> = new Set(['/v1/poll', '/v1/act', '/v1/channel', '/v1/bonk', '/v1/visit', '/v1/visit/end', '/v1/room/act', '/v1/room/sticker', '/v1/gift', '/v1/gift/take'])

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

const readBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  const text = await request.text()
  if (text.length > MAX_BODY) {
    return null
  }
  try {
    return asRecord(JSON.parse(text))
  } catch {
    return null
  }
}

export const fileStorage = (path: string): Storage => {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    read: () => (existsSync(path) ? readFileSync(path, 'utf8') : null),
    write: text => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, text)
      }, 500)
    },
  }
}

export const createPlaza = (options: PlazaOptions = {}) => {
  const now = options.now ?? (() => Date.now())
  const generate = options.generate ?? (async () => null)
  const friendTtlMs = options.friendTtlMs ?? 90_000
  const maxEvents = options.maxEvents ?? 500
  const actionsPerMinute = options.actionsPerMinute ?? 12
  const keepAliveMs = options.keepAliveMs ?? 15_000
  const flushMs = options.flushMs ?? 1_000
  const members = new Map<string, Member>()
  const tabs = new Map<string, Map<string, Member>>()
  const actions = new Map<string, number[]>()
  const changed = new Map<string, number>()
  const listeners = new Set<Listener>()
  const maxGuests = options.maxGuests ?? 2
  const channelSize = options.channelSize ?? CHANNEL_SIZE
  const seats = new Map<string, number>()
  const sockets = new Map<Peer, Listener>()
  const walkedAt = new Map<string, number>()
  const waitingWalks = new Map<string, ReturnType<typeof setTimeout>>()
  const storage = options.storage
  const saved = parseSaved(storage?.read() ?? null)
  const rooms = new Map<string, Room>(saved.rooms.map(room => [room.owner.id, room]))
  const visits = new Map<string, Visit>(saved.visits.map(visit => [visit.guest.id, visit]))
  const gifts = new Map<string, Gift[]>(saved.gifts)
  const stickerDays = new Map<string, number>()
  let events: PlazaEvent[] = []
  let pending: Promise<void>[] = []
  let counter = 0
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let bonkDay = ''
  const bonkCounts = new Map<string, number>()
  let weather: Weather | null = null
  const spots = new Map<string, Spot>(saved.spots)
  let chats: Chat[] = []

  const nextId = (): string => {
    counter += 1
    return `e${now().toString(36)}${counter.toString(36)}`
  }

  const seatOf = (id: string): number => seats.get(id) ?? 1

  const channelCounts = (): Map<number, number> => new Map([...Map.groupBy(seats.values(), channel => channel)].map(([channel, list]) => [channel, list.length]))

  const channelList = (): ChannelCount[] => {
    const counts = channelCounts()
    return [...new Set([1, ...counts.keys()])].sort((a, b) => a - b).map(channel => ({ channel, count: counts.get(channel) ?? 0 }))
  }

  const seatView = (channel: number): Seat => ({ channel, channels: channelList(), channelSize })

  const isReachableChannel = (channel: unknown): channel is number =>
    typeof channel === 'number' && Number.isInteger(channel) && channel >= 1 && channel <= Math.min(MAX_CHANNEL, Math.max(0, ...channelCounts().keys()) + 1)

  const channelFor = (listener: Listener): number => (listener.id !== null && seats.has(listener.id) ? seatOf(listener.id) : listener.watch)

  const byActivity = (a: Member, b: Member): number => STATUS_RANK[b.status] - STATUS_RANK[a.status] || (changed.get(b.id) ?? 0) - (changed.get(a.id) ?? 0)

  const ranked = (): Member[] => [...members.values()].sort(byActivity)

  const friendsOf = (id: string, order: readonly Member[] = ranked()): (Omit<Member, 'sprite'> & { isRoomOpen: boolean })[] =>
    order
      .filter(member => member.id !== id && seatOf(member.id) === seatOf(id))
      .slice(0, 30)
      .map(member => ({ ...friendOf(member), isRoomOpen: rooms.get(member.id)?.isOpen === true }))

  const persist = (): void => {
    storage?.write(JSON.stringify({ rooms: [...rooms.values()], visits: [...visits.values()], gifts: [...gifts.entries()], spots: [...spots.entries()] }))
  }

  const guestsOf = (host: string) => [...visits.values()].filter(visit => visit.host === host).map(visit => ({ ...visit.guest, since: visit.since }))

  const awayOf = (id: string) => {
    const visit = visits.get(id)
    if (visit === undefined) {
      return null
    }
    const host = rooms.get(visit.host)?.owner ?? members.get(visit.host)
    return { host: visit.host, hostName: host?.name ?? '친구', since: visit.since, notes: visit.notes }
  }

  const homeOf = (id: string) => ({ guests: guestsOf(id), away: awayOf(id), stickers: (rooms.get(id)?.stickers ?? []).map(sticker => sticker.kind), gifts: gifts.get(id) ?? [] })

  const spriteFor = (card: Card): Sprite => members.get(card.id)?.sprite ?? standIn(card.color)

  const roomsView = (): RoomView[] =>
    [...rooms.values()]
      .filter((room): room is Room & { picture: Sprite } => room.isOpen && room.picture !== undefined)
      .map(room => ({
        key: hashOf(room.owner.id),
        name: room.owner.name,
        isOwnerOut: !members.has(room.owner.id),
        picture: room.picture,
        owner: spriteFor(room.owner),
        guests: [...visits.values()].filter(stay => stay.host === room.owner.id).map(stay => ({ name: stay.guest.name, sprite: spriteFor(stay.guest) })),
      }))
      .sort((a, b) => Number(a.isOwnerOut) - Number(b.isOwnerOut))


  const eventsFor = (id: string, since: number): PlazaEvent[] =>
    events.filter(event => event.at > since && event.from.id !== id && (event.to === id || (event.to === null && event.channel === seatOf(id)))).slice(-20)

  const bonkBoard = (at: number): BonkBoard => {
    if (kstDayOf(at) !== bonkDay) {
      return NO_BONKS
    }
    const counts = [...bonkCounts].sort((a, b) => b[1] - a[1])
    return { total: counts.reduce((sum, [, count]) => sum + count, 0), top: counts.slice(0, 5).map(([kind, count]) => ({ kind, label: BONK_KINDS[kind] ?? '', count })) }
  }

  const viewAt = (at: number, channel: number): PlazaView =>
    plazaView(
      [...members.values()].filter(member => seatOf(member.id) === channel),
      events.filter(event => event.channel === channel),
      at,
      bonkBoard(at),
      roomsView(),
      weather,
      spots,
      chats.filter(chat => chat.channel === channel),
      seatView(channel),
    )

  const viewMessage = (listener: Listener, view: PlazaView): string => (listener.isSocket ? JSON.stringify({ t: 'view', view }) : sseMessage('view', view))

  const messageFor = (listener: Listener, at: number, order?: readonly Member[]): string =>
    listener.isSocket || listener.id === null
      ? viewMessage(listener, viewAt(at, channelFor(listener)))
      : sseMessage('plaza', { now: at, friends: friendsOf(listener.id, order), events: eventsFor(listener.id, 0), bonks: bonkBoard(at), weather, ...homeOf(listener.id), ...seatView(seatOf(listener.id)) })

  const flush = (): void => {
    clearTimeout(flushTimer)
    flushTimer = undefined
    const at = now()
    const order = ranked()
    const views = new Map<number, PlazaView>()
    const texts = new Map<string, string>()
    for (const listener of listeners) {
      if (listener.isSocket || listener.id === null) {
        const channel = channelFor(listener)
        const key = `${channel}:${listener.isSocket}`
        const view = views.get(channel) ?? viewAt(at, channel)
        const text = texts.get(key) ?? viewMessage(listener, view)
        views.set(channel, view)
        texts.set(key, text)
        listener.send(text)
      } else {
        listener.send(messageFor(listener, at, order))
      }
    }
  }

  const relay = (channel: number, message: unknown): void => {
    const text = JSON.stringify(message)
    for (const listener of sockets.values()) {
      if (channelFor(listener) === channel) {
        listener.send(text)
      }
    }
  }

  const broadcast = (): void => {
    flushTimer ??= setTimeout(flush, flushMs)
  }

  const setWeather = (next: Weather | null): void => {
    const isSame = weatherKey(next) === weatherKey(weather)
    weather = next
    if (!isSame) {
      broadcast()
    }
  }

  const record = (event: PlazaEvent): void => {
    events = [...events, { ...event, channel: event.channel ?? seatOf(event.from.id) }].slice(-maxEvents)
    broadcast()
  }

  const prune = (at: number): void => {
    const before = members.size
    for (const [id, member] of members) {
      if (at - member.lastSeen > friendTtlMs) {
        members.delete(id)
        tabs.delete(id)
        actions.delete(id)
        actions.delete(`bonk:${id}`)
        actions.delete(`say:${id}`)
        actions.delete(`move:${id}`)
        walkedAt.delete(id)
        clearTimeout(waitingWalks.get(id))
        waitingWalks.delete(id)
        changed.delete(id)
        seats.delete(id)
      }
    }
    if (members.size !== before) {
      broadcast()
    }
  }

  const remerge = (id: string): void => {
    const [first, ...rest] = [...(tabs.get(id)?.values() ?? [])]
    if (first !== undefined) {
      members.set(id, mergeTabs([first, ...rest]))
    }
  }

  const cardOf = (me: Member): PlazaEvent['from'] => senderOf(members.get(me.id) ?? me)

  const keepCards = (me: Member): boolean => {
    const card = cardOf(me)
    const visit = visits.get(me.id)
    const room = rooms.get(me.id)
    const isStale = (visit !== undefined && JSON.stringify(visit.guest) !== JSON.stringify(card)) || (room !== undefined && JSON.stringify(room.owner) !== JSON.stringify(card))
    if (!isStale) {
      return false
    }
    if (visit !== undefined) {
      visits.set(me.id, { ...visit, guest: card })
    }
    if (room !== undefined) {
      rooms.set(me.id, { ...room, owner: card })
    }
    persist()
    return true
  }

  const keepRoom = (me: Member, raw: Record<string, unknown> | null): void => {
    const layout = parseLayout(raw?.room)
    if (layout === null) {
      return
    }
    const picture = parsePicture(raw?.roomPicture)
    const before = rooms.get(me.id)
    const room: Room = { owner: cardOf(me), layout, isOpen: raw?.isRoomOpen !== false, ...(picture === null ? {} : { picture }), stickers: before?.stickers ?? [] }
    if (JSON.stringify(before) === JSON.stringify(room)) {
      return
    }
    rooms.set(me.id, room)
    persist()
    broadcast()
  }

  const join = (me: Member): void => {
    const before = members.get(me.id)
    if (!seats.has(me.id)) {
      seats.set(me.id, pickChannel(channelCounts(), channelSize))
    }
    if (!spots.has(me.id)) {
      const taken = [...members.keys()].map(id => spots.get(id)).filter((spot): spot is Spot => spot !== undefined)
      spots.set(me.id, pickSpot(me.id, taken))
      persist()
    }
    const reports = tabs.get(me.id) ?? new Map<string, Member>()
    reports.set(me.tab ?? '', me)
    for (const [tab, report] of reports) {
      if (me.lastSeen - report.lastSeen > TAB_TTL_MS) {
        reports.delete(tab)
      }
    }
    tabs.set(me.id, reports)
    remerge(me.id)
    const isNewLook = !sameLook(before, members.get(me.id))
    if (isNewLook) {
      changed.set(me.id, me.lastSeen)
    }
    if (keepCards(me) || isNewLook) {
      broadcast()
    }
  }

  const touch = (id: string, tab: string, at: number): void => {
    const report = tabs.get(id)?.get(tab)
    if (report !== undefined) {
      tabs.get(id)?.set(tab, { ...report, lastSeen: at })
      remerge(id)
    }
  }

  const stream = (id: string | null, tab: string, watch: number): Response => {
    const encoder = new TextEncoder()
    let listener: Listener | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    const close = (): void => {
      clearInterval(timer)
      if (listener !== null) {
        listeners.delete(listener)
      }
    }
    const body = new ReadableStream<Uint8Array>({
      start: controller => {
        const send = (text: string): void => {
          try {
            controller.enqueue(encoder.encode(text))
          } catch {
            close()
          }
        }
        const opened: Listener = { id, watch, isSocket: false, send }
        listener = opened
        listeners.add(opened)
        send(`retry: 3000\n\n${messageFor(opened, now())}`)
        timer = setInterval(() => {
          const at = now()
          if (id !== null) {
            touch(id, tab, at)
          }
          prune(at)
          send(': ping\n\n')
        }, keepAliveMs)
      },
      cancel: close,
    })
    return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } })
  }

  const isRateLimited = (id: string, at: number): boolean => {
    const recent = (actions.get(id) ?? []).filter(time => at - time < 60_000)
    const isLimited = recent.length >= actionsPerMinute
    actions.set(id, isLimited ? recent : [...recent, at])
    return isLimited
  }

  const settleWalk = (id: string, spot: Spot): void => {
    waitingWalks.delete(id)
    if (!members.has(id)) {
      return
    }
    walkedAt.set(id, now())
    spots.set(id, spot)
    persist()
    relay(seatOf(id), { t: 'walk', key: hashOf(id), spot: [spot.u, spot.v] })
    broadcast()
  }

  const place = (id: string, u: unknown, v: unknown): Response => {
    const raw = { u, v }
    if (!isSpot(raw)) {
      return json(400, { error: 'bad request' })
    }
    const spot = { u: toSpot(raw.u), v: toSpot(raw.v) }
    const wait = WALK_GAP_MS - (now() - (walkedAt.get(id) ?? -Infinity))
    clearTimeout(waitingWalks.get(id))
    if (wait > 0) {
      waitingWalks.set(id, setTimeout(() => settleWalk(id, spot), wait))
      return json(202, { ok: true, queued: true })
    }
    settleWalk(id, spot)
    return json(202, { ok: true })
  }

  const speak = (id: string, raw: unknown): Response => {
    const at = now()
    const text = clean(raw, 40)
    if (text.length === 0 || FORBIDDEN.test(text)) {
      return json(400, { error: 'that line cannot be said here' })
    }
    if (isRateLimited(`say:${id}`, at)) {
      return json(429, { error: 'too many lines, take a breath' })
    }
    const said = { id: nextId(), from: id, at, text, channel: seatOf(id) }
    chats = [...chats.filter(chat => at - chat.at < CHAT_TTL_MS), said].slice(-MAX_CHATS)
    relay(said.channel, { t: 'say', chat: { key: hashOf(said.id), from: hashOf(id), at, text } })
    broadcast()
    return json(202, { ok: true })
  }

  const move = (id: string, channel: unknown): Response => {
    if (!isReachableChannel(channel)) {
      return json(400, { error: 'bad request' })
    }
    if (isRateLimited(`move:${id}`, now())) {
      return json(429, { error: 'too many moves, take a breath' })
    }
    if (channel !== seatOf(id) && (channelCounts().get(channel) ?? 0) >= channelSize) {
      return json(409, { error: 'that channel is full' })
    }
    seats.set(id, channel)
    broadcast()
    return json(200, { ok: true, ...seatView(channel) })
  }

  const fallbackLine = (kind: Action): string => {
    const lines = FALLBACK_LINES[kind]
    return lines[counter % lines.length] ?? lines[0] ?? ''
  }

  const poll = (me: Member, since: number): Response => {
    const at = me.lastSeen
    prune(at)
    const isNew = !members.has(me.id)
    join(me)
    if (isNew) {
      record({ id: nextId(), at, kind: 'join', from: senderOf(me), to: null, line: '' })
    }
    return json(200, { now: at, friends: friendsOf(me.id), events: eventsFor(me.id, since), bonks: bonkBoard(at), weather, ...homeOf(me.id), ...seatView(seatOf(me.id)) })
  }

  const bonk = (me: Member, kind: string): Response => {
    const at = me.lastSeen
    if (isRateLimited(`bonk:${me.id}`, at)) {
      return json(429, { error: 'too many bonks, take a breath' })
    }
    if (kstDayOf(at) !== bonkDay) {
      bonkDay = kstDayOf(at)
      bonkCounts.clear()
    }
    bonkCounts.set(kind, (bonkCounts.get(kind) ?? 0) + 1)
    broadcast()
    return json(202, { ok: true })
  }

  const visit = (me: Member, to: string): Response => {
    const at = me.lastSeen
    join(me)
    const room = rooms.get(to)
    if (to === me.id || room === undefined || !room.isOpen) {
      return json(403, { error: 'that room is not open for visits' })
    }
    if (visits.get(me.id)?.host === to) {
      return json(200, { ok: true, ...homeOf(me.id) })
    }
    if (guestsOf(to).length >= maxGuests) {
      return json(409, { error: 'the room is full' })
    }
    const before = visits.get(me.id)
    visits.set(me.id, { guest: cardOf(me), host: to, since: at, notes: [] })
    persist()
    if (before !== undefined) {
      record({ id: nextId(), at, kind: 'home', from: senderOf(me), to: before.host, line: `${me.name}이(가) 집에 갔어`, guest: me.id })
    }
    record({ id: nextId(), at, kind: 'visit', from: senderOf(me), to, line: `${me.name}이(가) 놀러 왔어`, guest: me.id })
    return json(200, { ok: true, ...homeOf(me.id) })
  }

  const leave = (me: Member, guest: string | null): Response => {
    const at = me.lastSeen
    join(me)
    const id = guest ?? me.id
    const stay = visits.get(id)
    if (stay === undefined || (guest !== null && stay.host !== me.id)) {
      return json(404, { error: 'no such visit' })
    }
    visits.delete(id)
    persist()
    const to = guest === null ? stay.host : guest
    record({ id: nextId(), at, kind: 'home', from: senderOf(me), to, line: guest === null ? `${me.name}이(가) 집에 갔어` : `${me.name}네 방에서 집으로 돌아왔어`, guest: id })
    return json(200, { ok: true, ...homeOf(me.id) })
  }

  const sticker = (me: Member, to: string, kind: string): Response => {
    const at = me.lastSeen
    join(me)
    const room = rooms.get(to)
    if (to === me.id || room === undefined || !room.isOpen) {
      return json(403, { error: 'that room is not open for visits' })
    }
    const key = `${me.id}:${new Date(at).toISOString().slice(0, 10)}`
    const used = stickerDays.get(key) ?? 0
    if (used >= STICKERS_PER_DAY) {
      return json(429, { error: 'three stickers a day' })
    }
    stickerDays.set(key, used + 1)
    rooms.set(to, { ...room, stickers: [...(room.stickers ?? []), { kind, from: me.name, at }].slice(-MAX_STICKERS) })
    persist()
    record({ id: nextId(), at, kind: 'sticker', from: senderOf(me), to, line: `${me.name}이(가) 다녀갔어` })
    return json(200, { ok: true })
  }

  const gift = (me: Member, to: string, item: string): Response => {
    const at = me.lastSeen
    join(me)
    if (to === me.id || (!members.has(to) && !rooms.has(to))) {
      return json(404, { error: 'that friend is not around' })
    }
    const pending = gifts.get(to) ?? []
    if (pending.length >= MAX_GIFTS) {
      return json(409, { error: 'too many gifts waiting' })
    }
    gifts.set(to, [...pending, { id: nextId(), item, from: me.name, at }])
    persist()
    record({ id: nextId(), at, kind: 'gift', from: senderOf(me), to, line: `${me.name}이(가) 선물을 보냈어` })
    return json(200, { ok: true })
  }

  const takeGifts = (me: Member, ids: readonly string[]): Response => {
    join(me)
    const left = (gifts.get(me.id) ?? []).filter(entry => !ids.includes(entry.id))
    if (left.length === 0) {
      gifts.delete(me.id)
    } else {
      gifts.set(me.id, left)
    }
    persist()
    return json(200, { ok: true })
  }

  const roomAct = (me: Member, guest: string, kind: RoomAct): Response => {
    const at = me.lastSeen
    join(me)
    if (isRateLimited(me.id, at)) {
      return json(429, { error: 'too many actions, take a breath' })
    }
    const stay = visits.get(guest)
    if (stay === undefined || (me.id !== stay.host && me.id !== guest)) {
      return json(404, { error: 'no such visit' })
    }
    const note = ROOM_ACT_NOTES[kind]
    visits.set(guest, { ...stay, notes: [...stay.notes, note].slice(-MAX_NOTES) })
    persist()
    record({ id: nextId(), at, kind: 'room-act', from: senderOf(me), to: me.id === stay.host ? guest : stay.host, line: note, act: kind, guest })
    return json(200, { ok: true })
  }

  const cast = (me: Member, kind: Action, toId: string | null, at: number): Response => {
    if (isRateLimited(me.id, at)) {
      return json(429, { error: 'too many actions, take a breath' })
    }
    const to = toId === null ? null : (members.get(toId) ?? null)
    if (toId !== null && to === null) {
      return json(404, { error: 'that friend is not in the plaza' })
    }
    if (to !== null && seatOf(to.id) !== seatOf(me.id)) {
      return json(404, { error: 'that friend is not in your channel' })
    }
    const id = nextId()
    const from = senderOf(me)
    const channel = seatOf(me.id)
    const task = generate(actionPrompt(me, to, kind))
      .catch(() => null)
      .then(raw => record({ id, at: now(), kind, from, to: to?.id ?? null, line: sanitizeLine(raw) ?? fallbackLine(kind), channel }))
    pending = [...pending, task]
    void task.finally(() => {
      pending = pending.filter(other => other !== task)
    })
    return json(202, { ok: true, queued: true, id })
  }

  const act = async (me: Member, kind: Action, toId: string | null): Promise<Response> => {
    join(me)
    return cast(me, kind, toId, me.lastSeen)
  }

  const castByKey = (id: string, kind: unknown, key: unknown): Response => {
    const me = members.get(id)
    const to = [...members.values()].find(member => member.id !== id && hashOf(member.id) === key)
    if (me === undefined || !ACTIONS.has(String(kind))) {
      return json(400, { error: 'bad request' })
    }
    return to === undefined ? json(404, { error: 'that friend is not in the plaza' }) : cast(me, kind as Action, to.id, now())
  }

  const handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/') {
      prune(now())
      return new Response(statusPage(viewAt(now(), channelParam(url))), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
    }
    if (request.method === 'GET' && url.pathname === '/v1/plaza') {
      prune(now())
      return json(200, viewAt(now(), channelParam(url)))
    }
    if (request.method === 'GET' && url.pathname === '/v1/plaza/stream') {
      prune(now())
      return stream(null, '', channelParam(url))
    }
    if (request.method === 'GET' && url.pathname === '/v1/stream') {
      const id = url.searchParams.get('id') ?? ''
      const tab = url.searchParams.get('tab') ?? ''
      if (!/^[a-z0-9-]{4,64}$/i.test(id)) {
        return json(400, { error: 'bad request' })
      }
      prune(now())
      return stream(id, /^[a-z0-9]{1,16}$/i.test(tab) ? tab : '', 1)
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true, members: members.size, weather: weather?.level ?? null })
    }
    if (request.method === 'GET' && url.pathname === '/v1/room') {
      const room = rooms.get(url.searchParams.get('id') ?? '')
      return room === undefined || !room.isOpen ? json(404, { error: 'not found' }) : json(200, { ...room, stickers: (room.stickers ?? []).map(sticker => sticker.kind), guests: guestsOf(room.owner.id) })
    }
    if (request.method === 'POST' && (url.pathname === '/v1/walk' || url.pathname === '/v1/say')) {
      const body = await readBody(request)
      if (body === null || typeof body.id !== 'string') {
        return json(400, { error: 'bad request' })
      }
      prune(now())
      if (!members.has(body.id)) {
        return json(404, { error: 'that pet is not in the plaza' })
      }
      return url.pathname === '/v1/walk' ? place(body.id, body.u, body.v) : speak(body.id, body.text)
    }
    if (request.method !== 'POST' || !POST_PATHS.has(url.pathname)) {
      return json(404, { error: 'not found' })
    }
    const body = await readBody(request)
    const me = parseMe(body?.me, now())
    if (body === null || me === null) {
      return json(400, { error: 'bad request' })
    }
    keepRoom(me, asRecord(body.me))
    if (url.pathname === '/v1/channel') {
      prune(now())
      join(me)
      return move(me.id, body.channel)
    }
    if (url.pathname === '/v1/visit') {
      return typeof body.to === 'string' ? visit(me, body.to) : json(400, { error: 'bad request' })
    }
    if (url.pathname === '/v1/visit/end') {
      return leave(me, typeof body.guest === 'string' ? body.guest : null)
    }
    if (url.pathname === '/v1/room/sticker') {
      return typeof body.to === 'string' && STICKER_KINDS.has(String(body.kind)) ? sticker(me, body.to, String(body.kind)) : json(400, { error: 'bad request' })
    }
    if (url.pathname === '/v1/gift') {
      return typeof body.to === 'string' && /^[a-z][a-z-]{0,23}$/.test(String(body.item)) ? gift(me, body.to, String(body.item)) : json(400, { error: 'bad request' })
    }
    if (url.pathname === '/v1/gift/take') {
      return takeGifts(me, Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [])
    }
    if (url.pathname === '/v1/room/act') {
      return typeof body.guest === 'string' && ROOM_ACTS.has(String(body.kind)) ? roomAct(me, body.guest, body.kind as RoomAct) : json(400, { error: 'bad request' })
    }
    if (url.pathname === '/v1/poll') {
      return poll(me, typeof body.since === 'number' ? body.since : 0)
    }
    if (url.pathname === '/v1/bonk') {
      const kind = String(body.kind)
      return Object.hasOwn(BONK_KINDS, kind) ? bonk(me, kind) : json(400, { error: 'unknown bonk' })
    }
    const kind = String(body.kind)
    if (!ACTIONS.has(kind)) {
      return json(400, { error: 'unknown action' })
    }
    return act(me, kind as Action, typeof body.to === 'string' ? body.to : null)
  }

  const upgrade = (request: Request, server: Upgrader): boolean => {
    const url = new URL(request.url)
    if (request.method !== 'GET' || url.pathname !== '/v1/ws') {
      return false
    }
    const id = url.searchParams.get('id')
    return server.upgrade(request, { data: { id: id !== null && /^[a-z0-9-]{4,64}$/i.test(id) ? id : null, watch: channelParam(url) } })
  }

  const answer = (listener: Listener, of: string, response: Response): void => {
    if (!response.ok) {
      listener.send(JSON.stringify({ t: 'error', of, status: response.status }))
    }
  }

  const rewatch = (peer: Peer, listener: Listener, watch: number): Listener => {
    const next = { ...listener, watch }
    listeners.delete(listener)
    listeners.add(next)
    sockets.set(peer, next)
    return next
  }

  const hear = (peer: Peer, raw: string | Uint8Array): void => {
    const listener = sockets.get(peer)
    const message = typeof raw === 'string' && raw.length <= MAX_BODY ? asRecord(JSON.parse(raw)) : null
    if (listener === undefined || message === null) {
      return
    }
    prune(now())
    if (message.t === 'ping') {
      listener.send(JSON.stringify({ t: 'pong' }))
      return
    }
    const id = listener.id
    const isPlaying = id !== null && members.has(id)
    if (message.t === 'move') {
      const response = isPlaying ? move(id, message.channel) : isReachableChannel(message.channel) ? json(200, { ok: true }) : json(400, { error: 'bad request' })
      const next = response.ok && !isPlaying ? rewatch(peer, listener, Number(message.channel)) : listener
      answer(next, 'move', response)
      next.send(messageFor(next, now()))
      return
    }
    if (message.t !== 'walk' && message.t !== 'say' && message.t !== 'act') {
      return
    }
    if (!isPlaying) {
      answer(listener, message.t, json(404, { error: 'that pet is not in the plaza' }))
      return
    }
    if (message.t === 'act') {
      answer(listener, 'act', castByKey(id, message.kind, message.to))
      return
    }
    answer(listener, message.t, message.t === 'walk' ? place(id, message.u, message.v) : speak(id, message.text))
  }

  const websocket = {
    idleTimeout: 120,
    open: (peer: Peer): void => {
      const listener: Listener = { id: peer.data.id, watch: peer.data.watch, isSocket: true, send: text => void peer.send(text) }
      sockets.set(peer, listener)
      listeners.add(listener)
      prune(now())
      listener.send(messageFor(listener, now()))
    },
    message: (peer: Peer, raw: string | Uint8Array): void => {
      try {
        hear(peer, raw)
      } catch {
        return
      }
    },
    close: (peer: Peer): void => {
      const listener = sockets.get(peer)
      if (listener !== undefined) {
        listeners.delete(listener)
      }
      sockets.delete(peer)
    },
  }

  const settle = async (): Promise<void> => {
    await Promise.all(pending)
    if (flushTimer !== undefined) {
      flush()
    }
  }

  return { handle, upgrade, websocket, members, rooms, visits, events: () => events, settle, setWeather }
}

if (import.meta.main) {
  const env = process.env
  const { generate, source } = pickGenerator(env)
  const plaza = createPlaza({ generate, storage: fileStorage(env.TOKO_DATA_FILE ?? `${import.meta.dir}/data/plaza.json`) })
  const server = Bun.serve({
    port: Number(env.PORT ?? 8080),
    hostname: env.HOST ?? '0.0.0.0',
    idleTimeout: 120,
    fetch: (request, bun) => (plaza.upgrade(request, bun) ? undefined : plaza.handle(request)),
    websocket: plaza.websocket,
  })
  const tunerKey = (env.TOKO_TUNER_KEY ?? '').trim()
  if (tunerKey.length > 0) {
    watchWeather(tunerKey, plaza.setWeather)
  }
  console.log(`toko plaza listening on http://${server.hostname}:${server.port} (lines: ${source}, weather: ${tunerKey.length > 0 ? 'claude tuner' : 'off'})`)
}
