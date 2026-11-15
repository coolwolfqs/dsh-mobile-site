# 手机配对二维码

DSH Mobile（安卓端）通过扫描二维码配对：二维码里是 Web GUI 地址加本次进程的启动 token。手动输入这两样是连接流程里最慢的一步，本插件把二维码直接打印在你已经在看的地方——启动 `dsh web` 的那个终端。

## 你会看到什么

启动时，紧挨着原来的 `dsh web: …?token=…` 那行：

```
mobile-pair: 用 DSH Mobile 的「扫码配对」扫描下方二维码

  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▀▀ ▄▀ █▄▀▀▄▀▄ █ ▄▄▄▄▄ █ ...

mobile-pair: http://192.168.1.10:3080/?token=…
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
dsh plugin --profile web add dsh-plugin-mobile-pair
```

重启 `dsh web`。这个包带 `dsh.bundle.patch` 层，会并入所选 profile 的插件树；用同样的方式卸载即可停止打印。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `terminal` | `true` | 在启动终端打印二维码 |
| `route` | `true` | 提供 `GET /api/mobile-pair` |
| `small` | `true` | 半块字符渲染，适配窄终端 |

把 `small` 关掉可以得到更大的二维码，从更远处也能扫到。

## Token 处理

二维码编码的正是 `dsh web` 已经打印的那串启动 token。插件不落盘、不额外记日志、不发送到任何地方：它只是本地终端文本，加上一个仅对已认证会话开放的响应。终端截图请按 URL 那行同等对待。
