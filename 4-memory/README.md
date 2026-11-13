# ④ MEMORY — sổ tay của harness (model_led)

| File | Là gì |
|---|---|
| `features.json` | Trạng thái từng tính năng: ⏳ pending · 🟡 claimed · ✅ passing · ⛔ blocked. **Không ai sửa tay.** |
| `features.mjs` | Lệnh đọc/ghi sổ. Model dùng: `brief` · `claim F2` · `block F2 "lý do"` · `note "…"`. Chỉ verify.sh dùng `promote`. |
| `progress.md` | Nhật ký tiến độ (Model `note`, harness tự ghi khi claim/passing/blocked). |
| `po-questions.md` | Câu hỏi AI để lại cho bạn (PO) khi Wiki chưa nói rõ. |

🟡 claimed = "Model nói đã làm". ✅ passing = "máy đã chứng minh". Hai thứ này khác nhau.
