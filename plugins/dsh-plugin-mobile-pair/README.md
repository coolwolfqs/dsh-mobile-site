# dsh-plugin-mobile-pair

Print a scannable pairing QR when the DeepSeek Harness Web GUI starts, so the
DSH Mobile (Android) app pairs by scanning instead of typing a host URL and a
launch token.

## Where the QR appears

Three places, so no surface is left without one:

1. **The terminal that started `dsh web`** — printed next to the `dsh web:` line.
2. **Inside the Web GUI** — a small "📱 扫码" pill in the bottom right that opens
   into the code. It expands once on the first visit (so it is discoverable) and
   stays collapsed afterwards, so it never covers the message composer.
3. **A standalone page at `/mobile-pair`** — the full QR in any browser. This is
   the path for the **desktop app**, whose webview loads the frontend bundle
   itself and therefore never sees the host's index injection.

```
mobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码（5 分钟内有效，用一次即失效）
mobile-pair: http://192.168.1.10:3080/mobile-pair/claim?code=…
```

The encoded URL is a **single-use pairing code**, not the launch token: it expires
in five minutes and can be redeemed once. The host exchanges it for a session
cookie on its own loopback interface, so the launch token never reaches the phone
and a screenshot of the terminal is not a durable credential.

## Expiry behaviour

A printed code is only valid for five minutes, so the surfaces handle expiry for
you:

- **Terminal** — the printout names both ways to get a fresh code: open
  `<host>/mobile-pair` in a browser that has already signed in to the GUI (first
  open `<host>` with the `?token=` link from the startup log), or set
  `refresh: true` to have it print a new one automatically before each expiry.
  Leave `refresh` off when `dsh web` runs under a supervisor that keeps a log.
- **Web GUI panel** — polls the authenticated route and swaps in the new code.
- **`/mobile-pair` page** — reloads itself shortly before the code expires, so a
  page left open never shows a dead code.

## Network shapes

The same plugin covers a LAN-only host and a host behind Cloudflare Tunnel or a
reverse proxy. The QR's primary address follows the advertised root, and local
interface addresses are appended as `alt` fallbacks that reuse the same code:

| Deployment | Primary address | Fallbacks |
|---|---|---|
| LAN only | the host's interface address | other interface addresses |
| Tunnel / proxy (`--public-url https://…`) | the public root | the host's LAN address on its listener port |
| Both (extra hostnames/ports) | advertised root | `config.roots` |

The app tries them in order and only falls back on a transport failure (refused,
timeout, DNS); a rejected code (410) stops immediately.

## Install (one line)

```sh
curl -fsSL https://coolwolfqs.github.io/dsh-mobile-site/install-pair.sh | sh
```

That is the whole setup: it installs this plugin into your `web` profile from the
latest release. Restart `dsh web` and the startup terminal prints the pairing QR
beside the usual `dsh web: …?token=…` line.

Other ways, if you need them:

```sh
# explicit profile / version
DSH_PAIR_PROFILE=tui sh -c 'curl -fsSL https://coolwolfqs.github.io/dsh-mobile-site/install-pair.sh | sh'

# install the release tarball yourself
dsh plugin --profile web add \
  https://github.com/coolwolfqs/dsh-mobile-site/releases/download/v1.0.56/dsh-plugin-mobile-pair-0.1.0.tgz

# from a checkout of this repository
dsh plugin --profile web add link:$(pwd)

# from the plugin index: DSH → Plugins → Discover → add index source
#   https://coolwolfqs.github.io/dsh-mobile-site/market/index.json
```

Remove it the same way: `dsh plugin --profile web remove dsh-plugin-mobile-pair`.

## The authenticated route

`GET /api/mobile-pair` returns the same payload to the browser that already holds
this process's session — useful for the desktop GUI to show the code too:

```json
{ "url": "http://192.168.1.10:3080/?token=…", "svg": "<svg …></svg>" }
```

An unauthenticated request is rejected (401) by the Connection fence before any
token is serialized.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `terminal` | `true` | Print the QR in the launching terminal |
| `route` | `true` | Serve `GET /api/mobile-pair` |
| `small` | `true` | Half-block rendering, which fits narrow terminals |
| `panel` | `true` | Show the floating QR panel inside the Web GUI |
| `roots` | `[]` | Extra base URLs to offer as fallbacks (another port or hostname) |
| `refresh` | `false` | Re-print a fresh terminal QR shortly before the printed one expires |

```yaml
- id: mobile-pair
  name: dsh-plugin-mobile-pair
  config:
    small: false   # larger code, scannable from further away
```

## Token handling

The launch token never leaves the host. A scanned code is redeemed at
`/mobile-pair/claim?code=…`, where this plugin calls the host's own `/connect`
endpoint over loopback, receives the session cookie, and forwards it to the
phone. The phone holds an ordinary revocable session cookie; the QR holds a
five-minute single-use code.

This follows the pattern messengers and browsers use for device pairing
(WhatsApp Web, Signal, Home Assistant) instead of printing a long-lived
credential on screen. See `docs/pairing-codes.md` in the repository.

## Development

```sh
npm install
npm test          # node:test, includes QR render assertions
npm pack          # tarball to install with the file: spec above
```

## Known limitations

- The QR is printed once at startup. A process that rotates its token on restart
  prints a new one; an already-open terminal keeps the old (now invalid) code.
- No in-page QR in the desktop GUI yet: the route exists, but no UI consumes it
  in this repository.
- `dsh web` still prints its own token line; this plugin adds to it rather than
  replacing it, because supervisors and scripts parse that line.
