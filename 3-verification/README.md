# ③ VERIFICATION — giám khảo chấm đậu/rớt

`bash 3-verification/verify.sh` chấm **mọi tính năng đang 🟡 claimed** (hoặc `verify.sh F2 F3` để chấm đúng mấy cái):

1. Mỗi tính năng có file test chưa? (`game/tests/<FID>.test.js`) — luật: viết test trước.
2. Unit test luật chơi có xanh hết không? (`node --test`)
3. Bot có tự chơi game được không? (`2-environment/bot.mjs` + kịch bản `game/e2e.mjs`)

🟢 Xanh → chính verify.sh chuyển 🟡 → ✅ passing và ghi `1-wiki/log.md`. 🔴 Đỏ → tính năng vẫn 🟡, Model phải sửa.
