/**
 * `dsh-plugin-mobile-pair` — print a scannable pairing QR when the Web GUI
 * starts, so the DSH Mobile Android app can pair by scanning instead of typing
 * a host URL and a launch token.
 *
 * The token printed here is the same process token `dsh web` already prints in
 * its `dsh web: …?token=…` line. The plugin never stores it: it appears only as
 * terminal text and in an authenticated `/api/mobile-pair` response addressed to
 * the browser that already holds this process's session.
 *
 * @module dsh-plugin-mobile-pair
 */

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
 * Mount the pairing QR: one terminal print at startup, plus one authenticated
 * route for browsers that pair later.
 * @param ctx - host plugin context carrying `webServer` and `connection`.
 * @param config - resolved plugin config.
 */
/**
 * Normalize the row config. A third-party package must not depend on the
 * harness's internal schema engine, so the three booleans are validated here;
 * an unknown key is ignored rather than failing the whole profile.
 * @param config - raw row config.
 * @returns resolved booleans.
 */
export function resolveOptions(config) {
  const read = (key) => (config && typeof config[key] === 'boolean' ? config[key] : undefined)
  return {
    terminal: read('terminal') ?? true,
    route: read('route') ?? true,
    small: read('small') ?? true,
  }
}

export function apply(ctx, config = {}) {
  const { terminal, route, small } = resolveOptions(config)

  /** The advertised root, preferring the Web surface's own notion of it. */
  const rootUrl = () => ctx.get('webApp')?.getAdvertisedUrl?.() ?? ctx.webServer.getOrigin()

  /** The URL to encode: advertised root plus this process's launch token. */
  const url = () => pairingUrl(rootUrl(), tokenOf(ctx.connection.authenticatedUrl(rootUrl())))

  if (route) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: MOBILE_PAIR_PATH,
      methods: ['GET', 'HEAD'],
      requestBody: 'buffered',
      fetch: async (request) => {
        const target = url()
        const payload = JSON.stringify({ url: target, svg: await svgQr(target) })
        const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
        return request.method === 'HEAD'
          ? new Response(null, { status: 200, headers })
          : new Response(payload, { status: 200, headers })
      },
    }), 'mobile-pair: route')
  }

  if (!terminal) return
  // Print beside the `dsh web:` readiness line: an operator reading it should
  // immediately see the code to scan.
  ctx.effect(() => {
    const target = url()
    void terminalQr(target, small).then((qr) => {
      if (qr === undefined) {
        console.log(`mobile-pair: ${target}`)
        return
      }
      console.log('\nmobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码\n')
      console.log(qr)
      console.log(`mobile-pair: ${target}\n`)
    })
  }, 'mobile-pair: startup print')
}
