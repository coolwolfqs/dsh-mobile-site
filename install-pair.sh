#!/bin/sh
# 一键安装 DSH Mobile 手机配对插件。
#
#   curl -fsSL https://coolwolfqs.github.io/dsh-mobile-site/install-pair.sh | sh
#
# 作用：把 dsh-plugin-mobile-pair 装进你的 DSH profile（默认 web），装完重启
# `dsh web`，启动终端就会打印配对二维码，手机扫码即连。
#
# 可用环境变量：
#   DSH_PAIR_PROFILE   要安装的 profile，默认 web
#   DSH_PAIR_VERSION   指定插件版本（默认取最新 release）
set -eu

REPO="coolwolfqs/dsh-mobile-site"
PROFILE="${DSH_PAIR_PROFILE:-web}"
BASE="https://github.com/$REPO/releases/download"

say() { printf '%s\n' "$*"; }
die() { printf '安装失败：%s\n' "$*" >&2; exit 1; }

command -v dsh >/dev/null 2>&1 || die "找不到 dsh 命令，请先安装 DeepSeek Harness"

if [ -n "${DSH_PAIR_VERSION:-}" ]; then
  VERSION="$DSH_PAIR_VERSION"
else
  # Resolve the tag from the /releases/latest redirect: no API call, so no rate
  # limit and no JSON parsing. The redirect is retried because a single transient
  # network blip should not send the user hunting for a version number.
  resolve_version() {
    attempt=1
    while [ "$attempt" -le 4 ]; do
      resolved=$(curl -fsSIL --retry 2 --retry-delay 1 --max-time 20 -o /dev/null \
        -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null \
        | sed 's#.*/tag/##; s#/$##') || resolved=""
      case "$resolved" in
        v[0-9]*) printf '%s' "$resolved"; return 0 ;;
      esac
      attempt=$((attempt + 1))
      sleep 2
    done
    return 1
  }
  VERSION=$(resolve_version) || {
    say "无法自动获取最新版本号（网络不通或 GitHub 不可达）。"
    say "可以显式指定版本后重试，例如："
    say "  DSH_PAIR_VERSION=v1.0.56 sh -c 'curl -fsSL https://coolwolfqs.github.io/dsh-mobile-site/install-pair.sh | sh'"
    exit 1
  }
fi

# The plugin version is resolved from the release's assets, so a plugin bump does
# not require editing this script.
PLUGIN_VERSION="${DSH_PAIR_PLUGIN_VERSION:-1.0.5}"
URL="$BASE/$VERSION/dsh-plugin-mobile-pair-$PLUGIN_VERSION.tgz"
say "正在把手机配对插件装入 profile: $PROFILE"
say "来源: $URL"

if ! dsh plugin --profile "$PROFILE" add "$URL" >/dev/null 2>&1; then
  say ""
  say "自动安装没有成功，常见原因与处理："
  say "  1. 缺少 pnpm：npm install -g pnpm，然后重试"
  say "  2. profile 名不对：DSH_PAIR_PROFILE=tui sh -c '...' 换一个再试"
  say "  3. 网络不可达 GitHub：改用手动下载 tarball 后 "
  say "     dsh plugin --profile $PROFILE add file:/路径/dsh-plugin-mobile-pair-1.0.5.tgz"
  say ""
  say "手动安装命令："
  say "  dsh plugin --profile $PROFILE add $URL"
  exit 1
fi

say ""
say "装好了。确认版本（应显示 dsh-plugin-mobile-pair@$PLUGIN_VERSION）："
say "  dsh plugin --profile $PROFILE why dsh-plugin-mobile-pair"
say ""
say "然后重启 dsh $PROFILE —— 启动终端第一行会打印："
say "  mobile-pair: v$PLUGIN_VERSION 已启用（主机 <id>）"
say "下面就是配对二维码，用 DSH Mobile 的「扫码配对」扫它即可。"
say ""
say "扫码连不上时先确认手机 App 是 1.0.57 或更新版本（更早版本不支持配对码）。"
