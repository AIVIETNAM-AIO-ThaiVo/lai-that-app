#!/usr/bin/env bash
# HARNESS AUTOMATION TEST — máy tự chạy thử app như người dùng, chụp ảnh, xuất báo cáo.
#   bash test.sh   → bot mở app trong Chrome/Edge, đi hết luồng người thuê + chủ trọ → reports/latest/report.html
set -u
cd "$(dirname "$0")"
node 2-environment/bot.mjs
rc=$?
REPORT="reports/latest/report.html"
if [ -f "$REPORT" ]; then
  case "$(uname -s)" in
    Darwin) open "$REPORT" ;;
    Linux) xdg-open "$REPORT" >/dev/null 2>&1 || true ;;
    MINGW*|MSYS*|CYGWIN*) start "" "$REPORT" ;;
  esac
fi
exit $rc
