# DSH Mobile 官方网站

本仓库托管 DSH Mobile（Android 客户端）的官方网站与 APK 下载。

- 站点：https://coolwolfqs.github.io/dsh-mobile-site/
- 下载：见 [Releases](https://github.com/coolwolfqs/dsh-mobile-site/releases)
- 说明：应用源码仓库为私有；本仓库只包含静态官网与发布产物。

## 本地预览

```bash
python3 -m http.server 8000
```

## 维护

发版时更新 `index.html` 中的版本号、APK 直链与 SHA-256，并把新的 APK/AAB 作为 Release 资产上传。
