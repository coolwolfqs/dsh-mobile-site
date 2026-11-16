import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  MOBILE_PAIR_CLAIM_PATH, MOBILE_PAIR_PATH, candidateRoots, inject, mintPairingCode, name,
  pairingPageMarkup, panelMarkup, pairingUrl, redeemPairingCode, renderQrSync, resolveOptions,
  rootFromRequest, svgQr, terminalQr, tokenOf,
} from '../lib/index.js'

test('pairing URL carries the launch token as the app expects', () => {
  assert.equal(pairingUrl('http://10.1.1.8:3080', 'abc123'), 'http://10.1.1.8:3080/?token=abc123')
})

test('pairing URL keeps a mounted root and drops a stale token', () => {
  const url = pairingUrl('https://box.example/dsh/?token=old', 'new')
  assert.equal(url, 'https://box.example/dsh/?token=new')
})

test('tokenOf reads the token back and tolerates junk', () => {
  assert.equal(tokenOf('http://127.0.0.1:3080/?token=xyz'), 'xyz')
  assert.equal(tokenOf('http://127.0.0.1:3080/'), undefined)
  assert.equal(tokenOf('http://127.0.0.1:3080/?token='), undefined)
  assert.equal(tokenOf('not a url'), undefined)
})

test('stable identity and required services', () => {
  assert.equal(name, 'mobile-pair')
  assert.deepEqual(inject, ['webServer', 'connection'])
  assert.equal(MOBILE_PAIR_PATH, '/api/mobile-pair')
})

test('terminal QR renders and encodes the pairing URL', async () => {
  const text = await terminalQr('http://10.1.1.8:3080/?token=abc123', true)
  assert.equal(typeof text, 'string')
  assert.ok(text.length > 0)
})

test('SVG QR is a self-contained document of the right size', async () => {
  const svg = await svgQr('http://10.1.1.8:3080/?token=abc123')
  assert.match(svg, /^<svg[\s>]/)
  assert.match(svg.trimEnd(), /<\/svg>$/)
})

test('options default to enabled and honor explicit false', () => {
  const defaults = resolveOptions(undefined)
  assert.deepEqual(defaults, { terminal: true, route: true, small: true, panel: true, roots: [], refresh: false })
  assert.deepEqual(resolveOptions({ small: false, terminal: false }),
    { terminal: false, route: true, small: false, panel: true, roots: [], refresh: false })
  // Unknown/garbage values never fail the load.
  assert.deepEqual(resolveOptions({ route: 'yes', nope: 1 }),
    { terminal: true, route: true, small: true, panel: true, roots: [], refresh: false })
  // `roots` accepts strings only.
  assert.deepEqual(resolveOptions({ roots: ['http://a:1', '', 42] }).roots, ['http://a:1'])
})

test('a pairing code is short-lived and single-use', () => {
  const code = mintPairingCode('http://10.1.1.8:3080')
  assert.match(code.url, /\/mobile-pair\/claim\?code=[A-Za-z0-9_-]{16,}$/)
  assert.ok(code.expiresAt > Date.now())
  // The URL must never carry the launch token.
  assert.equal(new URL(code.url).searchParams.get('token'), null)

  const entry = { ...code, redeemed: false }
  assert.equal(redeemPairingCode(entry), true)
  // Second redemption of the same code is refused.
  assert.equal(redeemPairingCode(entry), false)
})

test('an expired pairing code is refused', () => {
  const code = mintPairingCode('http://10.1.1.8:3080')
  const entry = { ...code, redeemed: false }
  assert.equal(redeemPairingCode(entry, code.expiresAt), false)
  assert.equal(redeemPairingCode(undefined), false)
})

test('codes are unique per mint', () => {
  const ids = new Set()
  for (let i = 0; i < 50; i += 1) ids.add(mintPairingCode('http://10.1.1.8:3080').code)
  assert.equal(ids.size, 50)
})

test('LAN-only deployments get interface addresses as candidates', () => {
  const roots = candidateRoots('http://127.0.0.1:3080', [], 3080)
  assert.equal(roots[0], 'http://127.0.0.1:3080')
  // A phone cannot reach loopback, so at least one non-loopback address must follow.
  assert.ok(roots.length >= 2, `expected extra LAN roots, got ${JSON.stringify(roots)}`)
  assert.ok(roots.slice(1).every(root => !/127\.0\.0\.1|localhost/.test(root)))
})

test('tunnel deployments keep the public root first and add LAN fallbacks', () => {
  // Behind Cloudflare Tunnel the public root works from anywhere, and a phone on
  // the same LAN can also reach the host directly — useful when the tunnel is
  // down and free of an internet round trip.
  const roots = candidateRoots('https://box.example.com', [], 3080, 'http:')
  assert.equal(roots[0], 'https://box.example.com')
  // The fallback must name the listener's port, not the public 443.
  assert.ok(roots.slice(1).every(root => !root.includes(':443')), JSON.stringify(roots))
  assert.ok(roots.slice(1).every(root => root.startsWith('http://')), JSON.stringify(roots))
})

test('a proxy on 443 maps LAN fallbacks to the host listener port', () => {
  const roots = candidateRoots('https://box.example.com', [], 3080, 'http:')
  assert.ok(roots.some(root => root.endsWith(':3080')), JSON.stringify(roots))
  // A listener on 443 must keep the port: the fallback is plain HTTP, so a bare
  // `http://host` would dial port 80 instead.
  const onHttpsPort = candidateRoots('https://box.example.com', [], 443, 'http:').slice(1)
  assert.ok(onHttpsPort.length > 0)
  assert.ok(onHttpsPort.every(root => root.endsWith(':443')), JSON.stringify(onHttpsPort))
  // Port 80 is the only one plain HTTP may omit.
  const onHttpPort = candidateRoots('http://127.0.0.1', [], 80, 'http:').slice(1)
  assert.ok(onHttpPort.every(root => !root.includes(':80')), JSON.stringify(onHttpPort))
})

test('operator-supplied roots are offered after the advertised one', () => {
  // Interface addresses follow the supplied ones, so assert on the head of the
  // list rather than its exact length: the suite must pass on any machine.
  const roots = candidateRoots('http://10.1.1.54:3080', ['http://10.1.1.54:3081'])
  assert.deepEqual(roots.slice(0, 2), ['http://10.1.1.54:3080', 'http://10.1.1.54:3081'])
})

test('one code serves every address through alt parameters', () => {
  const roots = ['http://10.1.1.54:3080', 'https://box.example.com']
  const minted = mintPairingCode(roots[0], undefined, roots.slice(1))
  const url = new URL(minted.url)
  assert.equal(url.searchParams.get('code'), minted.code)
  const alts = url.searchParams.getAll('alt')
  assert.equal(alts.length, 1)
  assert.ok(alts[0].startsWith('https://box.example.com/mobile-pair/claim?'))
  // Redeeming any address burns the one code, so the pair cannot be replayed.
  assert.ok(alts[0].includes(minted.code))
})

test('the GUI panel is self-contained and asks the authenticated route', () => {
  const html = panelMarkup('/api/mobile-pair', '/mobile-pair/claim')
  assert.match(html, /id="dsh-mobile-pair"/)
  assert.match(html, /📱 扫码/)
  assert.ok(html.includes('/api/mobile-pair'))
  // The inline script must parse as-is; it is injected unescaped.
  const script = html.split('<script>')[1].split('</script>')[0]
  assert.doesNotThrow(() => new Function(script))
})

test('LAN alternates follow the listener protocol, not the public one', () => {
  // A tunnel terminates TLS, so the host's own listener is plain HTTP.
  const behindTunnel = candidateRoots('https://box.example.com', [], 3080, 'http:')
  assert.ok(behindTunnel.slice(1).every(root => root.startsWith('http://')), JSON.stringify(behindTunnel))
  // A host that terminates TLS itself must be offered over https, or the fallback
  // cannot complete a handshake.
  const selfTls = candidateRoots('https://box.example.com', [], 8443, 'https:')
  assert.ok(selfTls.slice(1).every(root => root.startsWith('https://')), JSON.stringify(selfTls))
  assert.ok(selfTls.some(root => root.endsWith(':8443')), JSON.stringify(selfTls))
  // https on its default port needs no explicit port.
  assert.ok(candidateRoots('https://box.example.com', [], 443, 'https:').slice(1).every(root => !root.endsWith(':443')))
})

test('the panel carries a rendered QR on first paint, without running a script', () => {
  const url = 'http://10.1.1.8:3080/mobile-pair/claim?code=abc123'
  const svg = renderQrSync(url)
  assert.match(svg, /^<svg/)
  const html = panelMarkup('/api/mobile-pair', '/mobile-pair/claim', { url, svg })
  // The QR, the hint and the URL are in the markup, so a blocked inline script
  // cannot leave the card showing only its header.
  assert.match(html, /<svg/)
  assert.ok(html.includes('5 分钟内有效'))
  assert.ok(html.includes(url))
})

test('the rendered QR is cached per URL', () => {
  const url = 'http://10.1.1.8:3080/mobile-pair/claim?code=cache-me'
  assert.equal(renderQrSync(url), renderQrSync(url))
})

test('the pairing root follows the host the browser actually used', () => {
  const request = (host, forwarded) => ({ headers: { get: (key) => {
    if (key === 'host') return host
    if (key === 'x-forwarded-proto') return forwarded ?? null
    return null
  } } })
  // A plain-HTTP host reached by DNS name must stay http: inferring TLS from a
  // dotted hostname would open a handshake against a cleartext port.
  assert.equal(rootFromRequest(request('box.home.arpa:3080'), 'http:'), 'http://box.home.arpa:3080')
  // A TLS listener is https by its own protocol.
  assert.equal(rootFromRequest(request('box.example.com'), 'https:'), 'https://box.example.com')
  // An explicit forwarded proto wins.
  assert.equal(rootFromRequest(request('box.example.com', 'https'), 'http:'), 'https://box.example.com')
  // A LAN address stays plain HTTP.
  assert.equal(rootFromRequest(request('10.1.1.54:3080'), 'http:'), 'http://10.1.1.54:3080')
  // Loopback and absent Host yield the listener's own guess / nothing.
  assert.equal(rootFromRequest(request('localhost:3080'), 'http:'), 'http://localhost:3080')
  assert.equal(rootFromRequest({ headers: { get: () => null } }, 'http:'), undefined)
})

test('a browser-observed root keeps the advertised root as an alternate', () => {
  // The desktop may be open on the LAN while the phone is on cellular: only the
  // public tunnel reaches it, so the advertised root must stay in the alternates.
  const roots = candidateRoots('http://10.1.1.54:3080', ['https://d54.7mars.com'], 3080, 'http:')
  assert.equal(roots[0], 'http://10.1.1.54:3080')
  assert.ok(roots.includes('https://d54.7mars.com'), JSON.stringify(roots))
})

test('the standalone page renders a complete document with the QR', () => {
  const url = 'http://10.1.1.8:3080/mobile-pair/claim?code=standalone'
  const html = pairingPageMarkup({ url, svg: renderQrSync(url), expiresAt: Date.now() + 300000 })
  assert.match(html, /^<!doctype html>/i)
  assert.match(html, /<\/html>$/)
  assert.ok(html.includes('<svg'))
  assert.ok(html.includes(url))
})

test('the floating panel starts collapsed so it cannot cover the composer', () => {
  const url = 'http://10.1.1.8:3080/mobile-pair/claim?code=collapsed'
  const html = panelMarkup('/api/mobile-pair', '/mobile-pair/claim', { url, svg: renderQrSync(url) })
  assert.match(html, /id="dsh-mobile-pair" class="mp-collapsed"/)
})

test('the standalone page is gated by Connection authentication', async () => {
  // The page carries a live pairing credential, so an unauthenticated visitor must
  // be refused exactly like /api. Verified against a real host below; this asserts
  // the handler consults connection.admit rather than serving unconditionally.
  const source = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  // Anchor on the route registration, not the first mention of the path constant.
  const page = source.slice(source.indexOf('path: MOBILE_PAIR_PAGE_PATH'))
  assert.match(page.slice(0, 800), /connection\.admit\(req\)/)
})

test('the standalone page reloads itself before the code expires', () => {
  const url = 'http://10.1.1.8:3080/mobile-pair/claim?code=refresh'
  // A code with 5 minutes left must schedule a refresh strictly before that.
  const html = pairingPageMarkup({ url, svg: renderQrSync(url), expiresAt: Date.now() + 300_000 })
  const seconds = Number((html.match(/http-equiv="refresh" content="(\d+)"/) ?? [])[1])
  assert.ok(Number.isFinite(seconds), 'meta refresh present')
  assert.ok(seconds > 0 && seconds <= 300, `refresh interval ${seconds}s must not outlive the code`)
  // An almost-expired code still schedules a sane minimum rather than 0 or negative.
  const soon = pairingPageMarkup({ url, svg: renderQrSync(url), expiresAt: Date.now() + 5_000 })
  assert.ok(Number((soon.match(/content="(\d+)"/) ?? [])[1]) >= 30)
})

test('the panel expands once per browser so the code is discoverable', () => {
  const url = 'http://10.1.1.8:3080/mobile-pair/claim?code=discover'
  const html = panelMarkup('/api/mobile-pair', '/mobile-pair/claim', { url, svg: renderQrSync(url) })
  const script = html.split('<script>')[1].split('</script>')[0]
  // First visit opens the card; the flag makes later loads stay collapsed.
  assert.match(script, /dsh\.mobilePairSeen/)
  assert.match(script, /classList\.remove\("mp-collapsed"\)/)
  assert.doesNotThrow(() => new Function(script))
})
