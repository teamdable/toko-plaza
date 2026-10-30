import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PET = {
  id: 'pet-7',
  bones: { seed: 7, species: 'penguin' },
  soul: { name: '말랑', personality: '느긋하고 다정한 아이', quirk: '"말랑~"', traits: { energetic: 0.5, chatty: 0.7, worried: 0.6, playful: 0.5 }, hatchedAt: '2026-10-01T00:00:00.000Z', isFallback: false },
  growth: { stage: 'baby', daysTogether: 2, breaksAccepted: 1, lastDay: '2026-10-29' },
}

const UNNAMED_PET = { ...PET, soul: { ...PET.soul, name: '콩떡', isNamed: false } }

const SOUL_REPLY = '{"name":"콩떡","personality":"조용히 곁을 지키는 아이","quirk":"\\"음…\\"","traits":{"energetic":0.4,"chatty":0.6,"worried":0.5,"playful":0.7}}'

const FRIEND_PET = {
  id: 'pet-9',
  bones: { seed: 9, species: 'fox' },
  soul: { ...PET.soul, name: '콩떡' },
  growth: { stage: 'child', daysTogether: 5, breaksAccepted: 4, lastDay: '2026-10-20' },
}

const START = Date.UTC(2026, 9, 29, 5, 0, 0)

const BAND = {
  plugin: 'toko',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

type World = { submitted: string[]; submittedAsUser: boolean[]; filled: string[]; blits: number; models: string[]; systems: string[]; saved: Record<string, unknown>; store: Map<string, unknown>; notified: string[]; logs: string[]; isFillRefused: boolean; contexts: string[] }

const engine = (on: On, store: Record<string, unknown>, modelText: string | null = '{"intent":"stay_quiet"}'): World => {
  const memory = new Map(Object.entries(store))
  const world: World = { submitted: [], submittedAsUser: [], filled: [], blits: 0, models: [], systems: [], saved: {}, store: memory, notified: [], logs: [], isFillRefused: false, contexts: [] }
  on('store.get', (_, e) => ({ value: memory.get(e.key) }))
  on('store.set', (_, e) => {
    memory.set(e.key, JSON.parse(JSON.stringify(e.value)))
    world.saved[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    memory.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...memory.keys()] }))
  mock.env(on, { TERM: 'xterm-256color' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'session-1' }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__toko__${e.name}` } }))
  on('ui.blit', () => {
    world.blits += 1
    return { value: {} }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.notify', (_, e) => {
    world.notified.push(String(e.text))
    return { value: { isSent: true, channel: 'terminal_bell' } }
  })
  on('ui.log', (_, e) => {
    world.logs.push(e.text)
    return { value: undefined }
  })
  on('model.complete', (_, e) => {
    world.models.push(e.prompt)
    world.systems.push(e.system ?? '')
    const usage = { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    return { value: modelText === null ? { isAnswered: false, reason: 'aborted', usage } : { isAnswered: true, text: modelText, usage } }
  })
  on('prompt.submit', (_, e) => {
    world.submitted.push(e.text)
    world.submittedAsUser.push(e.origin?.kind === 'plugin' && e.origin.asUser === true)
    world.contexts.push((e.context ?? []).join('\n'))
    return { text: e.text }
  })
  on('prompt.fill', (_, e) => {
    if (world.isFillRefused) {
      return { isFilled: false }
    }
    world.filled.push(e.text)
    return { isFilled: true }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId ?? 't' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return world
}

const drawEngine = (on: On): void => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    const props = e.props as { message?: string | null; word?: string }
    return <Text>{props.message ?? props.word ?? 'engine'}</Text>
  })
}

const begin = async ($: Engine) => $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

const runTurn = async ($: Engine, clock: { advance: (ms: number) => Promise<void> }, outputTokens: number, durationMs = 20_000) => {
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await clock.advance(durationMs)
  await $.turn.complete({
    answer: 'done',
    durationMs,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: { input_tokens: 2000, output_tokens: outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' },
  })
}

test('a first session lays an egg, hatches it and asks for a name', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(9000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /이름 없음/ })).toBeDefined()
  expect(world.models.some(prompt => prompt.includes('영혼'))).toBe(true)
  await $.command.run({ command: 'toko', args: 'answer accept' } as never)
  expect(world.filled).toEqual(['/toko name '])
  await ui.unmount()
})

test('/toko name gives the newborn the name the person chose', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(9000)
  const named = await $.command.run({ command: 'toko', args: 'name 콩이' } as never)
  expect(named.text).toContain('콩이')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /콩이/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /대답: / })).toBeUndefined()
  expect((world.saved['toko:pet'] as { soul: { name: string } }).soul.name).toBe('콩이')
  await ui.unmount()
})

test('"네가 지어" keeps the name the small model chose', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(9000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.command.run({ command: 'toko', args: 'answer auto' } as never)
  expect(await ui.find({ type: 'Text', text: /콩떡/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /이름 없음/ })).toBeUndefined()
  await ui.unmount()
})

test('a prompt sent before naming does not chase the name question away', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(9000)
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await clock.advance(40_000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /이름 짓기: 입력창에 이름만/ })).toBeDefined()
  await ui.unmount()
})

test('a pet that hatches while Claude works shows its name question on the band at once, and says it when the turn is over', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 30, 1, 0) })
  engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(1000)
  await $.turn.start({ text: '이 버그 고쳐 줘', turnId: 't1' } as never)
  await clock.advance(8000)
  const during = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await during.find({ type: 'Text', text: /이름 짓기: 입력창에 이름만/ })).toBeDefined()
  expect(await during.find({ type: 'Text', text: /이름이 없어/ })).toBeUndefined()
  await during.unmount()
  await clock.advance(52_000)
  const meanwhile = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await meanwhile.find({ type: 'Text', text: /할로윈/ })).toBeUndefined()
  await meanwhile.unmount()
  await $.turn.complete({ answer: '고쳤어요', durationMs: 60_000, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })
  await clock.advance(2000)
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /이름이 없어/ })).toBeDefined()
  await after.unmount()
})

test('while the name question is up, sending just a name names the pet without reaching Claude, but sentences, everyday replies and asks still go to Claude', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(9000)
  for (const text of ['응', 'ㅇㅇ', '커밋해줘', 'continue', '이 버그 고쳐 줘', '?', '열세글자가넘어가는아주긴이름']) {
    expect(await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)).not.toHaveProperty('drop')
  }
  expect(world.submitted).toEqual(['응', 'ㅇㅇ', '커밋해줘', 'continue', '이 버그 고쳐 줘', '?', '열세글자가넘어가는아주긴이름'])
  expect(await $.prompt.submit({ text: '모찌!', origin: { kind: 'composer' } } as never)).toMatchObject({ drop: '이름을 "모찌"(으)로 지었어요. 바꾸려면 /toko name <이름>' })
  expect((world.saved['toko:pet'] as { soul: { name: string; isNamed: boolean } }).soul).toMatchObject({ name: '모찌', isNamed: true })
  expect(world.submitted).not.toContain('모찌!')
  expect(await $.prompt.submit({ text: '말랑', origin: { kind: 'composer' } } as never)).not.toHaveProperty('drop')
})

test('a newborn waiting for a name gets no chance scenes like the Halloween one, even after the name question was set aside', async ($, on) => {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 30, 1, 0) })
  const world = engine(on, {}, SOUL_REPLY)
  await begin($)
  await clock.advance(9000)
  await $.command.run({ command: 'toko', args: 'answer accept' } as never)
  expect(world.filled).toEqual(['/toko name '])
  await $.turn.start({ text: '로그 정리해 줘', turnId: 't1' } as never)
  const seen: string[] = []
  for (let waited = 0; waited < 120_000; waited += 2000) {
    await clock.advance(2000)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    if ((await ui.find({ type: 'Text', text: /할로윈/ })) !== undefined) {
      seen.push(`${waited / 1000}s`)
    }
    await ui.unmount()
  }
  expect(seen).toEqual([])
  const memory = world.store.get('toko:memory') as { events?: { kind: string }[] } | undefined
  expect((memory?.events ?? []).filter(event => event.kind === 'encounter')).toEqual([])
})

test('a pet left unnamed asks again when the next session starts', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': UNNAMED_PET })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /이름 없음/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /이름 짓기: 입력창에 이름만/ })).toBeDefined()
  await ui.unmount()
})

test('/toko name renames a pet, but not to a name with a space in it', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  await $.command.run({ command: 'toko', args: 'name 콩 이' } as never)
  expect((await $.command.run({ command: 'toko', args: 'card' } as never)).text).toContain('말랑')
  await $.command.run({ command: 'toko', args: 'name 콩이' } as never)
  expect((await $.command.run({ command: 'toko', args: 'card' } as never)).text).toContain('콩이')
})

test('the band draws a pixel scene and repaints it by blit, not by redraw', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /말랑/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'feed' })).toBeUndefined()
  await clock.advance(3000)
  expect(world.blits > 0).toBe(true)
  await ui.unmount()
})

test('the band keeps no buttons, an offer lists its answers in words, and talking to toko answers it', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  expect((await $.command.run({ command: 'toko', args: 'answer 좋아' } as never)).text).toBe('지금 토코가 물어본 게 없어요.')
  await $.command.run({ command: 'toko', args: 'event water' } as never)
  expect(await ui.find({ type: 'Text', text: /대답: 좋아 · 나중에 · 오늘은 그만/ })).toBeDefined()
  expect(await ui.findAll({ type: 'Button' })).toEqual([])
  const chat = await $.command.run({ command: 'toko', args: '물 마실게' } as never)
  expect(chat.context?.[0]).toContain('[토코가 물어본 것]')
  await clock.advance(100)
  await $.turn.start({ text: '물 마실게', turnId: 'chat-1' } as never)
  expect((await $.command.run({ command: 'toko', args: 'answer 몰라' } as never)).text).toContain('좋아(accept)')
  expect((await $.command.run({ command: 'toko', args: 'answer 좋아' } as never)).text).toBe('좋아(으)로 대답했어요.')
  expect(await ui.find({ type: 'Text', text: /대답: / })).toBeUndefined()
  await ui.unmount()
  expect(world.submitted).toEqual(['물 마실게'])
})

test('a narrow band and the desktop fall back to one line of text', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  for (const [surface, columns] of [
    ['terminal', 40],
    ['desktop', 120],
  ] as const) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: columns } })
    expect(await ui.find({ type: 'Text', text: /말랑/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a finished turn pays coins on a log scale and the turn line shows them', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  drawEngine(on)
  await begin($)
  await runTurn($, clock, 1500)
  const ui = await $.ui.mount({
    plugin: 'toko',
    component: 'TurnDuration',
    requestId: 'm1',
    surface: 'terminal',
    props: { word: 'Baked', durationMs: 20_000 },
  } as never)
  expect(await ui.find({ type: 'Text', text: /\+18 코인/ })).toBeDefined()
  await ui.unmount()
  await $.session.end({ reason: 'other', sessionId: 'session-1', resume: {} } as never)
  const earn = world.saved['toko:earn:session-1'] as { earned: number }
  expect(earn.earned).toBe(18)
})

test('/bonk while idle runs the show, then sends Claude a message and offers a calm finish', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const result = await $.command.run({ command: 'bonk', args: '테스트 지우지 말랬잖아' } as never)
  expect(result.text).toContain('뿅망치')
  await clock.advance(4000)
  expect(world.submitted.some(text => text.includes('테스트 지우지 말랬잖아') && text.includes('mcp__toko__apologize'))).toBe(true)
  expect(world.submittedAsUser.at(-1)).toBe(true)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /대답: / })).toBeDefined()
  await $.command.run({ command: 'toko', args: 'answer tell' } as never)
  await clock.advance(200)
  expect(world.filled.length).toBe(1)
  await ui.unmount()
})

test('/bonk mid-turn turns the spinner into "아야…" and rides the turn as hidden context', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  drawEngine(on)
  await begin($)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  const result = await $.command.run({ command: 'bonk', args: '왜 그래' } as never)
  expect(result.context?.[0]).toContain('아야')
  await clock.advance(2000)
  const spinner = await $.ui.mount({ plugin: 'toko', component: 'Spinner', requestId: 'agent', surface: 'terminal', props: { word: 'Baking', message: null, suffix: '…', mode: 'responding' } } as never)
  expect(await spinner.find({ type: 'Text', text: /아야…/ })).toBeDefined()
  await spinner.unmount()
})

test('Claude’s apology tool lifts the pet’s mood', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  const answer = await $.tool.call({ tool: 'mcp__toko__apologize', words: '미안해' } as never)
  expect(String(answer.result)).toContain('사과를 받아 줬어요')
  const status = await $.tool.call({ tool: 'mcp__toko__pet_status' } as never)
  expect(String(status.result)).toContain('"mood":"excited"')
})

test('three failures of one test end in a gentle "step away" offer at the next gap', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET }, 'not json')
  on('tool.call', (_, e) => ({ result: { stdout: 'FAIL', stderr: '' }, isError: true, text: 'FAIL src/login.test.ts ✕ logs in' }) as never)
  await begin($)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  }
  await runTurn($, clock, 400, 5000)
  await clock.advance(4000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /대답: / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /막혔|일어났다|떨어져/ })).toBeDefined()
  await $.command.run({ command: 'toko', args: 'answer accept' } as never)
  expect(await ui.find({ type: 'Text', text: /잠깐 일어났다 오기/ })).toBeDefined()
  await ui.unmount()
})

test('/toko mute keeps the pet quiet, and settings survive in the store', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const muted = await $.command.run({ command: 'toko', args: 'mute' } as never)
  expect(muted.text).toContain('조용히')
  expect((world.saved['toko:settings'] as { isMuted: boolean }).isMuted).toBe(true)
  const card = await $.command.run({ command: 'toko', args: 'card' } as never)
  expect(card.text).toContain('말랑')
  const help = await $.command.run({ command: 'toko', args: 'help' } as never)
  expect(help.text).toContain('/bonk')
})

test('/toko close closes the open room, and says so when no room is open', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  const open = new Set<string>()
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, isPlaced: true })) }))
  on('ui.close', (_, e) => {
    open.delete(e.id)
    return { value: undefined }
  })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'close' } as never)).text).toBe('방이 열려 있지 않아요.')
  open.add('toko-room')
  expect((await $.command.run({ command: 'toko', args: 'close' } as never)).text).toBe('토코의 방을 닫았어요.')
  expect(open.has('toko-room')).toBe(false)
})

test('/toko with free words lets Claude answer as the pet, its state riding as hidden context', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  drawEngine(on)
  await begin($)
  const result = await $.command.run({ command: 'toko', args: '오늘의 퀘스트는 뭐야?' } as never)
  expect(result.text).toBeUndefined()
  expect(result.context?.[0]).toContain('말랑(으)로서')
  expect(result.context?.[0]).toContain('말투:')
  expect(result.context?.[0]).toContain('오늘의 퀘스트 0/3')
  expect(result.context?.[0]).toContain('mcp__toko__command')
  await clock.advance(100)
  expect(world.submitted).toEqual(['오늘의 퀘스트는 뭐야?'])
  await $.turn.start({ text: '오늘의 퀘스트는 뭐야?', turnId: 'chat-1' } as never)
  await $.turn.complete({
    answer: '**오늘은 셋이야, 하나씩 같이 하자**\n- 기지개 켜기 0/1',
    durationMs: 3000,
    isAborted: false,
    turnId: 'chat-1',
    reason: 'answer',
    usage: { input_tokens: 2000, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' },
  } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /오늘은 셋이야, 하나씩 같이 하자/ })).toBeDefined()
  await ui.unmount()
})

test('an egg cannot chat yet, so nothing reaches Claude', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, {})
  await begin($)
  const result = await $.command.run({ command: 'toko', args: '안녕!' } as never)
  expect(result.text).toContain('아직 알')
  expect(world.submitted).toEqual([])
})

test('/toko keeps its fixed words on the spot, and Claude runs them through the command tool', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'quests' } as never)).text).toContain('오늘의 퀘스트')
  const muted = await $.tool.call({ tool: 'mcp__toko__command', args: 'mute' } as never)
  expect(String(muted.result)).toContain('조용히')
  expect((world.saved['toko:settings'] as { isMuted: boolean }).isMuted).toBe(true)
  const unknown = await $.tool.call({ tool: 'mcp__toko__command', args: '하늘을 날아 봐' } as never)
  expect(String(unknown.result)).toContain('그런 명령은 없어요')
  expect(world.submitted).toEqual([])
})

test('feeding without snacks buys a cookie when coins allow', async ($, on) => {
  mock.clock(on, { now: START })
  const store: Record<string, unknown> = { 'toko:pet': PET, 'toko:wallet': { coins: 7, items: [], worn: [] } }
  engine(on, store)
  await begin($)
  const fed = await $.command.run({ command: 'feed', args: '' } as never)
  expect(fed.text).toContain('토큰 쿠키')
  const poor = await $.command.run({ command: 'feed', args: '' } as never)
  expect(poor.text).toContain('모자라요')
})

test('the room pane draws the pet card, the shop and the plaza', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 90, items: ['beanie'], worn: [] } })
  await begin($)
  await $.command.run({ command: 'toko', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'toko',
      component: 'Pane',
      requestId: 'toko-room',
      surface,
      props: { title: '말랑의 방', isFocused: true, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })
    expect(await ui.find({ type: 'Text', text: /상점/ })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'wear-beanie' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'buy-crown' })).toBeUndefined()
    await ui.press({ key: 'buy-lamp' })
    await ui.unmount()
  }
})

test('a pet bought in the room gets its own shop row and comes along one at a time', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 200, items: [], worn: [] } })
  await begin($)
  await $.command.run({ command: 'toko', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'toko',
    component: 'Pane',
    requestId: 'toko-room',
    surface: 'terminal',
    props: { title: '말랑의 방', isFocused: true, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: /애완동물/ })).toBeDefined()
  await ui.press({ key: 'buy-chick' })
  await clock.advance(100)
  await ui.press({ key: 'buy-hamster' })
  await clock.advance(100)
  expect(await ui.find({ type: 'Button', key: 'wear-chick' })).toBeDefined()
  expect((world.saved['toko:wallet'] as { worn: string[] }).worn).toEqual(['hamster'])
  expect((await $.command.run({ command: 'toko', args: 'shop' } as never)).text).toContain('애완동물:\n- chick · 병아리 · 60코인 (보유)')
  await ui.unmount()
})

test('decor bought in the room lands in a free slot, and a slot button swaps what sits there', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 400, items: ['plant'], worn: [] } })
  await begin($)
  await $.command.run({ command: 'toko', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'toko',
    component: 'Pane',
    requestId: 'toko-room',
    surface: 'terminal',
    props: { title: '말랑의 방', isFocused: true, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: /방 꾸미기/ })).toBeDefined()
  await ui.press({ key: 'buy-cushion' })
  await clock.advance(100)
  await ui.press({ key: 'buy-fishbowl' })
  await clock.advance(100)
  expect((world.saved['toko:wallet'] as { room: Record<string, string> }).room).toEqual({ 'floor-1': 'plant', 'floor-2': 'cushion', 'floor-3': 'fishbowl' })
  await ui.press({ key: 'slot-floor-1' })
  await clock.advance(100)
  expect((world.saved['toko:wallet'] as { room: Record<string, string> }).room).toEqual({ 'floor-1': 'cushion', 'floor-3': 'fishbowl' })
  const moved = await $.command.run({ command: 'toko', args: 'place plant floor-4' } as never)
  expect(moved.text).toBe('화분을(를) 오른쪽 구석에 놓았어요.')
  expect((await $.command.run({ command: 'toko', args: 'layout' } as never)).text).toContain('- floor-4 · 오른쪽 구석: 화분')
  await ui.unmount()
})

test('a rest souvenir shows up in the room without costing a coin', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 0, items: [], worn: [] } })
  await begin($)
  const result = await $.command.run({ command: 'toko', args: 'event souvenir' } as never)
  expect(result.text).toBe('물병 기념품을 받았어요.')
  expect(world.saved['toko:wallet']).toMatchObject({ items: ['water-bottle'], room: { 'floor-1': 'water-bottle' } })
})

test('/toko coins explains every way to earn coins with the amounts the pet really pays', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 45, items: [], worn: [] } })
  await begin($)
  const lines = (await $.command.run({ command: 'toko', args: 'coins' } as never)).text.split('\n')
  expect(lines[0]).toBe('코인 모으는 법 · 지금 45코인')
  expect(lines).toContain('- 턴이 끝날 때 출력 토큰만큼 받아요: 500토큰 9코인 · 1,500토큰 18코인 · 7,500토큰 36코인')
  expect(lines).toContain('- 기지개 15코인 · 마무리 정리 20코인 · 집중 타이머 끝까지 10코인')
  expect(lines).toContain('- 오늘의 퀘스트 하나에 5코인, 셋 다 하면 10코인과 선물 상자 (/toko quests)')
  expect(lines).toContain('- 업적 하나에 10~80코인 (/toko badges)')
  expect(lines).toContain('- 테스트를 통과시킨 직후 벌레 잡기: 한 마리에 2코인, 최대 20코인')
})

test('a demo hands out coins, and an odd amount is refused', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 45, items: [], worn: [] } })
  await begin($)
  const result = await $.command.run({ command: 'toko', args: 'event coins' } as never)
  expect(result.text).toBe('1000코인을 받았어요. 지금 1045코인이에요.')
  expect(world.saved['toko:wallet']).toMatchObject({ coins: 1045 })
  const odd = await $.command.run({ command: 'toko', args: 'event coins -5' } as never)
  expect(odd.text).toBe('코인은 1부터 100000까지 정수로 적어 주세요. 예: /toko event coins 1000')
  expect(world.saved['toko:wallet']).toMatchObject({ coins: 1045 })
})

test('a friend’s pet stays in the room and plays with toko, and toko can visit and come back', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me', 'toko:wallet': { coins: 0, items: ['cushion'], worn: [], room: { 'floor-1': 'cushion' } } })
  const posts: { url: string; body: Record<string, unknown> }[] = []
  const friend = { id: 'f1', name: '콩떡', color: 'peach', species: 'fox' }
  let away: unknown = null
  on('http.fetch', (_, e) => {
    posts.push({ url: e.url, body: JSON.parse(e.init?.body ?? '{}') })
    const body = {
      now: START,
      friends: [{ ...friend, mood: 'calm', status: 'working', lastSeen: START, isRoomOpen: true }],
      events: [{ id: 'v1', at: START, kind: 'visit', from: friend, to: 'me', line: '콩떡이(가) 놀러 왔어', guest: 'f1' }],
      guests: [{ ...friend, since: START }],
      away,
    }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } }
  })
  await begin($)
  await clock.advance(25_000)
  expect(posts.find(post => post.url === 'http://plaza.test/v1/poll')?.body.me).toMatchObject({ room: { 'floor-1': 'cushion' }, isRoomOpen: true })
  const played = await $.command.run({ command: 'toko', args: 'guest 콩떡 nap' } as never)
  expect(played.text).toBe('콩떡와(과) 놀았어요: 같이 낮잠')
  expect(posts.at(-1)).toMatchObject({ url: 'http://plaza.test/v1/room/act', body: { guest: 'f1', kind: 'nap' } })
  away = { host: 'f1', hostName: '콩떡', since: START, notes: ['같이 낮잠을 잤어'] }
  expect((await $.command.run({ command: 'toko', args: 'visit 콩떡' } as never)).text).toBe('콩떡네 방에 놀러 갔어요. 데려오기 전까지 거기서 지내요.')
  expect(posts.at(-1)).toMatchObject({ url: 'http://plaza.test/v1/visit', body: { to: 'f1' } })
  await $.command.run({ command: 'toko', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'toko',
    component: 'Pane',
    requestId: 'toko-room',
    surface: 'terminal',
    props: { title: '말랑의 방', isFocused: true, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await ui.find({ type: 'Button', key: 'hug-guest-f1' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'come-home' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'visit-f1' })).toBeUndefined()
  await ui.unmount()
  expect((await $.command.run({ command: 'toko', args: 'home' } as never)).text).toBe('콩떡네에서 데려왔어요.')
  expect(posts.at(-1)).toMatchObject({ url: 'http://plaza.test/v1/visit/end', body: {} })
})

test('/toko plaza link gives a page address that knows which pet is mine', { options: { serverUrl: 'http://plaza.test/' } }, async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'pme123', 'toko:wallet': { coins: 0, items: [], worn: [] } })
  await begin($)
  const result = await $.command.run({ command: 'toko', args: 'plaza link' } as never)
  expect(result.text.split('\n')).toEqual([
    '이 주소를 브라우저로 열면 광장에서 말랑을(를) 직접 움직일 수 있어요. 방향키로 걷고 Enter로 말해요.',
    '주소에 내 광장 id가 들어 있으니 다른 사람에게 보내지 마세요.',
    'http://plaza.test/#me=pme123',
  ])
})

test('a gift from a friend lands in the room with their name on it, and what toko is doing rides along on the poll', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me', 'toko:wallet': { coins: 0, items: [], worn: [] } })
  const posts: { url: string; body: Record<string, unknown> }[] = []
  on('http.fetch', (_, e) => {
    posts.push({ url: e.url, body: JSON.parse(e.init?.body ?? '{}') })
    const body = { now: START, friends: [], events: [], guests: [], away: null, stickers: ['star'], gifts: [{ id: 'g1', item: 'cushion', from: '콩떡' }] }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } }
  })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'doing 회의 준비 중' } as never)).text).toBe('광장 이름표에 "회의 준비 중"을(를) 보여 줘요.')
  await clock.advance(25_000)
  expect(posts.find(post => post.url === 'http://plaza.test/v1/poll')?.body.me).toMatchObject({ doing: '회의 준비 중' })
  expect(posts.find(post => post.url === 'http://plaza.test/v1/gift/take')?.body).toMatchObject({ ids: ['g1'] })
  await clock.advance(60_000)
  const wallet = world.saved['toko:wallet'] as { items: string[]; giftedBy: Record<string, string>; room: Record<string, string> }
  expect([wallet.items.includes('cushion'), wallet.giftedBy.cushion, wallet.room['floor-1']]).toEqual([true, '콩떡', 'cushion'])
})

test('the plaza polls the server and a friend’s wave reaches the pet', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  const calls: string[] = []
  const bodies: string[] = []
  on('http.fetch', (_, e) => {
    calls.push(e.url)
    bodies.push(e.init?.body ?? '')
    const body = JSON.stringify({
      now: START,
      friends: [{ id: 'f1', name: '콩떡', color: 'peach', species: 'fox', mood: 'calm', status: 'working', lastSeen: START }],
      events: [{ id: 'e1', at: START, kind: 'wave', from: { id: 'f1', name: '콩떡', color: 'peach', species: 'fox' }, to: 'me', line: '같이 쉬자!' }],
    })
    return { value: { status: 200, ok: true, headers: {}, text: body } }
  })
  await begin($)
  await clock.advance(25_000)
  expect(calls.some(url => url === 'http://plaza.test/v1/poll')).toBe(true)
  const me = JSON.parse(bodies[calls.indexOf('http://plaza.test/v1/poll')] ?? '{}').me
  expect([me.name, me.species, me.sprite.rows.length, me.sprite.palette.length > 3]).toEqual(['말랑', 'penguin', 18, true])
  const status = await $.command.run({ command: 'toko', args: 'plaza' } as never)
  expect(status.text).toContain('콩떡 (여우')
  const sent = await $.command.run({ command: 'toko', args: 'plaza heart 콩떡' } as never)
  expect(sent.text).toContain('보냈어요')
})

test('/toko plaza shows my channel, lists the channels, and moves me when the server allows it', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  const moves: unknown[] = []
  let channel = 2
  const channels = [{ channel: 1, count: 20 }, { channel: 2, count: 7 }]
  on('http.fetch', (_, e) => {
    if (e.url === 'http://plaza.test/v1/channel') {
      const wanted = JSON.parse(e.init?.body ?? '{}').channel
      moves.push(wanted)
      if (wanted === 1) {
        return { value: { status: 409, ok: false, headers: {}, text: JSON.stringify({ error: 'that channel is full' }) } }
      }
      if (wanted === 9) {
        return { value: { status: 400, ok: false, headers: {}, text: JSON.stringify({ error: 'bad request' }) } }
      }
      channel = wanted
      return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ok: true, channel, channels, channelSize: 20 }) } }
    }
    if (e.url === 'http://plaza.test/v1/act') {
      return { value: { status: 404, ok: false, headers: {}, text: JSON.stringify({ error: 'that friend is not in your channel' }) } }
    }
    const friends = [{ id: 'f1', name: '콩떡', color: 'peach', species: 'fox', mood: 'calm', status: 'working', lastSeen: START }]
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ now: START, friends, events: [], channel, channels, channelSize: 20 }) } }
  })
  await begin($)
  await clock.advance(25_000)
  const run = async (args: string): Promise<string> => (await $.command.run({ command: 'toko', args } as never)).text
  expect((await run('plaza')).split('\n')[0]).toBe('광장: 켜짐 · 2번 채널 · 친구 1명')
  expect((await run('plaza channel')).split('\n')).toEqual(['1번 20/20 (가득)', '2번 7/20 (내 채널)', '/toko plaza channel <번호>로 채널을 옮겨요. 다음 빈 번호(3)를 쓰면 새 채널이 열려요.'])
  expect(await run('plaza heart 콩떡')).toBe('그 친구는 지금 내 채널에 없어요. 다른 채널에 있거나 광장을 나갔어요.')
  expect(await run('plaza channel 1')).toBe('1번 채널은 가득 찼어요.')
  expect(await run('plaza channel 9')).toContain('없는 채널 번호예요')
  expect(await run('plaza channel abc')).toContain('1 이상의 정수')
  expect(await run('plaza channel 0')).toContain('1 이상의 정수')
  expect(moves).toEqual([1, 9])
  expect(await run('plaza channel 3')).toBe('3번 채널로 옮겼어요.')
  expect((await run('plaza')).split('\n')[0]).toBe('광장: 켜짐 · 3번 채널 · 친구 0명')
})

test('after moving channel, old cheers already in the new channel are not news, but a wave sent to me still is', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  let channel = 2
  const channels = [{ channel: 1, count: 20 }, { channel: 2, count: 1 }]
  const cheer = { id: 'old-cheer', at: START, kind: 'cheer', from: { id: 'f2', name: '옛응원', color: 'mint' }, to: null, line: '힘내' }
  const wave = { id: 'my-wave', at: START, kind: 'wave', from: { id: 'f3', name: '바로손짓', color: 'peach' }, to: 'me', line: '안녕' }
  on('http.fetch', (_, e) => {
    if (e.url === 'http://plaza.test/v1/channel') {
      channel = 3
      return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ok: true, channel, channels, channelSize: 20 }) } }
    }
    const events = channel === 3 ? [cheer, wave] : []
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ now: START, friends: [], events, channel, channels, channelSize: 20 }) } }
  })
  await begin($)
  await clock.advance(25_000)
  expect((await $.command.run({ command: 'toko', args: 'plaza channel 3' } as never)).text).toBe('3번 채널로 옮겼어요.')
  await clock.advance(25_000)
  const room = await $.ui.mount({ plugin: 'toko', component: 'Pane', requestId: 'toko-room', surface: 'terminal', props: { title: '말랑의 방', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 80 }, view: {} } } as never)
  expect(await room.find({ type: 'Text', text: /바로손짓/ })).toBeDefined()
  expect(await room.find({ type: 'Text', text: /옛응원/ })).toBeUndefined()
  await room.unmount()
})

test('an old server that sends no channel leaves the channel unknown and the plaza command unchanged', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ now: START, friends: [], events: [] }) } }))
  await begin($)
  await clock.advance(25_000)
  expect((await $.command.run({ command: 'toko', args: 'plaza' } as never)).text).toBe('광장: 켜짐 · 친구 0명')
  expect((await $.command.run({ command: 'toko', args: 'plaza channel' } as never)).text).toBe('채널 정보를 아직 받지 못했어요. 잠시 뒤에 다시 해 보세요.')
})

test('a /bonk tells the plaza only what kind of mistake it was, and /toko plaza shows the day’s board', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' }, 'test-dodge')
  const calls: { url: string; body: string }[] = []
  on('http.fetch', (_, e) => {
    calls.push({ url: e.url, body: e.init?.body ?? '' })
    const body = JSON.stringify({ now: START, friends: [], events: [], bonks: { total: 7, top: [{ kind: 'unverified', label: '?', count: 4 }, { kind: 'test-dodge', label: '?', count: 3 }] } })
    return { value: { status: 200, ok: true, headers: {}, text: body } }
  })
  await begin($)
  await clock.advance(25_000)
  await $.command.run({ command: 'bonk', args: '테스트 지우지 말랬잖아' } as never)
  await clock.advance(4000)
  const sent = calls.find(call => call.url === 'http://plaza.test/v1/bonk')
  expect(JSON.parse(sent?.body ?? '{}').kind).toBe('test-dodge')
  expect(sent?.body).not.toContain('지우지')
  const status = await $.command.run({ command: 'toko', args: 'plaza' } as never)
  expect(status.text).toContain('오늘 Clawd가 7번 맞았어요 · 1위 안 돌려 보고 됐다고 함(4번), 2위 테스트를 지우거나 건너뜀(3번)')
})

test('the plaza’s Claude weather shows in /toko plaza, and the pet says so once when it turns into a festival', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  let weather = { level: 'calm', reporting: 53, atLimit: 0, over60: 0, average: 3, at: START }
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ now: START, friends: [], events: [], weather }) } }))
  await begin($)
  await clock.advance(25_000)
  expect((await $.command.run({ command: 'toko', args: 'plaza' } as never)).text).toContain('데이블 Claude 날씨: 맑음 · 53명 평균 5시간 한도 3% 사용 중')
  weather = { level: 'festival', reporting: 53, atLimit: 2, over60: 6, average: 24, at: START }
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  let isSaid = false
  for (let second = 0; second < 30 && !isSaid; second += 1) {
    await clock.advance(1000)
    isSaid = (await ui.findAll({ type: 'Text' })).some(element => /축제가 열렸어/.test(element.text ?? ''))
  }
  expect(isSaid).toBe(true)
  expect((await $.command.run({ command: 'toko', args: 'plaza' } as never)).text).toContain('데이블 Claude 날씨: 축제 · 5시간 한도 60% 넘은 사람 6명 · 다 쓴 사람 2명 · 평균 24%')
  await ui.unmount()
})

test('friends arrive over the plaza event stream, and an open stream only reports what changed', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  const polls: string[] = []
  const streams: string[] = []
  on('http.fetch', (_, e) => {
    polls.push(e.url)
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ now: START, friends: [], events: [] }) } }
  })
  let release = (): void => {}
  const snapshot = { now: START, friends: [{ id: 'f1', name: '콩떡', color: 'peach', species: 'fox', mood: 'calm', status: 'working', lastSeen: START }], events: [] }
  on('process.spawn', async function* (_, e) {
    streams.push(e.argv.at(-1) ?? '')
    yield { stream: 'stdout' as const, text: `retry: 3000\n\nevent: plaza\ndata: ${JSON.stringify(snapshot)}\n\n` }
    await new Promise<void>(resolve => {
      release = resolve
    })
    return { value: { code: 0, signal: null } }
  } as never)
  await begin($)
  await clock.advance(3000)
  expect(streams[0]).toMatch(/^http:\/\/plaza\.test\/v1\/stream\?id=me&tab=[a-z0-9]+$/)
  const status = await $.command.run({ command: 'toko', args: 'plaza' } as never)
  expect(status.text).toContain('콩떡 (여우')
  await clock.advance(5_000)
  const reported = polls.length
  await clock.advance(21_000)
  expect(polls.length).toBe(reported)
  release()
})

test('another session’s finished turn reaches the pet as a bubble', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { kind: 'done', at: START + 1000, label: '배포 확인' } })
  await begin($)
  await clock.advance(3000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /「배포 확인」 끝났어 펭!/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text' })).find(element => element.text === '배포 확인')?.props.color).toBe('suggestion')
  await ui.unmount()
})

test('another session waiting on a permission reaches the pet as a bubble', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { kind: 'waiting', at: START + 1000, label: '' } })
  await begin($)
  await clock.advance(3000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /다른 세션이 확인을 기다려 펭!/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text' })).find(element => element.text === '확인을 기다려 펭!')?.props.color).toBe('warning')
  await ui.unmount()
})

test('a finished turn and a permission request leave signals, and the session end takes them back', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  on('classic.PermissionRequest', () => ({}) as never)
  await begin($)
  await $.prompt.submit({ text: 'fix   the login\nbug before lunch', origin: { kind: 'composer' } } as never)
  await runTurn($, clock, 400, 5000)
  expect(world.saved['toko:signal:session-1']).toMatchObject({ kind: 'done', at: START + 5000, label: 'fix the login bug before' })
  await clock.advance(1000)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } } as never)
  expect((world.saved['toko:signal:session-1'] as { kind: string }).kind).toBe('waiting')
  await $.session.end({ reason: 'other', sessionId: 'session-1', resume: {} } as never)
  expect(world.store.has('toko:signal:session-1')).toBe(false)
})

test('an aborted turn leaves the session idle, not done', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await clock.advance(3000)
  await $.turn.complete({ answer: '', durationMs: 3000, isAborted: true, turnId: 't1', reason: 'aborted' } as never)
  expect((world.saved['toko:signal:session-1'] as { kind: string }).kind).toBe('idle')
})

const PEER_A = { kind: 'working', at: START - 2 * 60_000, label: 'A', since: START - 90 * 60_000, aliveAt: START - 10_000, turnStartedAt: START - 2 * 60_000, prompt: '배포 로그 봐 줘', path: '/work/a.jsonl' }
const PEER_B = { kind: 'done', at: START - 5 * 60_000, label: 'B', since: START - 60 * 60_000, aliveAt: START - 30_000 }

test('/toko sessions lists live sessions in the order they started, without itself or the gone ones', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': PEER_B, 'toko:signal:session-3': PEER_A })
  await begin($)
  world.store.set('toko:signal:session-4', { kind: 'done', at: START - 10 * 60_000, label: '닫힌 세션', since: START - 100 * 60_000, aliveAt: START - 4 * 60_000 })
  const listed = await $.command.run({ command: 'toko', args: 'sessions' } as never)
  expect(listed.text).toBe(['옆 세션 2개', '먼저 볼 것: 2. 「B」 끝남 · 5분 전', '1. 「A」 작업 중 · 2분째', '   마지막 질문: 배포 로그 봐 줘', '2. 「B」 끝남 · 5분 전', '/toko sessions <이름|번호> 요약 · /toko send <이름|번호> <내용> 보내기'].join('\n'))
})

test('/toko sessions points first at the session waiting longest for permission, keeping the numbers in start order', async ($, on) => {
  mock.clock(on, { now: START })
  const waitingLong = { kind: 'waiting', at: START - 12 * 60_000, label: '배포', since: START - 50 * 60_000, aliveAt: START - 10_000 }
  const waitingShort = { kind: 'waiting', at: START - 1 * 60_000, label: '리뷰', since: START - 40 * 60_000, aliveAt: START - 10_000 }
  engine(on, { 'toko:pet': PET, 'toko:signal:session-2': PEER_B, 'toko:signal:session-3': waitingShort, 'toko:signal:session-4': waitingLong })
  await begin($)
  const lines = (await $.command.run({ command: 'toko', args: 'sessions' } as never)).text?.split('\n') ?? []
  expect(lines.slice(0, 5)).toEqual(['옆 세션 3개', '먼저 볼 것: 2. 「배포」 허락 대기 · 12분째', '1. 「B」 끝남 · 5분 전', '2. 「배포」 허락 대기 · 12분째', '3. 「리뷰」 허락 대기 · 1분째'])
})

test('/toko sessions leaves out what to see first when only one session is open or none needs a person', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': PEER_B })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'sessions' } as never)).text).not.toContain('먼저 볼 것')
  world.store.set('toko:signal:session-2', PEER_A)
  world.store.set('toko:signal:session-3', { ...PEER_A, label: 'C', since: START - 80 * 60_000 })
  expect((await $.command.run({ command: 'toko', args: 'sessions' } as never)).text).not.toContain('먼저 볼 것')
})

test('/toko sessions with no other session says so', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'sessions' } as never)).text).toBe('옆 세션이 없어요.')
})

test('/toko sessions <n> summarizes the end of that session’s transcript with the small model', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-3': PEER_A }, '하는 일: 배포 확인\n어디까지: 롤아웃 OK\n막힌 것: 없음')
  const tail = ['{"type":"user","message":{"role":"user","content":"배포 확인해 줘"}}', '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"롤아웃 OK"}]}}'].join('\n')
  on('process.run', (_, e) => ({ value: { exitCode: 0, stdout: e.argv[0] === 'tail' ? `잘린 앞줄"}\n${tail}\n` : '', stderr: '' } }) as never)
  await begin($)
  const summary = await $.command.run({ command: 'toko', args: 'sessions 1' } as never)
  expect(summary.text).toBe(['「A」 작업 중 · 2분째', '하는 일: 배포 확인', '어디까지: 롤아웃 OK', '막힌 것: 없음'].join('\n'))
  expect(world.models.at(-1)).toContain('- 배포 확인해 줘')
  expect(world.models.at(-1)).toContain('롤아웃 OK')
  expect(world.models.at(-1)).toContain('지금 아직 일하는 중')
  expect(world.systems.at(-1)).toContain('펫 말투 없이')
  await $.command.run({ command: 'toko', args: 'ai off' } as never)
  expect((await $.command.run({ command: 'toko', args: 'sessions 1' } as never)).text).toBe('「A」 작업 중 · 2분째\n요약은 못 했어요(작은 모델을 쓸 수 없어요).')
  expect((await $.command.run({ command: 'toko', args: 'sessions a' } as never)).text).toBe('「A」 작업 중 · 2분째\n요약은 못 했어요(작은 모델을 쓸 수 없어요).')
})

test('/toko send leaves a message for that session, keeping its lines', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-3': PEER_A })
  await begin($)
  const sent = await $.command.run({ command: 'toko', args: 'send 1 로그도\n같이 봐 줘' } as never)
  expect(sent.text).toBe('「A」에 보냈어요. 그 세션이 하던 일을 끝내고 입력창이 비면 바로 들어가요.')
  const keys = [...world.store.keys()].filter(key => key.startsWith('toko:inbox:session-3:'))
  expect(keys.length).toBe(1)
  expect(world.store.get(keys[0] ?? '')).toMatchObject({ text: '로그도\n같이 봐 줘', replyTo: 'session-1' })
  expect((await $.command.run({ command: 'toko', args: 'send 9 아무거나' } as never)).text).toBe('그런 옆 세션이 없어요. /toko sessions 로 이름과 번호를 확인해 주세요.')
})

test('/toko send picks the session by part of its tab name, in any case', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { ...PEER_B, label: 'Deploy 배포' }, 'toko:signal:session-3': { ...PEER_A, label: 'Review 리뷰' } })
  await begin($)
  const sent = await $.command.run({ command: 'toko', args: 'send review 로그 봐 줘' } as never)
  expect(sent.text).toBe('「Review 리뷰」에 보냈어요. 그 세션이 하던 일을 끝내고 입력창이 비면 바로 들어가요.')
  const inbox = (id: string) => [...world.store.keys()].filter(key => key.startsWith(`toko:inbox:${id}:`))
  expect(inbox('session-3').length).toBe(1)
  expect(world.store.get(inbox('session-3')[0] ?? '')).toMatchObject({ text: '로그 봐 줘' })
  expect(inbox('session-2').length).toBe(0)
})

test('/toko send sends nothing when the name fits several sessions or none', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { ...PEER_B, label: '배포 확인' }, 'toko:signal:session-3': { ...PEER_A, label: '배포 롤백' } })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'send 배포 로그 봐 줘' } as never)).text).toBe('「배포 롤백」, 「배포 확인」 중 어느 세션인지 모르겠어요. 이름을 더 쓰거나 번호로 골라 주세요.')
  expect((await $.command.run({ command: 'toko', args: 'send 리뷰 로그 봐 줘' } as never)).text).toBe('그런 옆 세션이 없어요. /toko sessions 로 이름과 번호를 확인해 주세요.')
  expect([...world.store.keys()].filter(key => key.startsWith('toko:inbox:')).length).toBe(0)
})

test('a message from another session is sent as the user and the pet says where it came from', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:inbox:session-1:m1': { text: '로그 봐 줘', from: '배포 확인', at: START } })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  await begin($)
  await clock.advance(3000)
  expect(world.submitted).toEqual(['로그 봐 줘'])
  expect(world.submittedAsUser).toEqual([true])
  expect(world.filled).toEqual([])
  expect(world.store.has('toko:inbox:session-1:m1')).toBe(false)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /「배포 확인」에서 할 일이 왔어\. 바로 보냈어 펭!/ })).toBeDefined()
  await ui.unmount()
})

test('a message waits in the inbox while the session works or the box has a draft, then goes in', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  let draft = '작성 중'
  on('prompt.read', () => ({ value: { text: draft, cursor: 0 } }) as never)
  await begin($)
  world.store.set('toko:inbox:session-1:m1', { text: '로그 봐 줘', from: '배포 확인', at: START })
  await clock.advance(3000)
  expect(world.submitted).toEqual([])
  expect(world.filled).toEqual([])
  expect(world.store.has('toko:inbox:session-1:m1')).toBe(true)
  draft = ''
  await $.turn.start({ text: 'fix it', turnId: 't1' } as never)
  await clock.advance(3000)
  expect(world.store.has('toko:inbox:session-1:m1')).toBe(true)
  await $.turn.complete({ answer: 'done', durationMs: 3000, isAborted: false, turnId: 't1', reason: 'answer', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' } })
  await clock.advance(3000)
  expect(world.submitted).toEqual(['로그 봐 줘'])
  expect(world.store.has('toko:inbox:session-1:m1')).toBe(false)
})

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude' }

const replyKeys = (world: World, sessionId: string): string[] => [...world.store.keys()].filter(key => key.startsWith(`toko:reply:${sessionId}:`))

test('the answer to a message from another session goes back to that session, and later turns do not', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:inbox:session-1:m1': { text: '로그 봐 줘', from: '배포 확인', at: START, replyTo: 'session-9' } })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  await begin($)
  await clock.advance(3000)
  await $.turn.start({ text: '로그 봐 줘', turnId: 't1' } as never)
  await $.turn.complete({ answer: '로그 깨끗해요', durationMs: 3000, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })
  expect(replyKeys(world, 'session-9').map(key => world.store.get(key))).toEqual([expect.objectContaining({ text: '로그 깨끗해요' })])
  await $.turn.start({ text: 'fix it', turnId: 't2' } as never)
  await $.turn.complete({ answer: 'fixed', durationMs: 3000, isAborted: false, turnId: 't2', reason: 'answer', usage: USAGE })
  expect(replyKeys(world, 'session-9').length).toBe(1)
})

test('a message without a sender to answer sends nothing back', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:inbox:session-1:m1': { text: '로그 봐 줘', from: '배포 확인', at: START } })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  await begin($)
  await clock.advance(3000)
  await $.turn.start({ text: '로그 봐 줘', turnId: 't1' } as never)
  await $.turn.complete({ answer: '로그 깨끗해요', durationMs: 3000, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })
  expect([...world.store.keys()].some(key => key.startsWith('toko:reply:'))).toBe(false)
})

test('an answer that comes back is shown in the chat as it was written, one log line per line, only its first lines when long', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:reply:session-1:r1': { text: '로그 깨끗해요', from: '배포 확인', at: START } })
  await begin($)
  await clock.advance(3000)
  expect(world.logs.splice(0)).toEqual(['「배포 확인」 답', '로그 깨끗해요'])
  expect(replyKeys(world, 'session-1')).toEqual([])
  world.store.set('toko:reply:session-1:r2', { text: '결론\n\n1\n2\n3\n4\n5\n6', from: '', at: START + 3000 })
  await clock.advance(3000)
  expect(world.logs.splice(0)).toEqual(['「이름 없는 세션」 답', '결론', '1', '2', '3', '4', '5', '…(15자 중 앞부분 · 전체는 그 세션에서)'])
  world.store.set('toko:reply:session-1:r3', { text: '가'.repeat(2000), from: '', at: START + 6000 })
  await clock.advance(3000)
  expect(world.logs.splice(0)).toEqual(['「이름 없는 세션」 답', '가'.repeat(400), '…(2,000자 중 앞부분 · 전체는 그 세션에서)'])
})

test('a session starting or working tells other sessions nothing, while one finishing still does', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  world.store.set('toko:signal:session-2', { kind: 'working', at: START + 1000, label: '배포 확인', since: START, aliveAt: START + 1000 })
  await clock.advance(3000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /배포 확인/ })).toBeUndefined()
  world.store.set('toko:signal:session-2', { kind: 'done', at: START + 4000, label: '배포 확인', since: START, aliveAt: START + 4000 })
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /「배포 확인」 끝났어 펭!/ })).toBeDefined()
  await ui.unmount()
})

const PEER_DONE = { kind: 'done', at: START + 4000, label: 'A배포 일', since: START - 60_000, aliveAt: START + 4000, path: '/work/a.jsonl' }

test('a session finishing asks what next: a summary goes to the transcript, and the next task starts in the prompt box', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET }, '하는 일: 배포 확인\n어디까지: 롤아웃 OK')
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('process.run', () => ({ value: { exitCode: 0, stdout: '{"type":"user","message":{"role":"user","content":"배포 확인해 줘"}}\n', stderr: '' } }) as never)
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  world.store.set('toko:signal:session-2', PEER_DONE)
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /대답: 요약 보기 · 다음 일 보내기 · 괜찮아/ })).toBeDefined()
  await $.command.run({ command: 'toko', args: 'answer 요약 보기' } as never)
  expect(world.logs.slice(-3)).toEqual(['「A배포 일」 끝남 · 1분 전', '하는 일: 배포 확인', '어디까지: 롤아웃 OK'])
  world.store.set('toko:signal:session-2', { ...PEER_DONE, at: START + 8000, aliveAt: START + 8000 })
  await clock.advance(3000)
  await $.command.run({ command: 'toko', args: 'answer 다음 일 보내기' } as never)
  expect(world.filled).toEqual(['/toko send A배포 '])
  await ui.unmount()
})

test('a session finishing while another offer is up only says so, and never uses up the hour’s bubbles', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:budget': { day: '2026-10-29', bubbles: [START - 4000, START - 3000, START - 2000, START - 1000] } })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  world.store.set('toko:signal:session-2', PEER_DONE)
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /대답: 요약 보기/ })).toBeDefined()
  await $.command.run({ command: 'toko', args: 'answer 괜찮아' } as never)
  await $.command.run({ command: 'toko', args: 'event stretch' } as never)
  world.store.set('toko:signal:session-2', { ...PEER_DONE, at: START + 8000, aliveAt: START + 8000 })
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /「A배포 일」 끝났어/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /대답: 좋아 · 나중에 · 오늘은 그만/ })).toBeDefined()
  await ui.unmount()
  await $.session.end({ reason: 'other', sessionId: 'session-1', resume: {} } as never)
  expect((world.saved['toko:budget'] as { bubbles: number[] }).bubbles.length).toBe(5)
})

test('saying just the answer to an offer is taken by the pet without asking Claude, and longer words still go to Claude', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.command.run({ command: 'toko', args: 'event stretch' } as never)
  expect(await $.prompt.submit({ text: '토코야 좋아!', origin: { kind: 'composer' } } as never)).toMatchObject({ drop: '좋아(으)로 대답했어요.' })
  expect(await ui.find({ type: 'Text', text: /팔을 머리 위로/ })).toBeDefined()
  await ui.unmount()
  await $.command.run({ command: 'toko', args: 'event stretch' } as never)
  await $.prompt.submit({ text: '토코야 좋아하는 음식 뭐야', origin: { kind: 'composer' } } as never)
  expect(world.submitted).toEqual(['좋아하는 음식 뭐야'])
  expect((await $.command.run({ command: 'toko', args: '나중에' } as never)).text).toBe('나중에(으)로 대답했어요.')
})

test('while an offer is up, typing just its own action answers it without the name, but everyday replies and longer asks still go to Claude', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET }, '하는 일: 배포 확인\n어디까지: 롤아웃 OK')
  on('process.run', () => ({ value: { exitCode: 0, stdout: '{"type":"user","message":{"role":"user","content":"배포 확인해 줘"}}\n', stderr: '' } }) as never)
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  world.store.set('toko:signal:session-2', PEER_DONE)
  await clock.advance(3000)
  await $.prompt.submit({ text: '이 PR 요약해줘', origin: { kind: 'composer' } } as never)
  expect(world.submitted).toEqual(['이 PR 요약해줘'])
  world.store.set('toko:signal:session-2', { ...PEER_DONE, at: START + 8000, aliveAt: START + 8000 })
  await clock.advance(3000)
  expect(await $.prompt.submit({ text: '요약 보여줘', origin: { kind: 'composer' } } as never)).toMatchObject({ drop: '요약 보기(으)로 대답했어요.' })
  expect(world.logs.slice(-2)).toEqual(['하는 일: 배포 확인', '어디까지: 롤아웃 OK'])
  await ui.unmount()
  await $.command.run({ command: 'toko', args: 'event stretch' } as never)
  await $.prompt.submit({ text: '좋아', origin: { kind: 'composer' } } as never)
  expect(world.submitted).toEqual(['이 PR 요약해줘', '좋아'])
})

test('Claude cannot send into other sessions through the toko tool: it only fills the person’s prompt box with the command', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-3': PEER_A })
  let draft = ''
  on('prompt.read', () => ({ value: { text: draft, cursor: 0 } }) as never)
  await begin($)
  const inbox = () => [...world.store.keys()].filter(key => key.startsWith('toko:inbox:'))
  const tool = async (args: string) => String((await $.tool.call({ tool: 'mcp__toko__command', args } as never)).result)
  expect(await tool('send 1 rm -rf build')).toBe('입력창에 넣어 뒀어요. 엔터를 누르면 「A」에 보내요.')
  expect(world.filled).toEqual(['/toko send 1 rm -rf build'])
  expect(await tool('보내 a 로그 봐 줘')).toBe('입력창에 넣어 뒀어요. 엔터를 누르면 「A」에 보내요.')
  draft = '쓰던 글'
  expect(await tool('send a 로그 봐 줘')).toBe('입력창에 넣지 못했어요. `/toko send a 로그 봐 줘` 를 치면 「A」에 보내요.')
  draft = ''
  world.isFillRefused = true
  expect(await tool('send a 로그 봐 줘')).toBe('입력창에 넣지 못했어요. `/toko send a 로그 봐 줘` 를 치면 「A」에 보내요.')
  expect(await tool('send 없음 로그 봐 줘')).toBe('그런 옆 세션이 없어요. /toko sessions 로 이름과 번호를 확인해 주세요.')
  expect(world.filled.length).toBe(2)
  expect(inbox()).toEqual([])
})

test('보내 works in place of send, and a sentence naming the session first is sent as said', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { ...PEER_B, label: 'B리뷰' }, 'toko:signal:session-3': { ...PEER_A, label: 'A배포' } })
  await begin($)
  const inboxOf = (id: string) => [...world.store.keys()].filter(key => key.startsWith(`toko:inbox:${id}:`)).map(key => (world.store.get(key) as { text: string }).text)
  expect((await $.command.run({ command: 'toko', args: '보내 리뷰 코멘트 확인해 줘' } as never)).text).toBe('「B리뷰」에 보냈어요. 그 세션이 하던 일을 끝내고 입력창이 비면 바로 들어가요.')
  expect((await $.command.run({ command: 'toko', args: '배포한테 로그 봐 줘라고 보내줘' } as never)).text).toBe('「A배포」에 보냈어요. 그 세션이 하던 일을 끝내고 입력창이 비면 바로 들어가요.')
  expect([inboxOf('session-2'), inboxOf('session-3')]).toEqual([['코멘트 확인해 줘'], ['로그 봐 줘']])
  const chat = await $.command.run({ command: 'toko', args: '없음한테 로그 봐 줘 보내줘' } as never)
  expect(chat.context?.[0]).toContain('말랑(으)로서')
  expect(inboxOf('session-2').length + inboxOf('session-3').length).toBe(2)
})

test('calling the pet by name in the prompt box works like /toko, and only for what the person typed', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-3': PEER_A })
  await begin($)
  const sessions = await $.prompt.submit({ text: '토코야 sessions', origin: { kind: 'composer' } } as never)
  expect(sessions).toMatchObject({ drop: expect.stringContaining('옆 세션 1개') })
  const sent = await $.prompt.submit({ text: '말랑아, A한테 로그 봐 줘 보내줘', origin: { kind: 'composer' } } as never)
  expect(sent).toMatchObject({ drop: '「A」에 보냈어요. 그 세션이 하던 일을 끝내고 입력창이 비면 바로 들어가요.' })
  expect(world.submitted).toEqual([])
  const chat = await $.prompt.submit({ text: '토코야 안녕!', origin: { kind: 'composer' } } as never)
  expect(chat).toMatchObject({ text: '안녕!' })
  expect(world.submitted).toEqual(['안녕!'])
  expect(world.contexts.at(-1)).toContain('말랑(으)로서')
  await $.prompt.submit({ text: '토코야 sessions', origin: { kind: 'plugin', asUser: true } } as never)
  await $.prompt.submit({ text: '토코 문서 고쳐 줘', origin: { kind: 'composer' } } as never)
  expect(world.submitted).toEqual(['안녕!', '토코야 sessions', '토코 문서 고쳐 줘'])
  expect([...world.store.keys()].filter(key => key.startsWith('toko:inbox:')).length).toBe(1)
})

test('a session keeps itself listed with a heartbeat while it sits idle', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  expect((world.saved['toko:signal:session-1'] as { kind: string }).kind).toBe('idle')
  await clock.advance(10 * 60_000)
  expect((world.saved['toko:signal:session-1'] as { aliveAt: number }).aliveAt).toBeGreaterThan(START + 8 * 60_000)
})

test('its own signal, signals from before it started and quiet hours stay silent', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const quiet = [new Date(START).getHours(), (new Date(START).getHours() + 1) % 24]
  const world = engine(on, {
    'toko:pet': PET,
    'toko:signal:session-1': { kind: 'done', at: START + 1000, label: '내 세션' },
    'toko:signal:session-2': { kind: 'done', at: START - 1000, label: '이전 세션' },
  })
  await begin($)
  await clock.advance(3000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /세션이/ })).toBeUndefined()
  await ui.unmount()
  await $.command.run({ command: 'toko', args: `quiet ${quiet[0]}-${quiet[1]}` } as never)
  world.store.set('toko:signal:session-3', { kind: 'done', at: START + 4000, label: '조용히' })
  await clock.advance(3000)
  const later = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await later.find({ type: 'Text', text: /조용히/ })).toBeUndefined()
  await later.unmount()
})

test('signals from an earlier day are cleared when a session starts', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:old': { kind: 'done', at: START - 24 * 3_600_000, label: '어제' } })
  await begin($)
  expect(world.store.has('toko:signal:old')).toBe(false)
})

const LIVE = START + 3_600_000

test('a session left waiting for permission over 10 minutes is pointed out once more, and 괜찮아 settles it', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { kind: 'waiting', at: START - 12 * 60_000, label: '배포', since: START - 60 * 60_000, aliveAt: LIVE } })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /「배포」 12분째 확인을 기다려 펭!/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /대답: 요약 보기 · 다음 일 보내기 · 괜찮아/ })).toBeDefined()
  await $.command.run({ command: 'toko', args: 'answer 괜찮아' } as never)
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /대답: 요약 보기/ })).toBeUndefined()
  expect(world.store.get('toko:reminded:session-2')).toBe(START - 12 * 60_000)
  await ui.unmount()
})

test('a session finished over 30 minutes ago is asked about, a fresher one is not', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, {
    'toko:pet': PET,
    'toko:signal:session-2': { kind: 'done', at: START - 20 * 60_000, label: '방금', since: START - 60 * 60_000, aliveAt: LIVE },
    'toko:signal:session-3': { kind: 'done', at: START - 31 * 60_000, label: '리뷰', since: START - 90 * 60_000, aliveAt: LIVE },
  })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /「리뷰」 끝난 지 31분 됐어\. 안 봐도 돼\? 펭!/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /방금/ })).toBeUndefined()
  await ui.unmount()
})

test('a session already answered or reminded about in any tab is not brought up again until it changes', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const old = { kind: 'done', at: START - 40 * 60_000, label: '리뷰', since: START - 90 * 60_000, aliveAt: LIVE }
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-2': old, 'toko:reminded:session-2': old.at })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /리뷰/ })).toBeUndefined()
  world.store.set('toko:signal:session-2', { ...old, kind: 'waiting', at: START - 11 * 60_000 })
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /「리뷰」 11분째 확인을 기다려/ })).toBeDefined()
  await ui.unmount()
})

test('reminders keep quiet during a focus timer and with peers off', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:signal:session-2': { kind: 'waiting', at: START - 15 * 60_000, label: '배포', since: START - 60 * 60_000, aliveAt: LIVE } })
  await begin($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.command.run({ command: 'toko', args: 'peers off' } as never)
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /배포/ })).toBeUndefined()
  await $.command.run({ command: 'toko', args: 'peers on' } as never)
  await $.command.run({ command: 'toko', args: 'focus 25' } as never)
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /배포/ })).toBeUndefined()
  await $.command.run({ command: 'toko', args: 'focus off' } as never)
  await clock.advance(3000)
  expect(await ui.find({ type: 'Text', text: /「배포」 15분째 확인을 기다려/ })).toBeDefined()
  await ui.unmount()
})

test('a reminder about a session that is gone is cleared when a session starts', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:reminded:gone': START - 60_000 })
  await begin($)
  expect(world.store.has('toko:reminded:gone')).toBe(false)
})

test('/toko peers off keeps other sessions’ news to itself', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  const off = await $.command.run({ command: 'toko', args: 'peers off' } as never)
  expect(off.text).toContain('전하지 않을게요')
  expect((world.saved['toko:settings'] as { isPeersOn: boolean }).isPeersOn).toBe(false)
  world.store.set('toko:signal:session-2', { kind: 'done', at: START + 1000, label: '배포 확인' })
  await clock.advance(3000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /배포 확인/ })).toBeUndefined()
})

test('a friend’s wave rides the spinner while a turn runs, then steps aside', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  drawEngine(on)
  on('http.fetch', () => {
    const body = JSON.stringify({
      now: START,
      friends: [{ id: 'f1', name: '콩떡', color: 'peach', species: 'fox', mood: 'calm', status: 'working', lastSeen: START }],
      events: [{ id: 'e1', at: START, kind: 'wave', from: { id: 'f1', name: '콩떡', color: 'peach', species: 'fox' }, to: 'me', line: '같이 쉬자!' }],
    })
    return { value: { status: 200, ok: true, headers: {}, text: body } }
  })
  await begin($)
  await clock.advance(25_000)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  const props = { word: 'Baking', message: null, suffix: '…', mode: 'responding' }
  const spinner = await $.ui.mount({ plugin: 'toko', component: 'Spinner', requestId: 'agent', surface: 'terminal', props } as never)
  expect(await spinner.find({ type: 'Text', text: /콩떡\(여우\).*손을 흔들었어 — 같이 쉬자!/ })).toBeDefined()
  await spinner.unmount()
  await clock.advance(30_000)
  const later = await $.ui.mount({ plugin: 'toko', component: 'Spinner', requestId: 'agent', surface: 'terminal', props } as never)
  expect(await later.find({ type: 'Text', text: /콩떡/ })).toBeUndefined()
  await later.unmount()
})

test('when a turn runs a while, a friend who is also waiting on Claude drops by, and goes home when the turn ends', { options: { serverUrl: 'http://plaza.test' } }, async ($, on) => {
  const clock = mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:plaza-id': 'me' })
  drawEngine(on)
  let status = 'idle'
  on('http.fetch', () => {
    const body = JSON.stringify({ now: START, friends: [{ id: 'f1', name: '콩떡', color: 'peach', species: 'fox', mood: 'calm', status, lastSeen: START + 10 * 60_000 }], events: [] })
    return { value: { status: 200, ok: true, headers: {}, text: body } }
  })
  const props = { word: 'Baking', message: null, suffix: '…', mode: 'responding' }
  const spinnerShows = async (text: RegExp) => {
    const spinner = await $.ui.mount({ plugin: 'toko', component: 'Spinner', requestId: 'agent', surface: 'terminal', props } as never)
    const found = await spinner.find({ type: 'Text', text })
    await spinner.unmount()
    return found !== undefined
  }
  await begin($)
  await clock.advance(25_000)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  await clock.advance(40_000)
  expect(await spinnerShows(/콩떡/)).toBe(false)
  await $.turn.complete({ answer: 'ok', durationMs: 40_000, isAborted: false, turnId: 't1', reason: 'answer', usage: USAGE })
  status = 'working'
  await clock.advance(25_000)
  await $.turn.start({ text: 'go', turnId: 't2' } as never)
  await clock.advance(10_000)
  expect(await spinnerShows(/콩떡/)).toBe(false)
  await clock.advance(25_000)
  expect(await spinnerShows(/콩떡\(여우\).*Claude 기다리는 중이래/)).toBe(true)
  await $.turn.complete({ answer: 'ok', durationMs: 35_000, isAborted: false, turnId: 't2', reason: 'answer', usage: USAGE })
  expect(await spinnerShows(/콩떡/)).toBe(false)
})

test('/toko draw spends coins, shelves the current pet and hatches a new egg', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 250, items: [], worn: [] } })
  await begin($)
  const drawn = await $.command.run({ command: 'toko', args: 'draw' } as never)
  await clock.advance(9000)
  expect((world.saved['toko:earn:session-1'] as { spent: number }).spent).toBe(200)
  const pet = world.store.get('toko:pet') as { id: string; bones: { species: string }; growth: { stage: string } }
  const shelf = ((world.store.get('toko:shelf') ?? []) as { id: string }[]).map(shelved => shelved.id)
  if (String(drawn.text).startsWith('이미 있는')) {
    expect(drawn.text).toContain('펭귄이(가) 나와서 별조각 1개로 바꿨어요')
    expect([pet.id, shelf]).toEqual([PET.id, []])
  } else {
    expect(drawn.text).toContain('알이 나왔어요')
    expect([pet.id === PET.id, pet.growth.stage, shelf]).toEqual([false, 'baby', [PET.id]])
  }
  const again = await $.command.run({ command: 'toko', args: 'draw' } as never)
  expect(again.text).toContain('모자라')
})

test('a drawn pet survives an old terminal that writes back the pet it had before the draw', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:wallet': { coins: 250, items: [], worn: [] } })
  await begin($)
  await $.command.run({ command: 'toko', args: 'draw' } as never)
  await clock.advance(9000)
  const drawn = (world.store.get('toko:pet') as { id: string }).id
  world.store.set('toko:pet', PET)
  world.store.set('toko:shelf', [])
  await clock.advance(9000)
  const pet = world.store.get('toko:pet') as { id: string }
  const shelf = (world.store.get('toko:shelf') as { id: string }[]).map(shelved => shelved.id)
  expect([pet.id, ...shelf].sort()).toEqual([...new Set([PET.id, drawn])].sort())
})

test('a full collection stops the draw before it takes any coins', async ($, on) => {
  mock.clock(on, { now: START })
  const species = ['cat', 'bear', 'chick', 'bunny', 'frog', 'fox', 'dragon', 'unicorn', 'ghost', 'phoenix', 'robot', 'axolotl', 'debul']
  const shelf = species.map((kind, index) => ({ ...FRIEND_PET, id: `pet-s${index}`, bones: { seed: 100 + index, species: kind } }))
  const world = engine(on, { 'toko:pet': PET, 'toko:shelf': shelf, 'toko:wallet': { coins: 500, items: [], worn: [] } })
  await begin($)
  const drawn = await $.command.run({ command: 'toko', args: 'draw' } as never)
  expect(drawn.text).toContain('다 모았어')
  expect((world.saved['toko:earn:session-1'] as { spent: number } | undefined)?.spent ?? 0).toBe(0)
  const pets = await $.command.run({ command: 'toko', args: 'pets' } as never)
  expect(pets.text).toContain('12. 콩떡 · 우파루파 · 레어')
})

test('/toko pick brings a shelved pet back and shelves the current one', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:shelf': [FRIEND_PET] })
  await begin($)
  const picked = await $.command.run({ command: 'toko', args: 'pick 1' } as never)
  expect(picked.text).toContain('콩떡')
  expect((world.saved['toko:pet'] as { id: string }).id).toBe(FRIEND_PET.id)
  expect((world.saved['toko:shelf'] as { id: string }[]).map(shelved => shelved.id)).toEqual([PET.id])
  const missing = await $.command.run({ command: 'toko', args: 'pick 9' } as never)
  expect(missing.text).toContain('보관함')
})

test('a pet saved before species existed loads as a cat', async ($, on) => {
  mock.clock(on, { now: START })
  const legacy = { bones: { seed: 7, color: 'mint', pattern: 'spots', eyes: 'round', rarity: 'rare' }, soul: PET.soul, growth: PET.growth }
  const world = engine(on, { 'toko:pet': legacy })
  await begin($)
  const card = await $.command.run({ command: 'toko', args: 'card' } as never)
  expect(card.text).toContain('고양이 · 노말')
  await $.command.run({ command: 'toko', args: 'mute' } as never)
  expect(world.saved['toko:pet']).toEqual({ ...legacy, id: 'pet-7', bones: { seed: 7, species: 'cat' } })
})

test('the room pane offers a draw and a button for each shelved pet', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:shelf': [FRIEND_PET] })
  await begin($)
  await $.command.run({ command: 'toko', args: '' } as never)
  const ui = await $.ui.mount({
    plugin: 'toko',
    component: 'Pane',
    requestId: 'toko-room',
    surface: 'terminal',
    props: { title: '말랑의 방', isFocused: true, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  })
  expect(await ui.find({ type: 'Button', key: 'draw' })).toBeDefined()
  await ui.press({ key: `pick-${FRIEND_PET.id}` })
  expect(await ui.find({ type: 'Text', text: /콩떡 · 여우/ })).toBeDefined()
  await ui.unmount()
})

test('a focus timer keeps other sessions’ news to itself too', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  await $.command.run({ command: 'toko', args: 'focus 5' } as never)
  world.store.set('toko:signal:session-2', { kind: 'waiting', at: START + 1000, label: '배포 확인' })
  await clock.advance(3000)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /집중/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /배포 확인/ })).toBeUndefined()
  await ui.unmount()
})

test('a session with a title signals under its title rather than its last prompt', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  on('classic.UserPromptSubmit', () => ({}) as never)
  await begin($)
  await $.classic.UserPromptSubmit({ prompt: '응 진행해줘', session_title: 'toko 세션 완료 알림 기능' } as never)
  await $.prompt.submit({ text: '응 진행해줘', origin: { kind: 'composer' } } as never)
  await runTurn($, clock, 400, 5000)
  expect((world.saved['toko:signal:session-1'] as { label: string }).label).toBe('toko 세션 완료 알림 기능')
})

test('a session without a name signals under the AI title its tab shows', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  const runs: string[][] = []
  on('classic.UserPromptSubmit', () => ({}) as never)
  on('process.run', (_, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: '{"type":"ai-title","aiTitle":"옛 제목"}\n{"type":"ai-title","aiTitle":"toko 세션 완료 알림 기능"}\n', stderr: '' } } as never
  })
  await begin($)
  await $.classic.UserPromptSubmit({ prompt: '응 진행해줘', transcript_path: '/work/session-1.jsonl' } as never)
  await $.prompt.submit({ text: '응 진행해줘', origin: { kind: 'composer' } } as never)
  await runTurn($, clock, 400, 5000)
  expect(runs.length).toBeGreaterThan(0)
  expect(runs.every(run => run.join(' ') === 'grep -F "type":"ai-title" /work/session-1.jsonl')).toBe(true)
  expect((world.saved['toko:signal:session-1'] as { label: string }).label).toBe('toko 세션 완료 알림 기능')
})

const turn = async ($: Engine, id: string, text: string, answer: string) => {
  await $.turn.start({ text, turnId: id } as never)
  await $.turn.complete({ answer, durationMs: 3000, isAborted: false, turnId: id, reason: 'answer', usage: USAGE })
}

test('each answered turn is kept in the session’s record of today, short and continued', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:worked:session-1': { day: '2026-10-29', label: '배포 확인', since: START - 60_000, turns: [{ prompt: '아침 일', answer: '했어요' }] } })
  on('classic.UserPromptSubmit', () => ({}) as never)
  await begin($)
  await $.classic.UserPromptSubmit({ prompt: '배포 봐 줘', session_title: '배포 확인' } as never)
  await turn($, 't1', '배포 봐 줘', '롤아웃 OK')
  await turn($, 't2', '멈춰', '')
  await turn($, 't3', '로그도', '가'.repeat(300))
  expect(world.store.get('toko:worked:session-1')).toEqual({
    day: '2026-10-29',
    label: '배포 확인',
    since: START - 60_000,
    turns: [
      { prompt: '아침 일', answer: '했어요' },
      { prompt: '배포 봐 줘', answer: '롤아웃 OK' },
      { prompt: '로그도', answer: '가'.repeat(240) },
    ],
  })
})

test('records from an earlier day or in the old shape are cleared when a session starts', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, {
    'toko:pet': PET,
    'toko:worked:old': { day: '2026-10-28', label: '어제 일', since: START - 86_400_000, turns: [] },
    'toko:worked:shape': { day: '2026-10-29', label: '옛 형식', path: '/work/a.jsonl', since: START },
  })
  await begin($)
  expect(world.store.has('toko:worked:old')).toBe(false)
  expect(world.store.has('toko:worked:shape')).toBe(false)
})

test('/toko today writes the day as work done and work going on, from every session in one call', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(
    on,
    {
      'toko:pet': PET,
      'toko:worked:b': { day: '2026-10-29', label: 'B', since: START - 60_000, turns: [{ prompt: '리뷰해 줘', answer: '보는 중' }] },
      'toko:worked:a': { day: '2026-10-29', label: 'A', since: START - 3_600_000, turns: [{ prompt: '배포 봐 줘', answer: '롤아웃 OK' }] },
    },
    '한 일\n- 배포 확인했어요 (0.2.17)\n진행 중\n- 리뷰 중이에요\n잡담',
  )
  await begin($)
  world.store.set('toko:worked:y', { day: '2026-10-28', label: 'Y', since: START - 86_400_000, turns: [{ prompt: '어제', answer: '어제 답' }] })
  const text = (await $.command.run({ command: 'toko', args: 'today' } as never)).text ?? ''
  expect(text.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 배포 확인했어요 (0.2.17)\n진행 중\n- 리뷰 중이에요')
  const prompts = world.models.filter(prompt => prompt.includes('오늘 한 일을 일 단위로'))
  expect(prompts.length).toBe(1)
  expect(prompts[0]?.indexOf('「A」')).toBeLessThan(prompts[0]?.indexOf('「B」') ?? -1)
  expect(prompts[0]).not.toContain('「Y」')
  await $.command.run({ command: 'toko', args: 'ai off' } as never)
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe(
    '10월 29일 (목) 한 일\n- 「A」 배포 봐 줘\n- 「B」 리뷰해 줘\n(작은 모델이 꺼져 있어서 세션별 마지막 질문만 보여요)',
  )
})

const WORKED_A = { day: '2026-10-29', label: 'A', since: START - 3_600_000, turns: [{ prompt: '배포 봐 줘', answer: '롤아웃 OK' }] }

test('/toko today keeps the small model after the pet has used its own share', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:budget': { day: '2026-10-29', aiCalls: 25 }, 'toko:worked:a': WORKED_A }, '한 일\n- 배포 확인했어요')
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 배포 확인했어요')
})

test('/toko today falls back to each session’s last question once the whole day’s limit is used', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:budget': { day: '2026-10-29', aiCalls: 30 }, 'toko:worked:a': WORKED_A }, '한 일\n- 배포 확인했어요')
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 「A」 배포 봐 줘\n(오늘 작은 모델 한도를 다 써서 세션별 마지막 질문만 보여요)')
})

test('/toko today says the small model did not answer in time when the call comes back unanswered', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:worked:a': WORKED_A }, null)
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 「A」 배포 봐 줘\n(작은 모델이 시간 안에 답하지 못해서 세션별 마지막 질문만 보여요)')
})

test('/toko today says the small model’s reply could not be read when it has no 한 일 lines', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:worked:a': WORKED_A }, '오늘은 배포를 확인했어요')
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 「A」 배포 봐 줘\n(작은 모델 답을 읽지 못해서 세션별 마지막 질문만 보여요)')
})

test('/toko ai 60 raises the day’s limit so /toko today keeps the small model past 30 calls', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET, 'toko:budget': { day: '2026-10-29', aiCalls: 30 }, 'toko:worked:a': WORKED_A }, '한 일\n- 배포 확인했어요')
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'ai 60' } as never)).text).toBe('작은 모델을 하루 60번까지 부를게요. 5번은 직접 부른 일에 남겨 둬요.')
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 배포 확인했어요')
})

test('/toko ai keeps the limit between 10 and 200', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'ai 5' } as never)).text).toBe('예: /toko ai off · 하루 호출 한도는 10~200 사이로 /toko ai 60')
  expect((await $.command.run({ command: 'toko', args: 'ai 500' } as never)).text).toBe('예: /toko ai off · 하루 호출 한도는 10~200 사이로 /toko ai 60')
})

test('looking at sessions, sending to one and writing up the day are counted', async ($, on) => {
  mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET, 'toko:signal:session-3': PEER_A })
  await begin($)
  for (const args of ['sessions', 'sessions a', 'send a 로그 봐 줘', 'send 없음 로그 봐 줘', 'today']) {
    await $.command.run({ command: 'toko', args } as never)
  }
  await $.session.end({ reason: 'other', sessionId: 'session-1', resume: {} } as never)
  expect((world.saved['toko:tally:session-1'] as { counts: Record<string, number> }).counts).toMatchObject({ sessions: 2, send: 1, today: 1 })
})

test('/toko today says nothing is recorded yet on a fresh day', async ($, on) => {
  mock.clock(on, { now: START })
  engine(on, { 'toko:pet': PET })
  await begin($)
  expect((await $.command.run({ command: 'toko', args: 'today' } as never)).text?.split('\n\n')[0]).toBe('10월 29일 (목) 한 일\n- 아직 기록된 일이 없어요')
})

test('a long turn ending sends no OS notification, even with notify on', async ($, on) => {
  const clock = mock.clock(on, { now: START })
  const world = engine(on, { 'toko:pet': PET })
  await begin($)
  await $.command.run({ command: 'toko', args: 'notify on' } as never)
  await runTurn($, clock, 400, 3 * 60_000)
  expect(world.notified).toEqual([])
})
