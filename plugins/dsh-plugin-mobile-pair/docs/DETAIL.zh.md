# 手机配对二维码

DSH Mobile（安卓端）通过扫描二维码配对：二维码里是 Web GUI 地址加本次进程的启动 token。手动输入这两样是连接流程里最慢的一步，本插件把二维码直接打印在你已经在看的地方——启动 `dsh web` 的那个终端。

## 你会看到什么

启动时，紧挨着原来的 `dsh web: …?token=…` 那行：

```
mobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码

  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▀▀ ▄▀ █▄▀▀▄▀▄ █ ▄▄▄▄▄ █ ...

mobile-pair: http://192.168.1.10:3080/mobile-pair/claim?code=…
```

打开 DSH Mobile，点「扫码配对」，就连上了，全程不需要输入。

## 鉴权路由

`GET /api/mobile-pair` 给已经持有本进程会话的浏览器返回同样的内容，桌面 Web GUI 之后也可以用它在页面里显示二维码：

```json
{ "url": "http://192.168.1.10:3080/?token=…", "svg": "<svg …></svg>" }
```

该路由位于 Connection 的鉴权栅栏之后：未认证请求在序列化 token 之前就被拒绝（401）。

## 安装

```sh
curl -fsSL https://coolwolfqs.github.io/dsh-mobile-site/install-pair.sh | sh
```

就这一行，装完重启 `dsh web`，启动终端会在 `dsh web:` 那行旁边打印二维码（默认装进 `web` profile）。其他安装方式（指定 profile、直接装 tarball、插件索引）见插件 README。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `terminal` | `true` | 在启动终端打印二维码 |
| `route` | `true` | 提供 `GET /api/mobile-pair` |
| `small` | `true` | 半块字符渲染，适配窄终端 |

把 `small` 关掉可以得到更大的二维码，从更远处也能扫到。

## Token 处理

二维码里是**五分钟有效、只能用一次**的配对码，不是启动 token。扫码后访问 `/mobile-pair/claim?code=…`，插件在主机内部用内存里的 token 调自己的 `/connect` 换取会话 Cookie，再把 Cookie 交给手机。token 全程不出主机；终端截图五分钟后或扫码一次后即失效，手机上只留一个可撤销的会话 Cookie。
