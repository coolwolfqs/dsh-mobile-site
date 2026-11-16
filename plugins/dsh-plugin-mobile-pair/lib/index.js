/**
 * `dsh-plugin-mobile-pair` — print a scannable pairing QR when the Web GUI
 * starts, so the DSH Mobile Android app pairs by scanning instead of typing a
 * host URL and a launch token.
 *
 * Where the QR appears: printed in the launching terminal AND shown in a floating
 * panel inside the Web GUI, so pairing never requires leaving the interface you
 * are already using.
 *
 * The QR deliberately does NOT carry the process launch token. It carries a
 * single-use code that expires in five minutes, following the pattern browsers
 * and messengers use for device pairing (WhatsApp Web, Signal, Home Assistant):
 * a screenshot of the terminal is not a durable credential, and redeeming a code
 * once burns it. The launch token stays on the host, where the claim route uses
 * it to issue the same session cookie a token-bearing link would.
 *
 * @module dsh-plugin-mobile-pair
 */

import { randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import QRCode from 'qrcode'

/** Stable Cordis plugin name. */
export const name = 'mobile-pair'

/**
 * Services required before this plugin mounts. A profile that serves no browser
 * surface has neither a `webServer` nor a `connection`, and so no token to show.
 */
export const inject = ['webServer', 'connection']

/** Authenticated path that returns the pairing QR as JSON. */
export const MOBILE_PAIR_PATH = '/api/mobile-pair'

/** Unauthenticated path a scanned code is redeemed at (the code is the credential). */
export const MOBILE_PAIR_CLAIM_PATH = '/mobile-pair/claim'

/**
 * Standalone pairing page.
 *
 * The Web GUI is not the only surface that renders the harness: the desktop app
 * loads the frontend bundle itself and never sees `webServer`'s index transform,
 * so an injected panel cannot appear there. This page is served by the host, so
 * any surface with a browser — including the desktop app's own webview — can open
 * `<host>/mobile-pair` and see the same QR.
 */
export const MOBILE_PAIR_PAGE_PATH = '/mobile-pair'

/**
 * The pairing URL the mobile app expects: the advertised Web GUI root carrying
 * this process's launch token as its `token` query parameter.
 * @param root - clean advertised root, for example `http://10.1.1.8:3080`.
 * @param token - this process's launch token.
 * @returns the URL to encode in the QR.
 */
export function pairingUrl(root, token) {
  const url = new URL(root)
  if (token) url.searchParams.set('token', token)
  return url.href
}

/**
 * Extract the launch token from a URL produced by `connection.authenticatedUrl`.
 * @param authenticated - authenticated GUI URL.
 * @returns the token, or `undefined` when the URL carries none.
 */
export function tokenOf(authenticated) {
  try {
    const token = new URL(authenticated).searchParams.get('token')
    return token === null || token === '' ? undefined : token
  } catch {
    return undefined
  }
}

/**
 * Render a terminal QR. Returns `undefined` when the encoder is unavailable, so
 * the caller can degrade to printing the plain URL instead of failing boot.
 * @param text - text to encode.
 * @param small - half-block rendering.
 * @returns printable QR text, or `undefined`.
 */
export async function terminalQr(text, small) {
  try {
    return await QRCode.toString(text, { type: 'terminal', small, errorCorrectionLevel: 'M', margin: 1 })
  } catch {
    return undefined
  }
}

/**
 * Render a standalone SVG QR for the authenticated route.
 * @param text - text to encode.
 * @returns SVG document text.
 */
export async function svgQr(text) {
  return await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
}

/**
 * The root a browser actually reached this host through, from its own request.
 * @param request - the authenticated `/api/mobile-pair` request.
 * @returns `scheme//host`, or undefined when the request carries no usable Host.
 */
export function rootFromRequest(request, listenerProtocol = 'http:') {
  const raw = request?.headers?.get?.('host')
  if (!raw) return undefined
  try {
    // A proxy that terminates TLS reports it in X-Forwarded-Proto; without one the
    // listener's own protocol is the best evidence (a tunnel still forwards Host
    // but the phone reached it over https, so guessing http here yields a QR the
    // phone refuses).
    // Only real evidence may claim TLS: an explicit forwarded proto, or a listener
    // that terminates TLS itself. Inferring https from a dotted hostname breaks a
    // plain-HTTP host reached by DNS name (a TLS handshake against a cleartext port).
    const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const scheme = forwarded === 'https' || forwarded === 'http'
      ? `${forwarded}:`
      : listenerProtocol === 'https:' ? 'https:'
      : 'http:'
    const url = new URL(`${scheme}//${raw}`)
    return url.origin
  } catch {
    return undefined
  }
}

/**
 * Full-page markup for the standalone pairing page.
 *
 * Kept deliberately small and dependency-free so it renders on any surface,
 * including the desktop app's own webview and a phone's in-app browser.
 * @param code - the live pairing code and its pre-rendered SVG.
 * @returns a complete HTML document.
 */
export function pairingPageMarkup(code) {
  const expires = new Date(code.expiresAt).toLocaleTimeString()
  return [
    '<!doctype html><html lang="zh-CN"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    // Reload a few seconds before expiry: a page left open must not keep showing a
    // code that can no longer be redeemed.
    `<meta http-equiv="refresh" content="${Math.max(30, Math.round((code.expiresAt - Date.now()) / 1000) - 10)}">`,
    '<title>扫码连接 DSH Mobile</title>',
    '<style>',
    'html,body{margin:0;height:100%;background:#14151a;color:#e8eaf0;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.wrap{min-height:100%;display:grid;place-items:center;padding:32px 20px}',
    '.card{display:grid;gap:16px;justify-items:center;max-width:420px;text-align:center}',
    'h1{margin:0;font-size:19px;font-weight:600}',
    '.qr{background:#fff;border-radius:16px;padding:14px;display:grid;place-items:center}',
    '.qr svg{display:block;width:min(64vw,300px);height:auto}',
    '.hint{color:#8d93a3;font-size:13px;margin:0}',
    'code{font:11.5px/1.4 ui-monospace,Menlo,monospace;color:#8d93a3;word-break:break-all;max-width:100%}',
    '</style></head><body><div class="wrap"><div class="card">',
    '<h1>📱 用 DSH Mobile 扫码连接</h1>',
    '<div class="qr">', code.svg || '<p>二维码生成失败，请刷新</p>', '</div>',
    '<p class="hint">配对码 5 分钟内有效，扫一次即失效；本页会在到期前自动换新。</p>',
    '<code>', escapeHtml(code.url), '</code>',
    '<p class="hint">生成时间对应的本地时间：', escapeHtml(expires), ' 到期</p>',
    '</div></div></body></html>',
  ].join('')
}

/**
 * Synchronous SVG QR for the server-rendered panel.
 *
 * `qrcode`'s SVG builder is synchronous underneath its promise API, so the same
 * text can be rendered here without awaiting. The result is cached per URL
 * because the panel re-renders on every index request.
 */
const qrCache = new Map()

export function renderQrSync(text) {
  const cached = qrCache.get(text)
  if (cached !== undefined) return cached
  let svg = ''
  try {
    // `qrToSvg` is the callback form of the same renderer `svgQr` awaits.
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 }, (cause, value) => {
      if (!cause && typeof value === 'string') svg = value
    })
  } catch { svg = '' }
  if (qrCache.size > 32) qrCache.clear()
  if (svg) qrCache.set(text, svg)
  return svg
}

/**
 * Normalize the row config. A third-party package must not depend on the
 * harness's internal schema engine, so the three booleans are validated here;
 * an unknown key is ignored rather than failing the whole profile.
 * @param config - raw row config.
 * @returns resolved booleans.
 */
export function resolveOptions(config) {
  const read = (key) => (config && typeof config[key] === 'boolean' ? config[key] : undefined)
  const readList = (key) => (Array.isArray(config?.[key]) ? config[key].filter((value) => typeof value === 'string' && value.trim() !== '') : [])
  return {
    terminal: read('terminal') ?? true,
    route: read('route') ?? true,
    small: read('small') ?? true,
    // The in-GUI panel is on by default: it is the path that needs no terminal.
    panel: read('panel') ?? true,
    // Extra roots (another port, a second hostname) offered alongside the
    // advertised one; empty means "derive from the advertised root".
    roots: readList('roots'),
    // Re-print a fresh QR in the terminal shortly before the printed one expires,
    // so a long-lived `dsh web` keeps a scannable code on screen. Off by default:
    // a supervisor log would otherwise collect codes forever.
    refresh: read('refresh') ?? false,
  }
}

/**
 * Every base URL a phone might reach this host on, most-likely first.
 *
 * Two deployment shapes matter and they need different addresses:
 *
 * - **LAN-only** (no reverse proxy): the phone reaches the host at one of its own
 *   IPv4 addresses, so each local interface becomes a candidate the phone can
 *   fall back to when the first one does not answer.
 * - **Behind a tunnel or reverse proxy** (Cloudflare Tunnel, nginx, …): the phone
 *   reaches the host through the public root, and none of the local addresses are
 *   reachable, so the advertised root must be the only candidate offered.
 *
 * The advertised root always comes first. `extraRoots` lets an operator name more
 * (another port, a second hostname). Interface addresses are appended only when
 * the advertised root is loopback, which is the LAN-only case.
 * @param advertised - the root this process advertises.
 * @param extraRoots - operator-supplied roots to offer as well.
 * @returns candidate roots, deduplicated, advertised first.
 */
export function candidateRoots(advertised, extraRoots = [], listenPort, listenProtocol = 'http:') {
  const roots = []
  const add = (value) => {
    if (!value) return
    try {
      const url = new URL(value)
      const root = url.origin + (url.pathname === '/' ? '' : url.pathname.replace(/\/$/, ''))
      if (!roots.includes(root)) roots.push(root)
    } catch { /* not a URL: skip */ }
  }
  add(advertised)
  for (const root of extraRoots) add(root)
  // Local interface addresses are always offered as alternates, in every
  // deployment shape:
  //   - LAN-only: they are the ONLY reachable addresses (loopback is not).
  //   - Behind a tunnel/proxy: the public root works from anywhere, but a phone
  //     on the same LAN reaches the host directly, which keeps working when the
  //     tunnel is down and avoids a round trip through the internet.
  // The advertised root stays first; the app falls back to these in order.
  // The alternate speaks whatever the host's OWN listener speaks: plain HTTP when
  // TLS ends at a tunnel or proxy, HTTPS when the host terminates TLS itself
  // (`--tls-cert` / `--tls-key`). Assuming a tunnel would send an https host an
  // http request that cannot pair.
  const scheme = listenProtocol === 'https:' ? 'https:' : 'http:'
  // It must also name the port the HOST listens on, not the port in the public
  // URL: behind a tunnel those differ (public 443 → host 3080), and the public
  // port would produce an address that refuses connections.
  const defaultPort = scheme === 'https:' ? 443 : 80
  let port = ''
  if (typeof listenPort === 'number' && Number.isInteger(listenPort)) {
    // Only the scheme's own default port may be omitted.
    port = listenPort === defaultPort ? '' : `:${listenPort}`
  } else {
    try {
      const advertisedUrl = new URL(advertised)
      port = advertisedUrl.port ? `:${advertisedUrl.port}` : ''
    } catch { /* unparsable advertised root: no port to mirror */ }
  }
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue
      add(`${scheme}//${address.address}${port}`)
    }
  }
  return roots
}

/**
 * The floating pairing panel injected into the Web GUI.
 *
 * The QR belongs where the person already is. Typing `dsh web` in a terminal is
 * one place; a browser tab showing the GUI is another, and someone pairing their
 * phone usually has the GUI open. The panel is plain markup plus one inline
 * script: it polls the authenticated `/api/mobile-pair` route, so it needs no
 * build step and no client plugin.
 * @param apiPath - authenticated route that returns the current code.
 * @param claimPath - route a scanned code is redeemed at, for the shown link.
 * @returns markup fragment for the body.
 */
/** Escape text for HTML text/attribute context. */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function panelMarkup(apiPath, claimPath, initial = null) {
  // A template literal cannot host the injected script: its `${}` interpolations
  // and backticks would collide with the generated JavaScript. Plain strings keep
  // the browser script and the server code apart.
  const style = [
    '#dsh-mobile-pair{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e8eaf0}',
    '#dsh-mobile-pair .mp-card{background:#1b1c22;border:1px solid #34363f;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.38);padding:14px;width:248px;display:grid;gap:10px}',
    '#dsh-mobile-pair .mp-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '#dsh-mobile-pair .mp-title{font-weight:600;font-size:13px}',
    '#dsh-mobile-pair button{all:unset;cursor:pointer;border-radius:8px;padding:2px 7px;color:#aab0c0;font-size:12px}',
    '#dsh-mobile-pair button:hover{color:#fff;background:#2b2d36}',
    '#dsh-mobile-pair .mp-qr{background:#fff;border-radius:10px;padding:8px;display:grid;place-items:center;min-height:150px}',
    '#dsh-mobile-pair .mp-qr svg{display:block;width:200px;height:200px}',
    '#dsh-mobile-pair .mp-hint{color:#8d93a3;font-size:11.5px}',
    '#dsh-mobile-pair .mp-url{font:11px/1.4 ui-monospace,Menlo,monospace;color:#8d93a3;word-break:break-all;max-height:52px;overflow:auto}',
    '#dsh-mobile-pair.mp-collapsed{right:12px;bottom:12px}',
    '#dsh-mobile-pair.mp-collapsed .mp-card{width:auto;padding:6px 10px;gap:0;background:rgba(27,28,34,.92);backdrop-filter:blur(6px)}',
    '#dsh-mobile-pair.mp-collapsed .mp-qr,#dsh-mobile-pair.mp-collapsed .mp-hint,#dsh-mobile-pair.mp-collapsed .mp-url{display:none}',
    '#dsh-mobile-pair .mp-pill{display:none}',
    '#dsh-mobile-pair.mp-collapsed .mp-pill{display:inline}',
    '@media (max-width:640px){#dsh-mobile-pair{right:10px;bottom:76px}#dsh-mobile-pair .mp-card{width:216px}}',
  ].join('')
  const script = [
    '(function(){',
    "var root=document.getElementById('dsh-mobile-pair'); if(!root) return;",
    "var qr=root.querySelector('.mp-qr'), url=root.querySelector('.mp-url'), toggle=root.querySelector('.mp-toggle');",
    // Matches the initial `mp-collapsed` class: the first click must expand.
    "var endpoint=", JSON.stringify(apiPath), ", timer=null, collapsed=true;",
    'function paint(data){',
    '  if(!data||!data.url||typeof data.svg!=="string") return;',
    '  if(qr.dataset.url===data.url) return;',
    '  qr.innerHTML=data.svg; qr.dataset.url=data.url;',
    '  url.textContent=data.url;',
    '}',
    'function load(){',
    '  fetch(endpoint,{credentials:"same-origin",headers:{accept:"application/json"}})',
    '    .then(function(r){ return r.ok?r.json():null })',
    '    .then(paint)',
    '    .catch(function(){});',
    '}',
    'function schedule(){ if(timer) clearInterval(timer); timer=setInterval(load, 90000) }',
    'toggle.addEventListener("click",function(){',
    '  collapsed=!collapsed;',
    '  root.classList.toggle("mp-collapsed",collapsed);',
    '  toggle.textContent=collapsed?"＋":"—";',
    '  if(!collapsed) load();',
    '});',
    // Show the code once per browser: a permanently collapsed pill is easy to
    // miss, and the first visit is exactly when the person needs to pair.
    'try{ if(!localStorage.getItem("dsh.mobilePairSeen")){',
    '  root.classList.remove("mp-collapsed"); collapsed=false; toggle.textContent="—";',
    '  localStorage.setItem("dsh.mobilePairSeen","1");',
    '} }catch(e){}',
    'load(); schedule();',
    'document.addEventListener("visibilitychange",function(){ if(!document.hidden){ load(); schedule() } });',
    '})();',
  ].join('')
  return [
    '<style>', style, '</style>',
    // Collapsed by default: an open QR card would cover the message composer on
    // a conversation screen. The pill is small and out of the way.
    '<div id="dsh-mobile-pair" class="mp-collapsed">',
    '<div class="mp-card">',
    '<div class="mp-head"><span class="mp-title">📱 扫码</span><button type="button" class="mp-toggle" title="收起/展开">＋</button></div>',
    // The code is rendered on the server: the panel is complete on first paint and
    // does not depend on an inline script running (or on a fetch succeeding) to
    // show anything at all.
    '<div class="mp-qr"', initial && initial.url ? ` data-url="${escapeHtml(initial.url)}"` : '', '>',
    initial && initial.svg ? initial.svg : '<span class="mp-pill">二维码加载中…</span>', '</div>',
    '<div class="mp-hint">用 DSH Mobile 的「扫码配对」扫描，5 分钟内有效、只能扫一次。</div>',
    '<div class="mp-url">', initial && initial.url ? escapeHtml(initial.url) : '', '</div>',
    '</div>',
    '</div>',
    '<script>', script, '</script>',
  ].join('')
}

/**
 * One short-lived pairing code: what the QR carries instead of the launch token.
 *
 * Industry pattern (WhatsApp Web, Signal, Home Assistant): the displayed code is
 * single-use and expires in minutes, and the long-lived credential never leaves
 * the host. A screenshot of the terminal is therefore worthless after
 * {@link PAIRING_CODE_TTL_MS}, and redeeming it once burns it.
 */
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000

/** How long an idle code stays valid before the next request mints a fresh one. */
const PAIRING_CODE_IDLE_REFRESH_MS = 60 * 1000

/**
 * Mint a pairing code: a single-use redemption URL that exchanges for the same
 * cookie a launch-token link would issue, without exposing the token.
 * @param root - advertised root, for example `http://10.1.1.8:3080`.
 * @param createId - entropy source for the code identifier.
 * @returns the code and its expiry.
 */
export function mintPairingCode(root, createId = defaultCodeId, alternates = []) {
  const code = createId()
  const expiresAt = Date.now() + PAIRING_CODE_TTL_MS
  const url = new URL(MOBILE_PAIR_CLAIM_PATH, root)
  url.searchParams.set('code', code)
  // One code, several reachable addresses: the app tries them in order, so the
  // same QR pairs on the LAN and through a tunnel without the person choosing.
  for (const alternate of alternates) {
    if (alternate === root) continue
    const alt = new URL(MOBILE_PAIR_CLAIM_PATH, alternate)
    alt.searchParams.set('code', code)
    url.searchParams.append('alt', alt.href)
  }
  return { code, url: url.href, expiresAt }
}

/** 128 bits of URL-safe entropy for one pairing code. */
function defaultCodeId() {
  return randomBytes(16).toString('base64url')
}

/**
 * Redeem one pairing code.
 * @param entry - the live code entry.
 * @param now - current epoch milliseconds.
 * @returns true when this call consumed the code.
 */
export function redeemPairingCode(entry, now = Date.now()) {
  if (!entry || entry.redeemed || now >= entry.expiresAt) return false
  entry.redeemed = true
  return true
}

/**
 * Mount the pairing code: a single-use QR, a claim page that exchanges the code
 * for a session cookie, and an authenticated route for the desktop GUI.
 * @param ctx - host plugin context carrying `webServer` and `connection`.
 * @param config - resolved plugin config.
 */
export function apply(ctx, config = {}) {
  const { terminal, route, small, panel, roots: extraRoots, refresh } = resolveOptions(config)

  /** The advertised root, preferring the Web surface's own notion of it. */
  const advertisedRoot = () => ctx.get('webApp')?.getAdvertisedUrl?.() ?? ctx.webServer.getOrigin()

  /**
   * Every root a phone might use, advertised first.
   *
   * LAN-only deployments get the host's interface addresses appended, because a
   * phone cannot reach 127.0.0.1; tunnel/reverse-proxy deployments keep the public
   * root alone, because local addresses are unreachable from the phone there.
   */
  const roots = () => candidateRoots(advertisedRoot(), extraRoots, ctx.webServer.port, ctx.webServer.protocol)

  /** The advertised root, kept for the loopback cookie exchange. */
  const rootUrl = advertisedRoot

  /** The process token stays on the host: only a redemption code is published. */
  const launchToken = () => tokenOf(ctx.connection.authenticatedUrl(rootUrl()))

  /** Codes minted by this process, keyed by their identifier. */
  const codes = new Map()

  const prune = (now) => {
    for (const [id, entry] of codes) {
      if (entry.redeemed || now >= entry.expiresAt) codes.delete(id)
    }
  }

  /**
   * The live codes, one per candidate root, minted on demand.
   *
   * Each root gets its own code so a phone that scans the LAN address and one that
   * scans the tunnel address both redeem against the authority they can reach.
   */
  let currentCode = null
  let currentRootList = []

  /**
   * The live code.
   *
   * ONE code serves every reachable address: its URL names the first candidate and
   * carries the rest as `alt` parameters. That keeps the QR small (a tunnel URL
   * plus a LAN URL already approaches what a phone camera reads comfortably) while
   * still letting a phone that cannot reach the public address redeem on the LAN.
   */
  const liveCode = (observedRoot) => {
    const now = Date.now()
    // A browser-observed root takes precedence over the advertised one, because it
    // is the address that provably works for this request. The advertised root is
    // still offered as an alternate: a phone on cellular may only reach the public
    // tunnel, which the desktop's LAN address cannot serve.
    const wanted = observedRoot
      ? candidateRoots(observedRoot, [advertisedRoot(), ...extraRoots], ctx.webServer.port, ctx.webServer.protocol)
      : roots()
    const unchanged = currentRootList.length === wanted.length
      && wanted.every((root, index) => currentRootList[index] === root)
    if (currentCode && unchanged && !currentCode.redeemed && now < currentCode.expiresAt - PAIRING_CODE_IDLE_REFRESH_MS) {
      return currentCode
    }
    prune(now)
    const [primary, ...alternates] = wanted
    const entry = mintPairingCode(primary ?? rootUrl(), defaultCodeId, alternates)
    codes.set(entry.code, entry)
    currentCode = entry
    currentRootList = wanted
    return entry
  }

  /** Absolute URL of the standalone pairing page, for operator guidance. */
  const pageUrl = () => {
    try {
      return new URL(MOBILE_PAIR_PAGE_PATH, advertisedRoot()).href
    } catch {
      return MOBILE_PAIR_PAGE_PATH
    }
  }

  if (route) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: MOBILE_PAIR_PATH,
      methods: ['GET', 'HEAD'],
      requestBody: 'buffered',
      fetch: async (request) => {
        // The request's own Host is the authority this browser actually reached the
        // host through (a tunnel domain, a LAN IP, a proxy). It beats the advertised
        // root, which is 127.0.0.1 when the operator did not pass --public-url.
        const observedRoot = rootFromRequest(request, ctx.webServer.protocol)
        const code = liveCode(observedRoot)
        const url = new URL(code.url)
        // The primary URL plus every `alt` address, each with its own QR so the GUI
        // can show the one the phone can actually reach.
        const candidates = [url.href, ...url.searchParams.getAll('alt')]
        const payload = JSON.stringify({
          url: code.url,
          expiresAt: code.expiresAt,
          ttlSeconds: Math.round(PAIRING_CODE_TTL_MS / 1000),
          svg: await svgQr(code.url),
          candidates: await Promise.all(candidates.map(async (candidate) => ({
            url: candidate,
            svg: candidate === code.url ? undefined : await svgQr(candidate),
          }))),
        })
        const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
        return request.method === 'HEAD'
          ? new Response(null, { status: 200, headers })
          : new Response(payload, { status: 200, headers })
      },
    }), 'mobile-pair: route')
  }

  /**
   * Redeem a scanned code for a session cookie.
   *
   * The exchange happens on the host itself: this handler calls the loopback
   * `/connect` endpoint with the launch token it holds in memory and forwards the
   * resulting cookie to the phone. The token therefore never travels to the
   * device, and the phone only ever holds an ordinary session cookie.
   */
  const claim = (code, res) => {
    const now = Date.now()
    prune(now)
    const entry = codes.get(code)
    if (!redeemPairingCode(entry, now)) {
      // One generic answer: a wrong code and an expired one are indistinguishable.
      res.writeHead(410, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('配对码无效或已过期，请在主机终端重新获取二维码。')
      return
    }
    const token = launchToken()
    if (!token) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('主机没有可用的启动 token。')
      return
    }
    // Present the advertised authority so Connection's Host fence accepts the
    // loopback call exactly as it would accept the phone's own request.
    const advertised = new URL(rootUrl())
    const secure = ctx.webServer.protocol === 'https:'
    const send = secure ? httpsRequest : httpRequest
    const exchange = send({
      host: ctx.webServer.host,
      port: ctx.webServer.port,
      path: `/connect?token=${encodeURIComponent(token)}`,
      method: 'GET',
      headers: { host: advertised.host, accept: 'text/html' },
      ...(secure ? { rejectUnauthorized: false } : {}),
    }, (answer) => {
      const cookies = answer.headers['set-cookie']
      const cookie = Array.isArray(cookies) ? cookies[0] : cookies
      answer.resume()
      if (typeof cookie !== 'string' || (answer.statusCode !== 302 && answer.statusCode !== 303)) {
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        res.end('主机未能签发会话，请重试。')
        return
      }
      res.writeHead(302, {
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
        location: './',
        'set-cookie': cookie,
      })
      res.end()
    })
    exchange.on('error', () => {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('主机内部交换失败，请重试。')
    })
    exchange.end()
  }

  // Always registered when a QR is printed: the claim route is the only way a
  // scanned code becomes a session, so it must not follow the optional
  // informational `/api` flag.
  ctx.effect(() => {
    const registered = ctx.webServer.register({
      kind: 'exact',
      path: MOBILE_PAIR_CLAIM_PATH,
      handler: (req, res) => {
        const url = new URL(req.url ?? '/', 'http://dsh.invalid')
        const code = url.searchParams.get('code') ?? ''
        claim(code, res)
      },
    })
    return registered
  }, 'mobile-pair: claim route')

  if (panel) {
    // The panel lands in the GUI itself, which is where a person pairing a phone
    // usually already is: no terminal, no second application.
    ctx.effect(() => {
      // tapIndex is synchronous, so the code is minted once per transform. Rendering
      // it here (rather than in the page's script) is what makes the panel complete
      // on first paint.
      const off = ctx.webServer.tapIndex((html) => {
        const code = liveCode()
        const svg = renderQrSync(code.url)
        const markup = panelMarkup(MOBILE_PAIR_PATH, MOBILE_PAIR_CLAIM_PATH, { url: code.url, svg })
        const at = html.lastIndexOf('</body>')
        return at === -1 ? html + markup : html.slice(0, at) + markup + html.slice(at)
      })
      return off
    }, 'mobile-pair: gui panel')
  }

  /**
   * Standalone page route: the same QR for surfaces that never render the host's
   * index (the desktop app) and for a plain browser tab.
   */
  ctx.effect(() => {
    const registered = ctx.webServer.register({
      kind: 'exact',
      path: MOBILE_PAIR_PAGE_PATH,
      handler: (req, res) => {
        // This page carries a live pairing credential, so it must sit behind the
        // same authentication fence as `/api`. Anonymous access would let anyone
        // reaching the host over the LAN or a tunnel read the code and redeem it
        // for a session cookie.
        const admission = ctx.connection.admit(req)
        if ('rejection' in admission) {
          const status = admission.rejection
          res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
          res.end(status === 401 ? 'unauthorized' : 'forbidden')
          return
        }
        const code = liveCode(rootFromRequest({
          headers: { get: (key) => req.headers[key.toLowerCase()] ?? null },
        }, ctx.webServer.protocol))
        const svg = renderQrSync(code.url)
        const html = pairingPageMarkup({ url: code.url, svg, expiresAt: code.expiresAt })
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'referrer-policy': 'no-referrer',
        })
        res.end(html)
      },
    })
    return registered
  }, 'mobile-pair: standalone page')

  if (!terminal) return
  // Print beside the `dsh web:` readiness line. The QR carries a five-minute
  // single-use code, so a screenshot of this terminal is not a credential.
  ctx.effect(() => {
    let timer = null
    let disposed = false
    const print = async (first) => {
      const code = liveCode()
      const qr = await terminalQr(code.url, small)
      if (disposed) return
      if (qr === undefined) {
        console.log(`mobile-pair: ${code.url}`)
      } else {
        console.log(first
          ? '\nmobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码（5 分钟内有效，用一次即失效）\n'
          : '\nmobile-pair: 上一个二维码即将过期，这是新的（同样 5 分钟、用一次即失效）\n')
        console.log(qr)
        console.log(`mobile-pair: ${code.url}`)
        if (first) {
          // The terminal cannot be redrawn cheaply, so tell the operator where a
          // fresh code lives once this one expires.
          // The page sits behind the same authentication fence as /api, so someone
          // who never opened the GUI in a browser would land on 401. Name the
          // authenticated entry point first, then the no-browser alternative.
          console.log('mobile-pair: 过期后取新码的两种方式：')
          console.log(`mobile-pair:   1) 在已登录 DSH 的浏览器里打开 ${pageUrl()}`)
          console.log(`mobile-pair:      还没登录过就先打开 ${rootUrl()} 用启动日志里的 ?token= 链接登录一次`)
          console.log('mobile-pair:   2) 在插件 config 里设置 refresh: true，过期前这里会自动打印新码')
          if (refresh) console.log('mobile-pair: 已开启自动重印（refresh: true），过期前这里会打印新码')
          console.log('')
        }
      }
      if (!refresh) return
      // Reprint shortly before expiry so an unattended terminal keeps a live code.
      const wait = Math.max(30_000, code.expiresAt - Date.now() - PAIRING_CODE_IDLE_REFRESH_MS)
      timer = setTimeout(() => { void print(false) }, wait)
    }
    void print(true)
    return () => { disposed = true; if (timer) clearTimeout(timer) }
  }, 'mobile-pair: startup print')
}
