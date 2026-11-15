# dsh-plugin-mobile-pair

Print a scannable pairing QR when the DeepSeek Harness Web GUI starts, so the
DSH Mobile (Android) app pairs by scanning instead of typing a host URL and a
launch token.

## What it prints

Beside the usual readiness line:

```
mobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码

  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▀▀ ▄▀ █▄▀▀▄▀▄ █ ▄▄▄▄▄ █ ...

mobile-pair: http://192.168.1.10:3080/?token=…

dsh web: http://192.168.1.10:3080/?token=…
```

The encoded URL is exactly the token-bearing URL `dsh web` already prints, so
the phone lands on the same authenticated session the desktop browser uses.

## Install

```sh
dsh plugin --profile web add dsh-plugin-mobile-pair   # from a registry
dsh plugin --profile web add file:/path/to/dsh-plugin-mobile-pair-0.1.0.tgz
dsh plugin --profile web add link:$(pwd)/packages/dsh-plugin-mobile-pair   # from a checkout
```

Restart `dsh web`. The package ships a `dsh.bundle.patch` layer, so it joins the
composed profile tree; remove it with `dsh plugin --profile web remove
dsh-plugin-mobile-pair`.

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

```yaml
- id: mobile-pair
  name: dsh-plugin-mobile-pair
  config:
    small: false   # larger code, scannable from further away
```

## Token handling

The plugin prints and serves the same process token `dsh web` prints. It does not
persist the token, add it to settings, or send it anywhere else: it is local
terminal text plus an authenticated response. Treat a screenshot of that terminal
exactly like the URL line itself.

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
