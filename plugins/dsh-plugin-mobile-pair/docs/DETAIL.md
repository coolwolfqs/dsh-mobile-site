# Mobile pairing QR

DSH Mobile (Android) pairs by scanning a QR that carries the Web GUI URL plus its launch token. Typing that URL and token by hand is the slowest part of connecting; this plugin prints the QR where you already are: the terminal that started `dsh web`.

## What you see

On startup, right beside the usual `dsh web: …?token=…` line:

```
mobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码

  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▀▀ ▄▀ █▄▀▀▄▀▄ █ ▄▄▄▄▄ █ ...

mobile-pair: http://192.168.1.10:3080/?token=…
```

Open DSH Mobile, tap **扫码配对** (Scan to pair), and the app connects. Nothing is typed.

## The authenticated route

`GET /api/mobile-pair` returns the same data for the browser that already holds this process's session, so the desktop Web GUI can also show the code:

```json
{ "url": "http://192.168.1.10:3080/?token=…", "svg": "<svg …></svg>" }
```

The route sits behind the ordinary Connection authentication fence: an unauthenticated request is rejected before the token is serialized.

## Install

```sh
dsh plugin --profile web add dsh-plugin-mobile-pair
```

Restart `dsh web`. The layer is a `dsh.bundle` patch, so it applies to the profile you install it into; remove it the same way to stop printing the QR.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `terminal` | `true` | Print the QR in the launching terminal |
| `route` | `true` | Serve `GET /api/mobile-pair` |
| `small` | `true` | Half-block rendering, which fits narrow terminals |

Turn `small` off for a larger code that scans from further away.

## Token handling

The QR encodes the same launch token `dsh web` already prints. The plugin does not write it to disk, log it twice, or send it anywhere: it is printed locally and served only to the authenticated session. Treat a screenshot of the terminal like the URL line itself.
