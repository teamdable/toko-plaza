const API = 'https://litellm.internal.dable.io/v1/code-deployments'
const DEPLOYMENT_ID = process.env.TOKO_DEPLOYMENT_ID ?? '80b7e434-940b-4432-8678-c3640c5692c0'
const FILES = ['Dockerfile', 'package.json', 'plaza.ts', 'page.html']
const POLL_MS = 15_000
const GIVE_UP_MS = 15 * 60_000

const git = (...args: string[]): { ok: boolean; out: string } => {
  const run = Bun.spawnSync(['git', ...args], { cwd: import.meta.dir, stdout: 'pipe', stderr: 'pipe' })
  return { ok: run.exitCode === 0, out: run.stdout.toString().trim() }
}

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const pat = (process.env.LITELLM_PAT ?? '').trim() || fail('LITELLM_PAT is not set')

const call = async (path: string, init: RequestInit = {}): Promise<Record<string, unknown>> => {
  const response = await fetch(`${API}/${DEPLOYMENT_ID}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${pat}`, 'content-type': 'application/json', ...init.headers },
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return response.ok ? body : fail(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`)
}

if (git('status', '--porcelain', '--', '.').out.length > 0) {
  fail('server/ has uncommitted changes. Commit and push them to origin first.')
}
if (!git('fetch', '-q', 'origin').ok || !git('merge-base', '--is-ancestor', 'HEAD', 'origin/main').ok) {
  fail('HEAD is not on origin/main. Push to origin (teamdable/toko-plaza) first.')
}

const sha = git('rev-parse', '--short', 'HEAD').out
const subject = git('log', '-1', '--format=%s', '--', '.').out
const before = await call('')
if (before.build_status === 'building') {
  fail('A build is already running. Try again when it finishes.')
}

const files = Object.fromEntries(await Promise.all(FILES.map(async name => [name, await Bun.file(`${import.meta.dir}/${name}`).text()] as const)))
await call('/git/commit', { method: 'POST', body: JSON.stringify({ files, message: `${subject} (toko ${sha})` }) })
const build = await call('/build', { method: 'POST' })
const image = String(build.commit_sha ?? '').slice(0, 12)
console.log(`build started for toko ${sha}: ${subject}`)

const isLive = (now: Record<string, unknown>): boolean =>
  now.build_status === 'succeeded' &&
  now.deploy_status === 'running' &&
  String(now.image_uri ?? '').endsWith(`:${image}`) &&
  String(now.deploy_finished_at ?? '') >= String(now.build_finished_at ?? '')

const startedAt = Date.now()
let status = { build: 'building', deploy: '' }
while (Date.now() - startedAt < GIVE_UP_MS) {
  await Bun.sleep(POLL_MS)
  const now = await call('')
  status = { build: String(now.build_status), deploy: String(now.deploy_status) }
  if (status.build === 'failed' || status.deploy === 'failed') {
    fail(`deploy failed: build=${status.build} deploy=${status.deploy}. See ${API}/${DEPLOYMENT_ID}/logs`)
  }
  if (isLive(now)) {
    console.log(`deployed toko ${sha}`)
    process.exit(0)
  }
}
fail(`gave up waiting: build=${status.build} deploy=${status.deploy}`)
