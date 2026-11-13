#!/usr/bin/env bash
# ② ENVIRONMENT · tải asset miễn phí vào app/assets/ và tự ghi nguồn + giấy phép vào 1-wiki/design/credits.md
#   bash 2-environment/get-asset.sh <url> <tên-file>
#   ví dụ: bash 2-environment/get-asset.sh https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/1f439.svg mole.svg
# Chỉ cho phép các nguồn đã kiểm giấy phép (xem 1-wiki/design/assets.md).
set -eu
cd "$(dirname "$0")/.."
URL="${1:?Cần URL}"
NAME="${2:?Cần tên file, ví dụ mole.svg}"
case "$NAME" in */*|..*) echo "Tên file không được chứa /"; exit 1 ;; esac

case "$URL" in
  https://cdn.jsdelivr.net/gh/jdecked/twemoji@*)      LIC="Twemoji — CC BY 4.0 — © Twitter, Inc and other contributors" ;;
  https://cdn.jsdelivr.net/gh/game-icons/icons@*)     LIC="game-icons.net — CC BY 3.0 — tác giả: $(echo "$URL" | sed -E 's#.*/icons@[^/]+/([^/]+)/.*#\1#')" ;;
  https://cdn.jsdelivr.net/npm/lucide-static@*)       LIC="Lucide — ISC License" ;;
  *) echo "✗ Nguồn chưa được cho phép. Dùng một nguồn trong 1-wiki/design/assets.md"; exit 1 ;;
esac

mkdir -p app/assets
TMP=$(mktemp)
code=$(curl -sL -o "$TMP" -w '%{http_code}' "$URL")
if [ "$code" != 200 ] || [ ! -s "$TMP" ]; then rm -f "$TMP"; echo "✗ Tải thất bại (HTTP $code): $URL"; exit 1; fi
if ! head -c 300 "$TMP" | grep -qi '<svg'; then rm -f "$TMP"; echo "✗ File tải về không phải SVG"; exit 1; fi
mv "$TMP" "app/assets/$NAME"

CRED=1-wiki/design/credits.md
[ -f "$CRED" ] || printf '# Credits — nguồn và giấy phép của asset\n\n' > "$CRED"
grep -q "assets/$NAME" "$CRED" || echo "- \`assets/$NAME\` · $LIC · $URL" >> "$CRED"
echo "✓ app/assets/$NAME ($LIC)"
