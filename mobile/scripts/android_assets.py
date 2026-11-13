#!/usr/bin/env python3
"""Biểu tượng + màn chờ Android cho Lãi Thật (thay ảnh mặc định của Capacitor). Cần Pillow.

Vẽ thẳng từ hình học logo (brand/logo/GUIDE.md, khung 256): chữ L trắng = phần lãi còn lại, mảnh phí màu #9FD3C9.
Chạy:  python mobile/scripts/android_assets.py     (sau `npx cap add android`)
"""
from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parents[1] / 'android' / 'app' / 'src' / 'main' / 'res'
GREEN, WHITE, MINT = (10, 122, 107, 255), (255, 255, 255, 255), (159, 211, 201, 255)
SS = 4  # vẽ to rồi thu nhỏ cho mịn


def symbol(px):
    """Biểu tượng (khung 256, phần vẽ 32..224) thu vào ô vuông px×px, nền trong suốt; phần vẽ phủ kín ô."""
    k = px * SS / 192
    im = Image.new('RGBA', (px * SS, px * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = lambda v: (v - 32) * k
    r = 12 * k
    d.rounded_rectangle([t(32), t(32), t(112), t(224)], r, fill=WHITE)    # thân dọc chữ L
    d.rounded_rectangle([t(32), t(144), t(224), t(224)], r, fill=WHITE)   # thân ngang chữ L (góc trong vuông)
    d.rounded_rectangle([t(148), t(32), t(224), t(108)], r, fill=MINT)    # mảnh phí
    return im.resize((px, px), Image.LANCZOS)


def place(canvas, sym):
    w, h = canvas.size
    canvas.alpha_composite(sym, ((w - sym.width) // 2, (h - sym.height) // 2))
    return canvas


def rounded_bg(px, radius, circle=False):
    im = Image.new('RGBA', (px * SS, px * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if circle: d.ellipse([0, 0, px * SS - 1, px * SS - 1], fill=GREEN)
    else: d.rounded_rectangle([0, 0, px * SS - 1, px * SS - 1], radius * SS, fill=GREEN)
    return im.resize((px, px), Image.LANCZOS)


DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def main():
    if not RES.exists():
        raise SystemExit('Chưa có mobile/android — chạy `npx cap add android` trước.')
    for name, m in DENS.items():
        d = RES / f'mipmap-{name}'
        # Biểu tượng thích ứng (Android 8+): lớp trước 108dp, vùng an toàn hình tròn 66dp → biểu tượng vuông ≤ 46dp
        fg = round(108 * m)
        place(Image.new('RGBA', (fg, fg), (0, 0, 0, 0)), symbol(round(44 * m))).save(d / 'ic_launcher_foreground.png')
        # Biểu tượng cũ (Android < 8): 48dp
        ic = round(48 * m)
        place(rounded_bg(ic, 10 * m), symbol(round(28 * m))).save(d / 'ic_launcher.png')
        place(rounded_bg(ic, 0, circle=True), symbol(round(26 * m))).save(d / 'ic_launcher_round.png')
    # Màu nền lớp sau của biểu tượng thích ứng
    (RES / 'values' / 'ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0A7A6B</color>\n</resources>\n', encoding='utf-8')
    # Màn chờ gốc: nền xanh lãi + biểu tượng giữa (nối liền màn mở app trên web, F20)
    for f in RES.glob('drawable*/splash.png'):
        w, h = Image.open(f).size
        place(Image.new('RGBA', (w, h), GREEN), symbol(round(min(w, h) * 0.26))).convert('RGB').save(f)
    print('Đã vẽ biểu tượng + màn chờ Android vào', RES)


if __name__ == '__main__':
    main()
