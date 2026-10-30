import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { TUNER_USAGE_URL, WEATHER_KEEP_MS, claudeCodeGenerator, createPlaza, dllmGenerator, nextWeather, pickChannel, pickGenerator, readTunerUsage, sanitizeLine, watchWeather, weatherOf } from './plaza'

const me = (id: string, name: string) => ({ id, name, color: 'mint', mood: 'calm', status: 'working' })

const post = (path: string, body: unknown) =>
  new Request(`http://plaza.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const read = async (response: Response) => ({ status: response.status, body: (await response.json()) as Record<string, any> })

const listen = async (path: string, plaza: ReturnType<typeof createPlaza>) => {
  const response = await plaza.handle(new Request(`http://plaza.test${path}`))
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  const next = async (name: string): Promise<Record<string, any>> => {
    const { value } = await reader.read()
    const block = decoder.decode(value).split('\n\n').find(part => part.includes(`event: ${name}`)) ?? ''
    return JSON.parse(block.slice(block.indexOf('data: ') + 6))
  }
  return { type: response.headers.get('content-type'), next, close: () => reader.cancel() }
}

describe('plaza', () => {
  test('a wave reaches its target over the event stream without waiting for a poll', async () => {
    const plaza = createPlaza({ keepAliveMs: 60_000 })
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    const kong = await listen('/v1/stream?id=bbbb2&tab=t1', plaza)
    const page = await listen('/v1/plaza/stream', plaza)
    expect(kong.type).toContain('text/event-stream')
    expect((await kong.next('plaza')).friends.map((friend: { name: string }) => friend.name)).toEqual(['말랑'])
    expect((await page.next('view')).pets.length).toBe(2)
    await plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'wave', to: 'bbbb2' }))
    await plaza.settle()
    expect((await kong.next('plaza')).events.at(-1).kind).toBe('wave')
    expect((await page.next('view')).events.at(-1).kind).toBe('wave')
    expect((await plaza.handle(new Request('http://plaza.test/v1/stream?id=!'))).status).toBe(400)
    await kong.close()
    await page.close()
  })

  test('changes made close together reach a listener as one message', async () => {
    const plaza = createPlaza({ keepAliveMs: 60_000, flushMs: 200 })
    await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    const kong = await listen('/v1/stream?id=bbbb2&tab=t1', plaza)
    await kong.next('plaza')
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('cccc3', '보들'), since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('dddd4', '찹쌀'), since: 0 }))
    expect((await kong.next('plaza')).friends.length).toBe(3)
    const more = await Promise.race([kong.next('plaza').then(() => 'more', () => 'more'), Bun.sleep(300).then(() => 'none')])
    expect(more).toBe('none')
    await kong.close()
  })

  test('friends who are working or just changed come first, so late arrivals are not hidden behind the first thirty', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock, channelSize: 100 })
    for (let i = 10; i < 45; i += 1) {
      clock += 1_000
      await plaza.handle(post('/v1/poll', { me: { ...me(`pet${i}`, `펫${i}`), status: 'idle' }, since: 0 }))
    }
    clock += 1_000
    await plaza.handle(post('/v1/poll', { me: { ...me('pet10', '펫10'), status: 'working' }, since: 0 }))
    const seen = await read(await plaza.handle(post('/v1/poll', { me: { ...me('watcher', '구경꾼'), status: 'idle' }, since: 0 })))
    const ids = seen.body.friends.map((friend: { id: string }) => friend.id)
    expect(ids.length).toBe(30)
    expect(ids[0]).toBe('pet10')
    expect(ids[1]).toBe('pet44')
    expect(ids).not.toContain('pet11')
  })

  test('bonks are counted by kind for the day, odd kinds are refused, and the board starts over the next day', async () => {
    let clock = Date.UTC(2026, 9, 29, 3, 0)
    const plaza = createPlaza({ now: () => clock, actionsPerMinute: 3 })
    const bonk = async (id: string, kind: string) => (await plaza.handle(post('/v1/bonk', { me: me(id, '말랑'), kind }))).status
    expect([await bonk('aaaa1', 'unverified'), await bonk('bbbb2', 'unverified'), await bonk('bbbb2', 'overreach')]).toEqual([202, 202, 202])
    expect(await bonk('aaaa1', '<script>')).toBe(400)
    const board = (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.bonks
    expect(board).toEqual({
      total: 3,
      top: [
        { kind: 'unverified', label: '안 돌려 보고 됐다고 함', count: 2 },
        { kind: 'overreach', label: '시키지 않은 것까지 고침', count: 1 },
      ],
    })
    expect((await read(await plaza.handle(post('/v1/poll', { me: me('cccc3', '보들'), since: 0 })))).body.bonks.total).toBe(3)
    expect([await bonk('aaaa1', 'stuck'), await bonk('aaaa1', 'stuck'), await bonk('aaaa1', 'stuck')]).toEqual([202, 202, 429])
    clock = Date.UTC(2026, 9, 29, 15, 1)
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.bonks).toEqual({ total: 0, top: [] })
    expect(await bonk('aaaa1', 'wordy')).toBe(202)
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.bonks.total).toBe(1)
  })

  test('friends see each other and a wave reaches only its target', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock })
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('cccc3', '보들'), since: 0 }))
    clock += 1_000
    const sent = await read(await plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'wave', to: 'bbbb2' })))
    expect(sent.status).toBe(202)
    await plaza.settle()
    expect((plaza.events().at(-1)?.line.length ?? 0) > 0).toBe(true)
    const forKong = await read(await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 1_500 })))
    const forBodeul = await read(await plaza.handle(post('/v1/poll', { me: me('cccc3', '보들'), since: 1_500 })))
    expect(forKong.body.events.map((event: { kind: string }) => event.kind)).toEqual(['wave'])
    expect(forBodeul.body.events).toEqual([])
    expect(forKong.body.friends.map((friend: { name: string }) => friend.name).sort()).toEqual(['말랑', '보들'])
  })

  test('the LLM gateway writes the line, and a rude or empty line falls back', async () => {
    const replies = ['"같이 숨 한 번 쉬자"', '바보야 일해', null]
    const plaza = createPlaza({ generate: async () => replies.shift() ?? null })
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    for (let round = 0; round < 3; round += 1) {
      await plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'heart', to: null }))
      await plaza.settle()
    }
    const lines = plaza.events().filter(event => event.kind === 'heart').map(event => event.line)
    expect(lines[0]).toBe('같이 숨 한 번 쉬자')
    expect(lines[1]).not.toContain('바보')
    expect((lines[2]?.length ?? 0) > 0).toBe(true)
  })

  test('one person’s tabs show as their busiest tab, and a closed tab stops counting', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock })
    const hat = { palette: ['332233'], rows: ['00', '00'] }
    const bare = { palette: ['332233'], rows: ['..', '00'] }
    const view = async () => (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.pets[0]
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), tab: 'one', status: 'working', mood: 'excited', sprite: hat }, since: 0 }))
    clock += 5_000
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), tab: 'two', status: 'away', mood: 'sleepy', sprite: bare }, since: 0 }))
    expect([(await view()).mood, (await view()).sprite.rows]).toEqual(['excited', hat.rows])
    expect(plaza.members.size).toBe(1)
    clock += 50_000
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), tab: 'two', status: 'away', mood: 'sleepy', sprite: bare }, since: 0 }))
    expect([(await view()).mood, (await view()).sprite.rows]).toEqual(['sleepy', bare.rows])
  })

  test('a wave carries what the sender wears, and odd values are dropped', async () => {
    const plaza = createPlaza()
    const wear = { hat: 'crown', face: 'sunglasses', neck: 'Scarf!', cape: 'red' }
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), wear }, since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    await plaza.handle(post('/v1/act', { me: { ...me('aaaa1', '말랑'), wear }, kind: 'wave', to: 'bbbb2' }))
    await plaza.settle()
    const forKong = await read(await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 })))
    expect(forKong.body.events.at(-1).from.wear).toEqual({ hat: 'crown', face: 'sunglasses' })
  })

  test('too many actions in a minute are refused gently', async () => {
    const plaza = createPlaza({ actionsPerMinute: 2 })
    const act = () => plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'cheer', to: null }))
    expect((await act()).status).toBe(202)
    expect((await act()).status).toBe(202)
    expect((await act()).status).toBe(429)
  })

  test('bad input is refused, and friends who leave drop out', async () => {
    let clock = 0
    const plaza = createPlaza({ now: () => clock, friendTtlMs: 1_000 })
    expect((await plaza.handle(post('/v1/poll', { me: { id: '!', color: 'mint' } }))).status).toBe(400)
    expect((await plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'punch' }))).status).toBe(400)
    expect((await plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'wave', to: 'ghost' }))).status).toBe(404)
    await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    clock = 5_000
    const later = await read(await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 })))
    expect(later.body.friends).toEqual([])
    expect((await plaza.handle(new Request('http://plaza.test/health'))).status).toBe(200)
  })

  test('the gateway client speaks the OpenAI-compatible chat API and gives up quietly', async () => {
    const calls: { url: string; body: any }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify({ choices: [{ message: { content: '천천히 해도 괜찮아' } }] }))
    }) as unknown as typeof fetch
    const generate = dllmGenerator({ TOKO_DLLM_URL: 'https://dllm.example/v1/', TOKO_DLLM_MODEL: 'llada-8b' }, fake)
    expect(await generate('hi')).toBe('천천히 해도 괜찮아')
    expect(calls[0]?.url).toBe('https://dllm.example/v1/chat/completions')
    expect(calls[0]?.body.model).toBe('llada-8b')
    expect(await dllmGenerator({})('hi')).toBe(null)
    const broken = dllmGenerator({ TOKO_DLLM_URL: 'https://dllm.example' }, (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch)
    expect(await broken('hi')).toBe(null)
  })

  test('a species rides along with the pet, and an odd one is dropped', async () => {
    const plaza = createPlaza()
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), species: 'fox' }, since: 0 }))
    await plaza.handle(post('/v1/poll', { me: { ...me('bbbb2', '콩떡'), species: '<script>' }, since: 0 }))
    const seen = await read(await plaza.handle(post('/v1/poll', { me: me('cccc3', '보들'), since: 0 })))
    expect(seen.body.friends.map((friend: { name: string; species?: string }) => [friend.name, friend.species ?? null]).sort()).toEqual([
      ['말랑', 'fox'],
      ['콩떡', null],
    ])
    expect(seen.body.events.find((event: { from: { name: string } }) => event.from.name === '말랑')?.from.species).toBe('fox')
  })

  test('the status page lists the pets in the plaza and escapes their names', async () => {
    const plaza = createPlaza()
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '<b>말랑'), color: 'peach' }, since: 0 }))
    const html = await (await plaza.handle(new Request('http://plaza.test/'))).text()
    expect(html).toContain('1마리')
    expect(html).toContain('&#60;b&#62;말랑')
    expect(html).not.toContain('<b>말랑')
  })

  test('a pet’s own picture reaches the plaza view but not its friends, and a broken one gets a stand-in', async () => {
    const plaza = createPlaza()
    const sprite = { palette: ['332233', 'FFDD99'], rows: ['.00.', '0110', '.00.'] }
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), sprite }, since: 0 }))
    await plaza.handle(post('/v1/poll', { me: { ...me('bbbb2', '콩떡'), sprite: { palette: ['tomato'], rows: ['00'] } }, since: 0 }))
    await plaza.handle(post('/v1/poll', { me: { ...me('cccc3', '보들'), sprite: { palette: ['332233'], rows: ['01'] } }, since: 0 }))
    expect(plaza.members.get('aaaa1')?.sprite).toEqual({ palette: ['332233', 'ffdd99'], rows: sprite.rows })
    expect(plaza.members.get('bbbb2')?.sprite).toBe(undefined)
    expect(plaza.members.get('cccc3')?.sprite).toBe(undefined)
    const seen = await read(await plaza.handle(post('/v1/poll', { me: me('dddd4', '몽떡'), since: 0 })))
    expect(seen.body.friends.filter((friend: { sprite?: unknown }) => friend.sprite !== undefined)).toEqual([])
    const view = await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))
    expect(view.body.pets.map((pet: { name: string; sprite: { palette: string[] } }) => [pet.name, pet.sprite.palette[1]])).toEqual([
      ['말랑', 'ffdd99'],
      ['콩떡', 'aaeecc'],
      ['보들', 'aaeecc'],
      ['몽떡', 'aaeecc'],
    ])
  })

  test('the status page draws the plaza from a public view without plaza ids, and greets an empty plaza', async () => {
    const plaza = createPlaza()
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    await plaza.handle(post('/v1/act', { me: me('aaaa1', '말랑'), kind: 'heart', to: 'bbbb2' }))
    await plaza.settle()
    const view = (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body
    expect(view.events.map((event: { kind: string }) => event.kind)).toEqual(['heart'])
    expect([view.events[0].from, view.events[0].to]).toEqual(view.pets.map((pet: { key: string }) => pet.key))
    const html = await (await plaza.handle(new Request('http://plaza.test/'))).text()
    expect(html).toContain('/v1/ws?')
    expect(html).toContain('fetch(`/v1/plaza?channel=')
    expect(html).not.toContain('{{')
    expect(`${html}${JSON.stringify(view)}`).not.toContain('aaaa1')
    expect(JSON.parse(html.match(/<script id="state" type="application\/json">(.*?)<\/script>/)?.[1] ?? '{}').pets.length).toBe(2)
    expect(await (await createPlaza().handle(new Request('http://plaza.test/'))).text()).toContain('아직 아무도 없어요')
  })

  test('with an OAuth token, Claude Code writes the line, two at a time at most', async () => {
    const calls: string[][] = []
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const run = async (argv: readonly string[]) => {
      calls.push([...argv])
      await gate
      return '같이 숨 한 번 쉬자\n'
    }
    const generate = claudeCodeGenerator({ CLAUDE_CODE_OAUTH_TOKEN: 'x' }, run)
    const first = generate('a')
    const second = generate('b')
    expect(await generate('c')).toBe(null)
    release()
    expect(await first).toBe('같이 숨 한 번 쉬자\n')
    await second
    expect(calls[0]?.slice(0, 4)).toEqual(['claude', '-p', '--model', 'haiku'])
    expect(await claudeCodeGenerator({})('a')).toBe(null)
    expect(pickGenerator({ CLAUDE_CODE_OAUTH_TOKEN: 'x' }).source).toContain('Claude Code')
    expect(pickGenerator({ TOKO_DLLM_URL: 'https://g/v1', CLAUDE_CODE_OAUTH_TOKEN: 'x' }).source).toBe('LLM gateway')
    expect(pickGenerator({}).source).toBe('fallback lines')
  })

  test('lines are trimmed to one short line', () => {
    expect(sanitizeLine('첫 줄\n둘째 줄')).toBe('첫 줄')
    expect(sanitizeLine('가'.repeat(80))?.length).toBe(40)
    expect(sanitizeLine('   ')).toBe(null)
    expect(sanitizeLine('# 제목\n\n"**같이 쉬자**"')).toBe('같이 쉬자')
  })
})

describe('walking and talking from the plaza page', () => {
  test('a pet steered from the page shows its spot and its lines to everyone, without its plaza id', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock })
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    expect((await plaza.handle(post('/v1/walk', { id: 'aaaa1', u: 0.25, v: -3 }))).status).toBe(202)
    expect((await plaza.handle(post('/v1/say', { id: 'aaaa1', text: '  안녕\n 다들  ' }))).status).toBe(202)
    const view = (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body
    expect(view.pets[0].spot).toEqual([0.25, -1])
    expect(view.chats).toEqual([{ key: expect.any(String), from: view.pets[0].key, at: 1_000, text: '안녕 다들' }])
    expect(JSON.stringify(view)).not.toContain('aaaa1')
    clock += 31_000
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.chats).toEqual([])
  })

  test('only a pet in the plaza can walk or talk, rude or empty lines are refused, and talking too much is slowed down', async () => {
    const plaza = createPlaza({ now: () => 1_000, actionsPerMinute: 2 })
    expect((await plaza.handle(post('/v1/walk', { id: 'nobody', u: 0, v: 0 }))).status).toBe(404)
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    expect((await plaza.handle(post('/v1/walk', { id: 'aaaa1', u: 'left', v: 0 }))).status).toBe(400)
    expect((await plaza.handle(post('/v1/say', { id: 'aaaa1', text: '바보야' }))).status).toBe(400)
    expect((await plaza.handle(post('/v1/say', { id: 'aaaa1', text: '   ' }))).status).toBe(400)
    const says = [await plaza.handle(post('/v1/say', { id: 'aaaa1', text: '하나' })), await plaza.handle(post('/v1/say', { id: 'aaaa1', text: '둘' })), await plaza.handle(post('/v1/say', { id: 'aaaa1', text: '셋' }))]
    expect(says.map(response => response.status)).toEqual([202, 202, 429])
  })

  test('every pet gets its own spot away from the fountain and keeps it after a server restart', async () => {
    let saved: string | null = null
    const storage = { read: () => saved, write: (text: string) => (saved = text) }
    const first = createPlaza({ storage })
    for (const [id, name] of [['aaaa1', '말랑'], ['bbbb2', '콩떡'], ['cccc3', '보들'], ['dddd4', '몽글']]) {
      await first.handle(post('/v1/poll', { me: me(id, name), since: 0 }))
    }
    const spotsOf = async (plaza: ReturnType<typeof createPlaza>) =>
      Object.fromEntries((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.pets.map((pet: { name: string; spot: [number, number] }) => [pet.name, pet.spot]))
    const before = await spotsOf(first)
    const spots = Object.values(before) as [number, number][]
    expect(spots.every(([u, v]) => (u / 0.38) ** 2 + ((v - 0.05) / 0.5) ** 2 > 1 && u ** 2 + v ** 2 <= 1)).toBe(true)
    expect(new Set(spots.map(spot => spot.join())).size).toBe(4)
    const second = createPlaza({ storage })
    for (const [id, name] of [['dddd4', '몽글'], ['cccc3', '보들'], ['bbbb2', '콩떡'], ['aaaa1', '말랑']]) {
      await second.handle(post('/v1/poll', { me: me(id, name), since: 0 }))
    }
    expect(await spotsOf(second)).toEqual(before)
  })

  test('a pet comes back to the spot it was walked to, after leaving and after a server restart', async () => {
    let saved: string | null = null
    const storage = { read: () => saved, write: (text: string) => (saved = text) }
    let clock = 1_000
    const first = createPlaza({ now: () => clock, storage })
    await first.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    await first.handle(post('/v1/walk', { id: 'aaaa1', u: -0.5, v: 0.25 }))
    clock += 200_000
    await first.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 }))
    expect(first.members.has('aaaa1')).toBe(false)
    const second = createPlaza({ now: () => clock, storage })
    await second.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    const view = (await read(await second.handle(new Request('http://plaza.test/v1/plaza')))).body
    expect(view.pets.map((pet: { name: string; spot?: unknown }) => [pet.name, pet.spot])).toEqual([['말랑', [-0.5, 0.25]]])
  })
})

describe('rooms and visits', () => {
  const memoryStorage = () => {
    let text: string | null = null
    return { read: () => text, write: (next: string) => void (text = next) }
  }
  const host = { ...me('host1', '말랑'), room: { 'floor-1': 'cushion', rug: 'rug' } }

  test('a guest stays in a room until it leaves, even across a server restart', async () => {
    const storage = memoryStorage()
    const first = createPlaza({ storage })
    await first.handle(post('/v1/poll', { me: host, since: 0 }))
    expect((await read(await first.handle(post('/v1/visit', { me: me('guest1', '콩떡'), to: 'host1' })))).status).toBe(200)
    expect((await read(await first.handle(post('/v1/poll', { me: host, since: 0 })))).body.events.at(-1)).toMatchObject({ kind: 'visit', line: '콩떡이(가) 놀러 왔어' })
    const second = createPlaza({ storage })
    const guestHome = await read(await second.handle(post('/v1/poll', { me: me('guest1', '콩떡'), since: 0 })))
    expect(guestHome.body.away).toMatchObject({ host: 'host1', hostName: '말랑' })
    const hostHome = await read(await second.handle(post('/v1/poll', { me: host, since: 0 })))
    expect(hostHome.body.guests.map((guest: { name: string }) => guest.name)).toEqual(['콩떡'])
    const room = await read(await second.handle(new Request('http://plaza.test/v1/room?id=host1')))
    expect(room.body).toMatchObject({ layout: { 'floor-1': 'cushion', rug: 'rug' }, guests: [{ id: 'guest1' }] })
    await second.handle(post('/v1/visit/end', { me: me('guest1', '콩떡') }))
    expect((await read(await second.handle(post('/v1/poll', { me: me('guest1', '콩떡'), since: 0 })))).body.away).toBe(null)
  })

  test('a closed or full room turns a visit away', async () => {
    const plaza = createPlaza({ maxGuests: 1 })
    await plaza.handle(post('/v1/poll', { me: { ...host, isRoomOpen: false }, since: 0 }))
    expect((await plaza.handle(post('/v1/visit', { me: me('guest1', '콩떡'), to: 'host1' }))).status).toBe(403)
    await plaza.handle(post('/v1/poll', { me: host, since: 0 }))
    expect((await plaza.handle(post('/v1/visit', { me: me('guest1', '콩떡'), to: 'host1' }))).status).toBe(200)
    expect((await plaza.handle(post('/v1/visit', { me: me('guest2', '두부'), to: 'host1' }))).status).toBe(409)
    expect((await plaza.handle(post('/v1/visit', { me: me('guest2', '두부'), to: 'nobody' }))).status).toBe(403)
  })

  test('playing in the room reaches the other side and is remembered by the guest', async () => {
    const plaza = createPlaza()
    await plaza.handle(post('/v1/poll', { me: host, since: 0 }))
    await plaza.handle(post('/v1/visit', { me: me('guest1', '콩떡'), to: 'host1' }))
    await plaza.handle(post('/v1/room/act', { me: host, guest: 'guest1', kind: 'nap' }))
    const guest = await read(await plaza.handle(post('/v1/poll', { me: me('guest1', '콩떡'), since: 0 })))
    expect(guest.body.events.at(-1)).toMatchObject({ kind: 'room-act', act: 'nap', line: '같이 낮잠을 잤어', to: 'guest1' })
    expect(guest.body.away.notes).toEqual(['같이 낮잠을 잤어'])
    expect((await plaza.handle(post('/v1/room/act', { me: me('other1', '두부'), guest: 'guest1', kind: 'hug' }))).status).toBe(404)
    await plaza.handle(post('/v1/visit/end', { me: host, guest: 'guest1' }))
    const after = await read(await plaza.handle(post('/v1/poll', { me: me('guest1', '콩떡'), since: 0 })))
    expect(after.body.away).toBe(null)
    expect(after.body.events.at(-1)).toMatchObject({ kind: 'home', line: '말랑네 방에서 집으로 돌아왔어' })
  })

  test('stickers stay on the wall, three a day per friend, and gifts wait until they are taken', async () => {
    const storage = memoryStorage()
    const plaza = createPlaza({ storage })
    await plaza.handle(post('/v1/poll', { me: host, since: 0 }))
    for (const kind of ['heart', 'star', 'flower']) {
      expect((await plaza.handle(post('/v1/room/sticker', { me: me('guest1', '콩떡'), to: 'host1', kind }))).status).toBe(200)
    }
    expect((await plaza.handle(post('/v1/room/sticker', { me: me('guest1', '콩떡'), to: 'host1', kind: 'heart' }))).status).toBe(429)
    expect((await plaza.handle(post('/v1/gift', { me: me('guest1', '콩떡'), to: 'host1', item: 'cushion' }))).status).toBe(200)
    const again = createPlaza({ storage })
    const home = await read(await again.handle(post('/v1/poll', { me: host, since: 0 })))
    expect(home.body.stickers).toEqual(['heart', 'star', 'flower'])
    expect(home.body.gifts).toMatchObject([{ item: 'cushion', from: '콩떡' }])
    await again.handle(post('/v1/gift/take', { me: host, ids: [home.body.gifts[0].id] }))
    expect((await read(await again.handle(post('/v1/poll', { me: host, since: 0 })))).body.gifts).toEqual([])
  })

  test('what a pet is doing reaches friends but never the public page, and rude words are dropped', async () => {
    const plaza = createPlaza()
    await plaza.handle(post('/v1/poll', { me: { ...me('aaaa1', '말랑'), doing: '테스트 돌리고 있는 중...' }, since: 0 }))
    await plaza.handle(post('/v1/poll', { me: { ...me('bbbb2', '콩떡'), doing: '바보 같은 버그' }, since: 0 }))
    const friends = (await read(await plaza.handle(post('/v1/poll', { me: me('cccc3', '두부'), since: 0 })))).body.friends
    expect(friends.map((friend: { doing?: string }) => friend.doing ?? null).sort()).toEqual([null, '테스트 돌리고 있는 중...'])
    const view = await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))
    expect(view.body.pets.some((pet: { doing?: string }) => pet.doing !== undefined)).toBe(false)
  })

  const picture = { palette: ['ffffff'], rows: ['0'] }
  const tab = (tab: string, name: string, status: string) => ({ me: { ...me('pung1', name), status, tab, room: { rug: 'rug' }, roomPicture: picture }, since: 0 })

  test('the room list shows the same name as the pet on the plaza, whichever tab reported last', async () => {
    const plaza = createPlaza({ now: () => 1_000 })
    await plaza.handle(post('/v1/poll', tab('one', '풍풍이', 'working')))
    await plaza.handle(post('/v1/poll', tab('two', '녀우', 'away')))
    const view = await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))
    expect(view.body.pets.map((pet: { name: string }) => pet.name)).toEqual(['풍풍이'])
    expect(view.body.rooms.map((room: { name: string }) => room.name)).toEqual(['풍풍이'])
  })

  test('a room whose owner left the plaza stays open but is marked as out and listed last', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock })
    await plaza.handle(post('/v1/poll', { me: { ...me('gone1', '풍풍이'), room: { rug: 'rug' }, roomPicture: picture }, since: 0 }))
    clock += 120_000
    await plaza.handle(post('/v1/poll', { me: { ...me('here1', '녀우'), room: { rug: 'rug' }, roomPicture: picture }, since: 0 }))
    const view = await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))
    expect(view.body.rooms.map((room: { name: string; isOwnerOut: boolean }) => [room.name, room.isOwnerOut])).toEqual([
      ['녀우', false],
      ['풍풍이', true],
    ])
  })
})

describe('claude tuner weather', () => {
  const row = (fiveHour: number, extra: Record<string, unknown> = {}) => ({
    email: 'someone@dable.io',
    provider: 'claude',
    default_org: true,
    status: 'ok',
    windows: { five_hour: { utilization: fiveHour, seconds_to_reset: 600 } },
    ...extra,
  })

  test('only fresh Claude readings count, a window that already reset counts as zero, and nobody is named', () => {
    const rows = [
      row(100),
      row(70),
      row(60),
      row(20),
      row(0),
      row(100, { windows: { five_hour: { utilization: 100, seconds_to_reset: 0 } } }),
      row(90, { provider: 'chatgpt' }),
      row(80, { default_org: false }),
      row(50, { status: 'stale' }),
      'junk',
    ]
    const weather = weatherOf(rows, 5)
    expect(weather).toEqual({ level: 'festival', reporting: 6, atLimit: 1, over60: 3, average: 42, at: 5 })
    expect(JSON.stringify(weather)).not.toContain('dable.io')
    expect(weatherOf(rows.slice(0, 4), 5)).toBe(null)
  })

  test('the plaza gets busy on a high average or when a few people pass 60%, whichever comes first', () => {
    const idle = (count: number) => Array.from({ length: count }, () => row(1))
    expect(weatherOf([row(5), row(5), row(5), row(5), row(5)], 0)?.level).toBe('calm')
    expect(weatherOf([row(61), row(61), ...idle(8)], 0)?.level).toBe('busy')
    expect(weatherOf([row(12), row(12), row(12), row(12), row(12)], 0)?.level).toBe('busy')
    expect(weatherOf([row(60), row(60), row(60), row(60), row(60), ...idle(40)], 0)).toMatchObject({ level: 'festival', over60: 5, average: 8 })
  })

  test('the usage is read page by page with the org key, and a refused key reads as nothing', async () => {
    const auth: (string | null)[] = []
    const pages: Record<string, unknown> = {
      [TUNER_USAGE_URL]: { data: [row(10), row(20)], next_cursor: 'b@dable.io' },
      [`${TUNER_USAGE_URL}?cursor=b%40dable.io`]: { data: [row(30)], next_cursor: null },
    }
    const fetcher = (async (url: string, init?: RequestInit) => {
      auth.push(new Headers(init?.headers).get('authorization'))
      return new Response(JSON.stringify(pages[url]), { status: 200 })
    }) as unknown as typeof fetch
    expect((await readTunerUsage('ctk_test', fetcher))?.length).toBe(3)
    expect(auth).toEqual(['Bearer ctk_test', 'Bearer ctk_test'])
    const refused = (async () => new Response(JSON.stringify({ code: 'org_api_key_invalid' }), { status: 401 })) as unknown as typeof fetch
    expect(await readTunerUsage('ctk_bad', refused)).toBe(null)
  })

  test('a failed read keeps the last weather for fifteen minutes, then the sign goes away', () => {
    const last = weatherOf([row(50), row(50), row(50), row(50), row(50)], 0)
    expect(nextWeather(null, last, WEATHER_KEEP_MS - 1)).toBe(last)
    expect(nextWeather(null, last, WEATHER_KEEP_MS)).toBe(null)
    expect(nextWeather([], last, 1)).toBe(null)
  })

  test('the weather rides along on the page view, the poll, and the health check', async () => {
    const plaza = createPlaza({ keepAliveMs: 60_000 })
    await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))
    await plaza.settle()
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.weather).toBe(null)
    const page = await listen('/v1/plaza/stream', plaza)
    await page.next('view')
    const weather = { level: 'festival', reporting: 40, atLimit: 6, over60: 18, average: 52, at: 1 } as const
    plaza.setWeather(weather)
    await plaza.settle()
    expect((await page.next('view')).weather).toEqual(weather)
    expect((await read(await plaza.handle(post('/v1/poll', { me: me('bbbb2', '콩떡'), since: 0 })))).body.weather).toEqual(weather)
    expect((await read(await plaza.handle(new Request('http://plaza.test/health')))).body.weather).toBe('festival')
    await page.close()
  })

  test('the org key never shows up on the page, the poll, the stream, the health check, or the logs', async () => {
    const key = 'ctk_never-print-this-key'
    const logs: string[] = []
    const log = console.log
    console.log = (...parts: unknown[]) => {
      logs.push(parts.join(' '))
    }
    try {
      const plaza = createPlaza({ keepAliveMs: 60_000 })
      const page = await listen('/v1/plaza/stream', plaza)
      const friend = await listen('/v1/stream?id=bbbb2&tab=t1', plaza)
      const opened = [await page.next('view'), await friend.next('plaza')]
      const answer = (async () => new Response(JSON.stringify({ data: [row(70), row(70), row(70), row(70), row(70)], next_cursor: null }), { status: 200 })) as unknown as typeof fetch
      const refuse = (async () => new Response(JSON.stringify({ code: 'org_api_key_invalid', key }), { status: 401 })) as unknown as typeof fetch
      const stops = [watchWeather(key, plaza.setWeather, answer), watchWeather(key, plaza.setWeather, refuse)]
      await new Promise(resolve => setTimeout(resolve, 20))
      stops.forEach(stop => stop())
      await plaza.settle()
      const seen = [
        ...opened.map(message => JSON.stringify(message)),
        JSON.stringify(await page.next('view')),
        await (await plaza.handle(new Request('http://plaza.test/'))).text(),
        await (await plaza.handle(new Request('http://plaza.test/v1/plaza'))).text(),
        await (await plaza.handle(post('/v1/poll', { me: me('aaaa1', '말랑'), since: 0 }))).text(),
        await (await plaza.handle(new Request('http://plaza.test/health'))).text(),
        ...logs,
      ].join('\n')
      expect(logs).toContain('claude tuner usage: http 401')
      expect(seen).not.toContain(key)
      expect(seen).not.toContain('never-print')
      await page.close()
      await friend.close()
    } finally {
      console.log = log
    }
  })

  test('no real Claude Tuner key is ever written into the repository', () => {
    const roots = [import.meta.dir, join(import.meta.dir, '..', 'plugin')]
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap(name => {
        const path = join(dir, name)
        if (name === 'node_modules' || name === 'data' || name.startsWith('.')) {
          return []
        }
        return statSync(path).isDirectory() ? files(path) : [path]
      })
    const leaked = roots.flatMap(files).filter(path => /ctk_eyJ[\w-]+\.[\w-]+/.test(readFileSync(path, 'utf8')))
    expect(leaked).toEqual([])
  })
})

describe('channels', () => {
  const fill = async (plaza: ReturnType<typeof createPlaza>, count: number, from = 0) => {
    for (let index = from; index < from + count; index += 1) {
      await plaza.handle(post('/v1/poll', { me: me(`pet-${index}`, `펫${index}`), since: 0 }))
    }
  }

  const open = async (plaza: ReturnType<typeof createPlaza>, query: string) => {
    const server = Bun.serve({ port: 0, fetch: (request, bun) => (plaza.upgrade(request, bun) ? undefined : plaza.handle(request)), websocket: plaza.websocket })
    const socket = new WebSocket(`ws://localhost:${server.port}/v1/ws${query}`)
    const inbox: Record<string, any>[] = []
    socket.addEventListener('message', message => inbox.push(JSON.parse(String(message.data))))
    await new Promise(resolve => socket.addEventListener('open', resolve))
    const next = async (t: string): Promise<Record<string, any>> => {
      for (let tries = 0; tries < 100; tries += 1) {
        const found = inbox.findIndex(message => message.t === t)
        if (found >= 0) {
          return inbox.splice(found, 1)[0] ?? {}
        }
        await Bun.sleep(10)
      }
      throw new Error(`no ${t} message`)
    }
    return { socket, next, inbox, close: () => (socket.close(), server.stop(true)) }
  }

  test('the lowest channel with room is picked, and a new one opens only when every channel is full', () => {
    expect(pickChannel(new Map(), 20)).toBe(1)
    expect(pickChannel(new Map([[1, 19]]), 20)).toBe(1)
    expect(pickChannel(new Map([[1, 20]]), 20)).toBe(2)
    expect(pickChannel(new Map([[1, 20], [3, 4]]), 20)).toBe(2)
    expect(pickChannel(new Map([[1, 20], [2, 20]]), 20)).toBe(3)
  })

  test('the twenty-first pet opens channel 2, and friends and waves to everyone stay inside a channel', async () => {
    const plaza = createPlaza()
    await fill(plaza, 21)
    const first = (await read(await plaza.handle(post('/v1/poll', { me: me('pet-0', '펫0'), since: 0 })))).body
    const late = (await read(await plaza.handle(post('/v1/poll', { me: me('pet-20', '펫20'), since: 0 })))).body
    expect([first.channel, late.channel]).toEqual([1, 2])
    expect(late.channels).toEqual([{ channel: 1, count: 20 }, { channel: 2, count: 1 }])
    expect(late.channelSize).toBe(20)
    expect(first.friends.length).toBe(19)
    expect(late.friends).toEqual([])
    await plaza.handle(post('/v1/act', { me: me('pet-1', '펫1'), kind: 'cheer', to: null }))
    await plaza.settle()
    const after = async (id: string) => (await read(await plaza.handle(post('/v1/poll', { me: me(id, id), since: 0 })))).body.events.map((event: { kind: string }) => event.kind)
    expect(await after('pet-0')).toContain('cheer')
    expect(await after('pet-20')).not.toContain('cheer')
    expect((await read(await plaza.handle(post('/v1/act', { me: me('pet-1', '펫1'), kind: 'wave', to: 'pet-20' })))).body.error).toBe('that friend is not in your channel')
  })

  test('channel 1 is always listed, a pet can move to a channel with room or the next new one, but not into a full one', async () => {
    const plaza = createPlaza()
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.channels).toEqual([{ channel: 1, count: 0 }])
    await fill(plaza, 21)
    const move = async (id: string, channel: unknown) => read(await plaza.handle(post('/v1/channel', { me: me(id, id), channel })))
    expect((await move('pet-20', 1)).status).toBe(409)
    expect((await move('pet-20', 4)).status).toBe(400)
    expect((await move('pet-20', 1.5)).status).toBe(400)
    expect((await move('pet-0', 2)).body).toEqual({ ok: true, channel: 2, channels: [{ channel: 1, count: 19 }, { channel: 2, count: 2 }], channelSize: 20 })
    expect((await move('pet-0', 3)).body.channels).toEqual([{ channel: 1, count: 19 }, { channel: 2, count: 1 }, { channel: 3, count: 1 }])
    const page = (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza?channel=3')))).body
    expect([page.channel, page.pets.length]).toEqual([3, 1])
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza?channel=oops')))).body.channel).toBe(1)
  })

  test('over a websocket a walk and a line reach the same channel at once, and nobody in another channel', async () => {
    const plaza = createPlaza({ flushMs: 60_000 })
    await fill(plaza, 21)
    const mine = await open(plaza, '?id=pet-0')
    const near = await open(plaza, '?channel=1')
    const far = await open(plaza, '?channel=2')
    expect((await mine.next('view')).view.channel).toBe(1)
    expect((await far.next('view')).view.pets.length).toBe(1)
    mine.socket.send(JSON.stringify({ t: 'walk', u: 0.5, v: 0.5 }))
    mine.socket.send(JSON.stringify({ t: 'say', text: '안녕' }))
    expect((await near.next('walk')).spot).toEqual([0.5, 0.5])
    expect((await near.next('say')).chat.text).toBe('안녕')
    mine.socket.send(JSON.stringify({ t: 'say', text: '바보야' }))
    expect(await mine.next('error')).toEqual({ t: 'error', of: 'say', status: 400 })
    await Bun.sleep(50)
    expect(far.inbox.filter(message => message.t !== 'view')).toEqual([])
    mine.close()
    near.close()
    far.close()
  })

  test('a pet that leaves gives its seat back, an emptied extra channel drops out, and a ping is enough to notice', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock, friendTtlMs: 60_000, flushMs: 60_000 })
    await fill(plaza, 21)
    const viewer = await open(plaza, '?channel=2')
    expect((await viewer.next('view')).view.pets.length).toBe(1)
    clock += 30_000
    await fill(plaza, 20)
    clock += 40_000
    viewer.socket.send(JSON.stringify({ t: 'ping' }))
    await viewer.next('pong')
    expect(plaza.members.size).toBe(20)
    const page = (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body
    expect(page.channels).toEqual([{ channel: 1, count: 20 }])
    await plaza.handle(post('/v1/poll', { me: me('pet-0', '펫0'), since: 0 }))
    clock += 61_000
    await fill(plaza, 19, 1)
    const late = (await read(await plaza.handle(post('/v1/poll', { me: me('newcomer', '새내기'), since: 0 })))).body
    expect(late.channel).toBe(1)
    viewer.close()
  })

  test('a pet steered from a page moves channel over its socket, but not into a full one', async () => {
    const plaza = createPlaza({ flushMs: 60_000 })
    await fill(plaza, 21)
    const mine = await open(plaza, '?id=pet-20')
    expect((await mine.next('view')).view.channel).toBe(2)
    mine.socket.send(JSON.stringify({ t: 'move', channel: 1 }))
    expect(await mine.next('error')).toEqual({ t: 'error', of: 'move', status: 409 })
    expect((await mine.next('view')).view.channel).toBe(2)
    mine.socket.send(JSON.stringify({ t: 'move', channel: 3 }))
    expect((await mine.next('view')).view).toMatchObject({ channel: 3, pets: [expect.any(Object)] })
    mine.close()
  })

  test('the plugin stream carries my channel and only the friends in it', async () => {
    const plaza = createPlaza({ keepAliveMs: 60_000 })
    await fill(plaza, 22)
    const late = await listen('/v1/stream?id=pet-21&tab=t1', plaza)
    const first = await late.next('plaza')
    expect([first.channel, first.channelSize]).toEqual([2, 20])
    expect(first.friends.map((friend: { id: string }) => friend.id)).toEqual(['pet-20'])
    await late.close()
  })

  test('walks closer together than a tenth of a second wait, and only the newest of them lands', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock })
    await fill(plaza, 1)
    const spot = async () => (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza')))).body.pets[0].spot
    expect((await plaza.handle(post('/v1/walk', { id: 'pet-0', u: 0.1, v: 0.1 }))).status).toBe(202)
    clock += 50
    expect((await read(await plaza.handle(post('/v1/walk', { id: 'pet-0', u: 0.2, v: 0.1 })))).body).toEqual({ ok: true, queued: true })
    clock += 10
    await plaza.handle(post('/v1/walk', { id: 'pet-0', u: 0.3, v: 0.1 }))
    expect(await spot()).toEqual([0.1, 0.1])
    await Bun.sleep(120)
    expect(await spot()).toEqual([0.3, 0.1])
  })

  test('a refused action is not counted, so the limit lifts a minute after the last accepted one', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock, friendTtlMs: 600_000 })
    await fill(plaza, 2)
    const cheer = async () => (await plaza.handle(post('/v1/act', { me: me('pet-0', '펫0'), kind: 'cheer', to: null }))).status
    for (let index = 0; index < 12; index += 1) {
      expect(await cheer()).toBe(202)
    }
    for (let index = 0; index < 15; index += 1) {
      clock += 3_000
      expect(await cheer()).toBe(429)
    }
    clock += 15_001
    expect(await cheer()).toBe(202)
    await plaza.settle()
  })

  test('a pet can move only so often, and never past channel 999', async () => {
    const plaza = createPlaza({ channelSize: 1, flushMs: 60_000 })
    await fill(plaza, 2)
    const move = async (id: string, channel: number) => (await plaza.handle(post('/v1/channel', { me: me(id, id), channel }))).status
    const hops = []
    for (let index = 0; index < 13; index += 1) {
      hops.push(await move('pet-1', index % 2 === 0 ? 3 : 2))
    }
    expect(hops.slice(0, 12).every(status => status === 200)).toBe(true)
    expect(hops[12]).toBe(429)
    const crowd = createPlaza({ channelSize: 1, flushMs: 60_000 })
    await fill(crowd, 999)
    expect((await read(await crowd.handle(new Request('http://plaza.test/v1/plaza?channel=999')))).body.pets.length).toBe(1)
    expect((await crowd.handle(post('/v1/channel', { me: me('pet-0', 'pet-0'), channel: 1000 }))).status).toBe(400)
  })

  test('a pet that left no longer fills a channel, so moving there works without waiting for another request', async () => {
    let clock = 1_000
    const plaza = createPlaza({ now: () => clock, friendTtlMs: 60_000, flushMs: 60_000 })
    await fill(plaza, 21)
    clock += 30_000
    await fill(plaza, 19, 1)
    await plaza.handle(post('/v1/poll', { me: me('pet-20', '펫20'), since: 0 }))
    clock += 40_000
    expect((await read(await plaza.handle(post('/v1/channel', { me: me('pet-20', '펫20'), channel: 1 })))).body.channel).toBe(1)
  })

  test('in one flush a stream page and a socket page in the same channel each get their own format', async () => {
    const plaza = createPlaza({ keepAliveMs: 60_000, flushMs: 20 })
    await fill(plaza, 1)
    const page = await listen('/v1/plaza/stream', plaza)
    const socket = await open(plaza, '')
    await page.next('view')
    await socket.next('view')
    await fill(plaza, 1, 1)
    expect((await page.next('view')).pets.length).toBe(2)
    expect((await socket.next('view')).view.pets.length).toBe(2)
    await page.close()
    socket.close()
  })

  test('a wave to everyone stays in the channel it was sent from, even if the sender moves before the line is written', async () => {
    let release = (_: string) => {}
    const plaza = createPlaza({ generate: () => new Promise(resolve => (release = resolve)) })
    await fill(plaza, 3)
    await plaza.handle(post('/v1/act', { me: me('pet-0', '펫0'), kind: 'cheer', to: null }))
    await plaza.handle(post('/v1/channel', { me: me('pet-0', '펫0'), channel: 2 }))
    release('힘내!')
    await plaza.settle()
    const kinds = async (id: string) => (await read(await plaza.handle(post('/v1/poll', { me: me(id, id), since: 0 })))).body.events.map((event: { kind: string }) => event.kind)
    expect(await kinds('pet-1')).toContain('cheer')
    expect((await read(await plaza.handle(new Request('http://plaza.test/v1/plaza?channel=2')))).body.events).toEqual([])
  })

  test('a page can wave at a nearby pet by its public key, but not at itself, at an odd kind, or across channels', async () => {
    const plaza = createPlaza({ flushMs: 60_000 })
    await fill(plaza, 21)
    const mine = await open(plaza, '?id=pet-0')
    const view = (await mine.next('view')).view
    const keyOf = (name: string) => view.pets.find((pet: { name: string }) => pet.name === name).key
    mine.socket.send(JSON.stringify({ t: 'act', kind: 'wave', to: keyOf('펫1') }))
    await Bun.sleep(30)
    await plaza.settle()
    const events = (await read(await plaza.handle(post('/v1/poll', { me: me('pet-1', '펫1'), since: 0 })))).body.events
    expect(events.map((event: { kind: string; from: { id: string } }) => [event.kind, event.from.id])).toContainEqual(['wave', 'pet-0'])
    mine.socket.send(JSON.stringify({ t: 'act', kind: 'wave', to: keyOf('펫0') }))
    expect(await mine.next('error')).toEqual({ t: 'error', of: 'act', status: 404 })
    mine.socket.send(JSON.stringify({ t: 'act', kind: 'punch', to: keyOf('펫1') }))
    expect(await mine.next('error')).toEqual({ t: 'error', of: 'act', status: 400 })
    const far = (await read(await plaza.handle(new Request('http://plaza.test/v1/plaza?channel=2')))).body.pets[0].key
    mine.socket.send(JSON.stringify({ t: 'act', kind: 'heart', to: far }))
    expect(await mine.next('error')).toEqual({ t: 'error', of: 'act', status: 404 })
    const viewer = await open(plaza, '')
    viewer.socket.send(JSON.stringify({ t: 'act', kind: 'wave', to: keyOf('펫1') }))
    expect(await viewer.next('error')).toEqual({ t: 'error', of: 'act', status: 404 })
    mine.close()
    viewer.close()
  })

  test('a page without a pet only watches: it can switch channels and ping, but not walk or talk', async () => {
    const plaza = createPlaza({ flushMs: 60_000 })
    await fill(plaza, 21)
    const viewer = await open(plaza, '')
    expect((await viewer.next('view')).view.pets.length).toBe(20)
    viewer.socket.send(JSON.stringify({ t: 'move', channel: 2 }))
    expect((await viewer.next('view')).view).toMatchObject({ channel: 2, pets: [expect.any(Object)] })
    viewer.socket.send(JSON.stringify({ t: 'move', channel: 9 }))
    expect(await viewer.next('error')).toEqual({ t: 'error', of: 'move', status: 400 })
    viewer.socket.send(JSON.stringify({ t: 'walk', u: 0, v: 0 }))
    expect(await viewer.next('error')).toEqual({ t: 'error', of: 'walk', status: 404 })
    viewer.socket.send(JSON.stringify({ t: 'ping' }))
    expect(await viewer.next('pong')).toEqual({ t: 'pong' })
    viewer.close()
  })
})
