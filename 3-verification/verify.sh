#!/usr/bin/env bash
# ③ VERIFICATION — giám khảo chấm đậu/rớt. Chế độ model_led:
#   Model làm xong tính năng nào thì `claim` (🟡). Chạy verify MỘT lần ở cuối:
#     bash 3-verification/verify.sh            → chấm mọi tính năng đang 🟡 claimed
#     bash 3-verification/verify.sh F2 F3      → chấm đúng các tính năng này
#   Xanh → CHÍNH verify.sh chuyển chúng sang ✅ passing. Model không tự làm được việc đó.
# Chấm theo loại dự án trong harness.config (STACK=web | android).
set -u
cd "$(dirname "$0")/.."
# shellcheck source=../harness.config
source ./harness.config
if [ "$#" -gt 0 ]; then
  TARGETS="$*"
else
  TARGETS=$(node -e 'for (const f of JSON.parse(require("fs").readFileSync("4-memory/features.json","utf8"))) if (f.state === "claimed") console.log(f.id)' | tr '\n' ' ')
fi
fail=0

echo "┌─ VERIFICATION · stack=$STACK · chấm: ${TARGETS:-(không có tính năng claimed — chỉ chạy kiểm tra chung)}"

# 0) Luật "viết test trước": mỗi tính năng phải có file test mang tên của nó.
for FID in $TARGETS; do
  if [ "$STACK" = android ]; then
    found=$(find "$APP_DIR" -path '*/src/test/*' -name "*${FID}*" 2>/dev/null | head -1)
  else
    found=$(ls "$APP_DIR/tests/$FID.test.js" 2>/dev/null)
  fi
  if [ -n "$found" ]; then
    echo "│ ✓ Có test cho $FID ($found)"
  else
    echo "│ ✗ Thiếu test cho $FID — luật: viết test trước rồi mới code"
    fail=1
  fi
done

if [ "$STACK" = android ]; then
  # ---------------------------------------------------------------- Android
  echo "│"
  echo "│ 1) Unit test (Gradle $ANDROID_UNIT_TEST)"
  if out=$(cd "$APP_DIR" && ./gradlew -q "$ANDROID_UNIT_TEST" 2>&1); then
    echo "│    ✓ unit test xanh"
  else
    echo "$out" | grep -E 'FAILED|Exception|expected|error:' | head -20 | sed 's/^/│    /'
    fail=1
  fi
  echo "│"
  echo "│ 2) Build APK (Gradle $ANDROID_BUILD)"
  if out=$(cd "$APP_DIR" && ./gradlew -q "$ANDROID_BUILD" 2>&1); then
    echo "│    ✓ build được APK"
  else
    echo "$out" | grep -E 'error:|e: |FAILED' | head -20 | sed 's/^/│    /'
    fail=1
  fi
  echo "│"
  echo "│ 3) Automation test (cài APK lên emulator, mở app, xem có crash không)"
  if [ "$fail" = 0 ]; then
    bash 2-environment/android-smoke.sh 2>&1 | sed 's/^/│    /'
    [ "${PIPESTATUS[0]}" = 0 ] || fail=1
  else
    echo "│    – bỏ qua vì bước trước đã đỏ"
  fi
else
  # ---------------------------------------------------------------- Web
  echo "│"
  echo "│ 1) Unit test luật chơi (node --test)"
  out=$(node --test --test-reporter=spec "$APP_DIR/tests/*.test.js" 2>&1); unit_rc=$?
  UNIT=$(echo "$out" | grep -E '^ℹ (tests|pass|fail) ' | tr '\n' ' ')
  if [ "$unit_rc" = 0 ]; then
    echo "$out" | grep -E '^ℹ (tests|pass|fail) ' | sed 's/^/│    /'
  else
    echo "$out" | grep -E '✖|Error|expected|actual|^ℹ (tests|pass|fail) ' | head -25 | sed 's/^/│    /'
    fail=1
  fi
  echo "│"
  echo "│ 2) Automation test (bot tự chơi game trong Chrome)"
  bot=$(node 2-environment/bot.mjs --quiet 2>&1) || fail=1
  echo "$bot" | sed 's/^/│    /'
  if [ "$fail" != 0 ] && [ -f reports/latest/report.json ]; then
    node -e 'for (const c of JSON.parse(require("fs").readFileSync("reports/latest/report.json","utf8")).checks) if (!c.ok) console.log("│    ✗ " + c.name + (c.detail ? " — " + c.detail : ""))'
  fi
fi

echo "│"
if [ "$fail" = 0 ]; then
  for FID in $TARGETS; do
    node 4-memory/features.mjs promote "$FID" --gate
    title=$(node -e 'const f=JSON.parse(require("fs").readFileSync("4-memory/features.json","utf8")).find(x=>x.id===process.argv[1]);console.log(f?f.title:"")' "$FID")
    echo "- $(date +%F) · build · $FID ✅ passing ($title)" >> 1-wiki/log.md
    echo "│ ✅ $FID → passing"
  done
  echo "└─ 🟢 XANH — đạt"
else
  echo "└─ 🔴 ĐỎ — chưa đạt. Các tính năng vẫn 🟡 claimed: sửa lỗi ở trên rồi chạy lại verify."
fi
# Lưu kết quả cho monitor (2-environment/monitor.mjs) đọc.
mkdir -p reports
node -e 'const [fail,targets,unit]=process.argv.slice(1);const n=(k)=>Number((unit.match(new RegExp("ℹ "+k+" (\\d+)"))||[])[1]??NaN);
require("fs").writeFileSync("reports/verify.json",JSON.stringify({at:new Date().toISOString(),ok:fail==="0",targets:targets.trim().split(/\s+/).filter(Boolean),unit:{tests:n("tests"),pass:n("pass"),fail:n("fail")}}))' "$fail" "${TARGETS:-}" "${UNIT:-}"
exit "$fail"
