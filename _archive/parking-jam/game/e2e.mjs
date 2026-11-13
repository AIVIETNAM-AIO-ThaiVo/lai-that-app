// Kịch bản bot tự chơi Parking Jam (2-environment/bot.mjs gọi hàm play).
// Mỗi tính năng có giao diện thì thêm bước kiểm vào đây.
//   evaluate(js) → chạy JS trong trang · click(selector) · shot(nhãn) · check(tên, đúng?, chi tiết) · sleep(ms)
export async function play({ evaluate, click, shot, check, sleep }) {
  for (let level = 1; level <= 5; level++) {
    const name = await evaluate(`document.getElementById('level-name')?.textContent ?? 'Level ${level}'`);
    const total = (await evaluate('window.__game.cars()')).length;
    check(`${name}: có xe trong bãi`, total > 0, `${total} xe`);
    for (let guard = 0; guard < 40; guard++) {
      const cars = await evaluate('window.__game.cars()');
      if (cars.length === 0) break;
      let moved = false;
      for (const id of cars) {
        await click(`[data-car="${id}"]`);
        await sleep(450);
        if ((await evaluate('window.__game.cars()')).length < cars.length) { moved = true; await shot(`${name}: chạm xe ${id} → ra bãi`); break; }
      }
      if (!moved) break;
    }
    const left = (await evaluate('window.__game.cars()')).length;
    check(`${name}: đưa hết xe ra bãi`, left === 0, left ? `còn ${left} xe không đi được` : '');
    const shown = await evaluate(`(() => { const el = document.getElementById('complete'); return !!el && !el.hidden; })()`);
    check(`${name}: hiện màn "Hoàn thành!"`, shown);
    await shot(`${name}: kết thúc`);
    if (!shown || !(await evaluate(`!!document.getElementById('next')`))) break;
    await click('#next');
    await sleep(400);
  }
}
