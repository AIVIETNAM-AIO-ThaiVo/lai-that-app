#!/usr/bin/env python3
"""Lãi Thật — chuyển động màn mở app "tách kiểu chất lỏng" (F20, làm theo skill wiggle).

Một hàm chuyển động duy nhất (motion()) sinh ra:
  1. brand/logo/motion/splash-liquid.json  — Lottie (biểu tượng, 512×512, 60 fps)
  2. khối keyframes trong app/styles.css   — giữa /* splash:gen:start */ … /* splash:gen:end */
  3. brand/logo/motion/splash-liquid-lottie.gif — xem trước, vẽ lại từ chính file Lottie (renderer nhỏ bằng Pillow)

Triết lý (wiggle bước 1): rõ ràng · đáng tin → yên tâm → khối chất lỏng tự tách: mảnh phí bị kéo giãn,
cầu nối thắt lại rồi đứt, giọt co về hình vuông, lắc nhẹ rồi đứng yên; chữ L giật nhẹ khi đứt.

Chạy:  python brand/logo/motion/build_splash.py [--no-gif]
"""
import json, math, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CSS = ROOT / 'app' / 'styles.css'

# ---------------------------------------------------------------- hình (hệ toạ độ 0..256 của logo)
L_CORNERS = [  # (x, y, bán kính bo) theo chiều kim đồng hồ; góc trong (112,144) bo 7 như lớp chất lỏng trong app
    (32, 32, 12), (112, 32, 12), (112, 144, 7), (224, 144, 12), (224, 224, 12), (32, 224, 12)]
CHIP = (148, 32, 76, 76, 12)            # x, y, w, h, rx — mảnh phí ở vị trí cuối
CHIP_C = (186.0, 70.0)                  # tâm mảnh phí
NEST_OFF = (-18.0, 18.0)                # lệch lúc còn nằm trong khối (khớp góc khuyết của L)
NEST_SIZE = 112 / 76                    # lúc đầu mảnh phí lấp đầy góc khuyết 112×112
WHITE, MINT, GREEN = '#FFFFFF', '#9FD3C9', '#0A7A6B'

# ---------------------------------------------------------------- thời gian (ms, tính từ lúc hiện màn mở app)
IN_MS = 220          # khối hiện ra
CHIP_START, CHIP_MS = 160, 700
SNAP = 0.42          # phần thời gian (của CHIP_MS) lúc cầu nối đứt
P_SNAP = 0.40        # tiến độ quãng đường lúc đứt
# Mảnh phí tách ra khi vẫn còn trắng (cùng màu khối giá); tách xong mới đổi sang màu phí, CÙNG LÚC chữ "Lãi Thật" hiện
# (phản hồi người dùng 13/11). Đổi màu = lớp phủ trắng mờ đi, chạy cùng thời điểm và cùng đường cong với chữ.
WORD_START, WORD_MS = 640, 360
END_MS = max(CHIP_START + CHIP_MS, WORD_START + WORD_MS)   # lớp chất lỏng giữ tới cuối — không đổi sang lớp góc nhọn
STOPS = 30           # khung khoá cho mảnh phí (wiggle: hữu cơ 25–45)

STRETCH = 0.10           # giãn tối đa dọc hướng kéo (giữ thể tích)
ZETA, OMEGA = 0.62, 15.0   # lò xo sau khi đứt: vượt ≈ 6–8 %, tắt trong ~0,4 s


def motion(tau):
    """tau ∈ [0,1] trong cửa sổ CHIP_MS → dict tiến độ p, giãn s (dọc hướng đi), kích thước, độ phủ trắng, giật L, cổ nối."""
    t_snap = SNAP
    if tau <= t_snap:
        u = tau / t_snap
        p = P_SNAP * u ** 2.2                      # kéo như mạch nha: chậm rồi nhanh dần
        stretch = 1 + STRETCH * u ** 1.6               # dài ra theo hướng kéo
        recoil = 0.0
        neck = (1 - u) ** 0.6                       # cổ nối thắt dần
    else:
        t = (tau - t_snap) * CHIP_MS / 1000.0       # giây sau khi đứt
        v0 = P_SNAP * 2.2 / (t_snap * CHIP_MS / 1000.0)
        A = P_SNAP - 1
        wd = OMEGA * math.sqrt(1 - ZETA ** 2)
        B = (v0 + ZETA * OMEGA * A) / wd
        p = 1 + math.exp(-ZETA * OMEGA * t) * (A * math.cos(wd * t) + B * math.sin(wd * t))
        stretch = 1 + STRETCH * math.exp(-t * 9) * math.cos(2 * math.pi * 3.2 * t)   # dài → bẹt → dài… rồi yên
        recoil = 2.2 * math.exp(-t * 10) * math.sin(2 * math.pi * 3.4 * t)          # L bật nhẹ ngược lại
        neck = 0.0
    if tau >= 1:
        p, stretch, recoil = 1.0, 1.0, 0.0
    size = 1 + (NEST_SIZE - 1) * (1 - p)
    return dict(p=p, stretch=stretch, size=size, recoil=recoil, neck=neck)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def chip_pose(tau):
    m = motion(tau)
    dx, dy = NEST_OFF[0] * (1 - m['p']), NEST_OFF[1] * (1 - m['p'])
    sp, sq = m['stretch'] * m['size'], m['size'] / m['stretch']   # giữ thể tích
    return m, dx, dy, sp, sq


def f(x, n=2):
    s = f'{x:.{n}f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


# ---------------------------------------------------------------- 1. CSS
def css_block():
    chip, cover, ell = [], [], []
    for k in range(STOPS + 1):
        tau = k / STOPS
        m, dx, dy, sp, sq = chip_pose(tau)
        pct = f(tau * 100, 2)
        chip.append(f'  {pct}% {{ transform: translate({f(dx)}px, {f(dy)}px) rotate(-45deg) scale({f(sp, 4)}, {f(sq, 4)}) rotate(45deg); }}')
        r = m['recoil'] / math.sqrt(2)
        ell.append(f'  {pct}% {{ transform: translate({f(-r)}px, {f(r)}px); }}')
    cover = ['  from { opacity: 1; }', '  to { opacity: 0; }']
    out = [
        '/* splash:gen:start — sinh bởi brand/logo/motion/build_splash.py, đừng sửa tay */',
        f'.splash.animate .splash-mark svg {{ animation: splash-in {IN_MS}ms cubic-bezier(0.25, 0.75, 0.25, 1) both; }}',
        f'.splash.animate .splash-chip {{ transform-origin: {f(CHIP_C[0])}px {f(CHIP_C[1])}px; animation: splash-chip {CHIP_MS}ms {CHIP_START}ms linear both; }}',
        f'.splash.animate .splash-cover {{ animation: splash-cover {WORD_MS}ms {WORD_START}ms cubic-bezier(0.25, 0.75, 0.25, 1) both; }}',
        f'.splash.animate .splash-l {{ animation: splash-l {CHIP_MS}ms {CHIP_START}ms linear both; }}',
        f'.splash.animate .splash-word {{ animation: splash-word {WORD_MS}ms {WORD_START}ms cubic-bezier(0.25, 0.75, 0.25, 1) both; }}',
        '@keyframes splash-in {\n  from { opacity: 0; transform: scale(0.92); }\n  to { opacity: 1; transform: none; }\n}',
        '@keyframes splash-chip {\n' + '\n'.join(chip) + '\n}',
        '@keyframes splash-cover {\n' + '\n'.join(cover) + '\n}',
        '@keyframes splash-l {\n' + '\n'.join(ell) + '\n}',
        '@keyframes splash-word {\n  from { opacity: 0; transform: translateY(8px); }\n  to { opacity: 1; transform: none; }\n}',
        '/* splash:gen:end */',
    ]
    return '\n'.join(out)


def write_css():
    src = CSS.read_text(encoding='utf-8')
    block = css_block()
    pat = re.compile(r'/\* splash:gen:start.*?/\* splash:gen:end \*/', re.S)
    if not pat.search(src):
        raise SystemExit('Thiếu dấu /* splash:gen:start */ … /* splash:gen:end */ trong app/styles.css')
    CSS.write_text(pat.sub(lambda _: block, src), encoding='utf-8')


# ---------------------------------------------------------------- 2. Lottie
W = H = 512
S = 1.6
O = (W - 256 * S) / 2
FR = 60
OP = round((END_MS + 250) * FR / 1000)   # ≈ 1,25 s


def P(x, y):
    return [round(O + S * x, 2), round(O + S * y, 2)]


def hexrgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1]


def static(v):
    return {'a': 0, 'k': v}


LIN_O, LIN_I = {'x': [0.333], 'y': [0.333]}, {'x': [0.667], 'y': [0.667]}   # nội suy thẳng giữa các khung đã lấy mẫu


def keyed(samples):
    """samples: [(frame, value_list)] → thuộc tính có khung khoá (giá trị đã chứa easing của hàm chuyển động)."""
    ks = []
    for i, (t, v) in enumerate(samples):
        k = {'t': t, 's': v}
        if i < len(samples) - 1:
            k['o'], k['i'] = LIN_O, LIN_I
        ks.append(k)
    return {'a': 1, 'k': ks}


def tr(p=(0, 0), s=(100, 100), r=0, o=100):
    return {'ty': 'tr', 'p': static(list(p)), 'a': static([0, 0]), 's': static(list(s)), 'r': static(r), 'o': static(o)}


def fill(color, o=100):
    return {'ty': 'fl', 'c': static(hexrgb(color)), 'o': static(o), 'r': 1}


def rounded_path(corners, scale=S, off=O):
    """Đa giác bo góc → path Lottie (v, i, o tương đối)."""
    K = 0.5523
    v, ii, oo = [], [], []
    n = len(corners)
    for idx, (x, y, r) in enumerate(corners):
        px, py, _ = corners[idx - 1]
        nx, ny, _ = corners[(idx + 1) % n]
        if r == 0:
            v.append([off + scale * x, off + scale * y]); ii.append([0, 0]); oo.append([0, 0]); continue
        def unit(ax, ay):
            d = math.hypot(ax, ay); return ax / d, ay / d
        ux1, uy1 = unit(px - x, py - y)
        ux2, uy2 = unit(nx - x, ny - y)
        a = (x + ux1 * r, y + uy1 * r)
        b = (x + ux2 * r, y + uy2 * r)
        v.append([off + scale * a[0], off + scale * a[1]]); ii.append([0, 0]); oo.append([-ux1 * r * K * scale, -uy1 * r * K * scale])
        v.append([off + scale * b[0], off + scale * b[1]]); ii.append([-ux2 * r * K * scale, -uy2 * r * K * scale]); oo.append([0, 0])
    rnd = lambda arr: [[round(c, 2) for c in pt] for pt in arr]
    return {'ty': 'sh', 'ks': static({'c': True, 'v': rnd(v), 'i': rnd(ii), 'o': rnd(oo)})}


def layer(ind, nm, shapes, ks, parent=None, ip=0):
    d = {'ddd': 0, 'ind': ind, 'ty': 4, 'nm': nm, 'sr': 1, 'ks': ks, 'ao': 0, 'shapes': shapes, 'ip': ip, 'op': OP, 'st': 0, 'bm': 0}
    if parent:
        d['parent'] = parent
    return d


def ks(p=None, s=None, r=None, o=None, a=None):
    return {'o': o or static(100), 'r': r or static(0), 'p': p or static([0, 0, 0]), 'a': a or static([0, 0, 0]), 's': s or static([100, 100, 100])}


def frame_of(ms):
    return ms * FR / 1000


def build_lottie():
    c0, c1 = frame_of(CHIP_START), frame_of(CHIP_START + CHIP_MS)
    nkeys = 27
    frames = [round(c0 + (c1 - c0) * k / nkeys, 2) for k in range(nkeys + 1)]
    chip_p, chip_s, l_p, neck_p, neck_s = [], [], [], [], []
    for fr in frames:
        tau = (fr - c0) / (c1 - c0)
        m, dx, dy, sp, sq = chip_pose(tau)
        cx, cy = CHIP_C[0] + dx, CHIP_C[1] + dy
        chip_p.append((fr, P(cx, cy) + [0]))
        chip_s.append((fr, [round(sp * 100, 3), round(sq * 100, 3), 100]))
        rr = m['recoil'] / math.sqrt(2)
        l_p.append((fr, [round(-rr * S, 3), round(rr * S, 3), 0]))
        # cổ nối: từ góc trong của L (112,144) tới góc dưới-trái của mảnh phí
        half = 38 * m['size']
        bx, by = cx - half * 1.0, cy + half * 1.0
        mx, my = (112 + bx) / 2, (144 + by) / 2
        length = math.hypot(bx - 112, by - 144) + 22
        width = 30 * m['neck']
        neck_p.append((fr, P(mx, my) + [0]))
        neck_s.append((fr, [round(length * S, 2), round(max(width, 0.01) * S, 2)]))
    # khung đầu/cuối giữ nguyên ngoài cửa sổ
    hold = lambda arr, first: ([(0, arr[0][1])] if first else []) + arr + [(OP, arr[-1][1])]

    root = layer(1, 'Gốc (hiện ra)', [], ks(
        p=static(P(128, 128) + [0]), a=static(P(128, 128) + [0]),
        s={'a': 1, 'k': [
            {'t': 0, 's': [92, 92, 100], 'o': {'x': [0.25], 'y': [0.75]}, 'i': {'x': [0.25], 'y': [1]}},
            {'t': round(frame_of(IN_MS), 2), 's': [100, 100, 100]}]},
        o={'a': 1, 'k': [{'t': 0, 's': [0], 'o': {'x': [0.25], 'y': [0.75]}, 'i': {'x': [0.25], 'y': [1]}},
                         {'t': round(frame_of(IN_MS), 2), 's': [100]}]}))
    root['ty'] = 3   # null layer làm gốc
    del root['shapes']

    cw, ch = CHIP[2] * S, CHIP[3] * S
    chip_group = {'ty': 'gr', 'nm': 'mảnh phí', 'it': [
        {'ty': 'gr', 'nm': 'phủ trắng (giá)', 'it': [
            {'ty': 'rc', 'p': static([0, 0]), 's': static([cw + 2 * S, ch + 2 * S]), 'r': static((CHIP[4] + 1) * S)}, fill(WHITE),
            {**tr(), 'o': {'a': 1, 'k': [{'t': round(frame_of(WORD_START), 2), 's': [100], 'o': {'x': [0.25], 'y': [0.75]}, 'i': {'x': [0.25], 'y': [1]}},
                                          {'t': round(frame_of(WORD_START + WORD_MS), 2), 's': [0]}]}}]},
        {'ty': 'gr', 'nm': 'phí', 'it': [
            {'ty': 'rc', 'p': static([0, 0]), 's': static([cw, ch]), 'r': static(CHIP[4] * S)}, fill(MINT), tr()]},
        tr(r=45)]}
    chip = layer(2, 'Mảnh phí (chip)', [chip_group], ks(p=keyed(hold(chip_p, True)), s=keyed(hold(chip_s, True)), r=static(-45)), parent=1)

    neck_end = frame_of(CHIP_START + CHIP_MS * SNAP)
    neck_group = {'ty': 'gr', 'nm': 'cổ nối', 'it': [
        {'ty': 'el', 'p': static([0, 0]), 's': keyed([(f_, v) for f_, v in neck_s if f_ <= neck_end + 0.01] + [(round(neck_end + 1, 2), [10, 0.01])])},
        fill(WHITE), tr()]}
    neck = layer(3, 'Cầu nối chất lỏng (neck)', [neck_group],
                 ks(p=keyed([(f_, v) for f_, v in neck_p if f_ <= neck_end + 2]), r=static(-45)), parent=1)
    neck['op'] = round(neck_end + 1)

    lshape = layer(4, 'Chữ L (lãi)', [{'ty': 'gr', 'nm': 'L', 'it': [rounded_path(L_CORNERS), fill(WHITE), tr()]}],
                   ks(p=keyed(hold(l_p, True))), parent=1)
    # Lottie không có bộ lọc "goo": thêm một khối trắng phủ lúc đầu để khối giá liền mạch, mờ đi khi mảnh phí bắt đầu tách
    blk_end = round(frame_of(CHIP_START + CHIP_MS * 0.18), 2)
    block = layer(6, 'Khối giá (liền lúc đầu)', [{'ty': 'gr', 'nm': 'khối', 'it': [
        {'ty': 'rc', 'p': static(P(128, 128)), 's': static([192 * S, 192 * S]), 'r': static(12 * S)}, fill(WHITE), tr()]}],
        ks(o={'a': 1, 'k': [{'t': round(frame_of(CHIP_START), 2), 's': [100], 'o': {'x': [0.25], 'y': [0]}, 'i': {'x': [0.75], 'y': [1]}},
                            {'t': blk_end, 's': [0]}]}), parent=1)
    block['op'] = round(blk_end + 1)
    bg = layer(5, 'Nền xanh lãi', [{'ty': 'gr', 'nm': 'nền', 'it': [
        {'ty': 'rc', 'p': static([W / 2, H / 2]), 's': static([W, H]), 'r': static(0)}, fill(GREEN), tr()]}], ks())
    return {'v': '5.7.4', 'fr': FR, 'ip': 0, 'op': OP, 'w': W, 'h': H, 'nm': 'Lãi Thật — tách kiểu chất lỏng', 'ddd': 0,
            'assets': [], 'layers': [block, chip, neck, lshape, root, bg]}


# ---------------------------------------------------------------- 3. Renderer Lottie tối giản (đúng tập con file này dùng)
def bez(t, p1x, p1y, p2x, p2y):
    lo, hi = 0.0, 1.0
    for _ in range(40):
        m = (lo + hi) / 2
        x = 3 * (1 - m) ** 2 * m * p1x + 3 * (1 - m) * m * m * p2x + m ** 3
        lo, hi = (m, hi) if x < t else (lo, m)
    m = (lo + hi) / 2
    return 3 * (1 - m) ** 2 * m * p1y + 3 * (1 - m) * m * m * p2y + m ** 3


def val(prop, fr):
    if not prop.get('a'):
        return prop['k']
    ks_ = prop['k']
    if fr <= ks_[0]['t']:
        return ks_[0]['s']
    for a, b in zip(ks_, ks_[1:]):
        if a['t'] <= fr < b['t']:
            x = (fr - a['t']) / (b['t'] - a['t'])
            e = bez(x, a['o']['x'][0], a['o']['y'][0], a['i']['x'][0], a['i']['y'][0]) if 'o' in a else x
            end = a.get('e', b['s'])
            if isinstance(a['s'], list):
                return [u + (w - u) * e for u, w in zip(a['s'], end)]
            return a['s'] + (end - a['s']) * e
    return ks_[-1]['s']


def mat_mul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def mat_tr(p, a, s, r):
    rad = math.radians(r)
    c, si = math.cos(rad), math.sin(rad)
    T = [[1, 0, p[0]], [0, 1, p[1]], [0, 0, 1]]
    R = [[c, -si, 0], [si, c, 0], [0, 0, 1]]
    Sm = [[s[0] / 100, 0, 0], [0, s[1] / 100, 0], [0, 0, 1]]
    A = [[1, 0, -a[0]], [0, 1, -a[1]], [0, 0, 1]]
    return mat_mul(mat_mul(mat_mul(T, R), Sm), A)


def apply(M, x, y):
    return (M[0][0] * x + M[0][1] * y + M[0][2], M[1][0] * x + M[1][1] * y + M[1][2])


def rect_pts(cx, cy, w, h, r, n=8):
    r = min(r, w / 2, h / 2)
    pts = []
    for (ox, oy, a0) in ((cx + w / 2 - r, cy - h / 2 + r, -90), (cx + w / 2 - r, cy + h / 2 - r, 0),
                         (cx - w / 2 + r, cy + h / 2 - r, 90), (cx - w / 2 + r, cy - h / 2 + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def path_pts(d, n=10):
    v, ii, oo = d['v'], d['i'], d['o']
    pts = []
    for k in range(len(v)):
        p0, p3 = v[k], v[(k + 1) % len(v)]
        c1 = (p0[0] + oo[k][0], p0[1] + oo[k][1])
        c2 = (p3[0] + ii[(k + 1) % len(v)][0], p3[1] + ii[(k + 1) % len(v)][1])
        for j in range(n):
            t = j / n
            mt = 1 - t
            pts.append((mt ** 3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * p3[0],
                        mt ** 3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * p3[1]))
    return pts


def render_gif(lot, out, step=2, ss=3, size=256):
    from PIL import Image, ImageDraw
    layers = {l['ind']: l for l in lot['layers']}

    def layer_mat(l, fr):
        k = l['ks']
        M = mat_tr(val(k['p'], fr), val(k['a'], fr), val(k['s'], fr), val(k['r'], fr))
        if 'parent' in l:
            M = mat_mul(layer_mat(layers[l['parent']], fr), M)
        return M

    def layer_op(l, fr):
        o = val(l['ks']['o'], fr)
        o = (o[0] if isinstance(o, list) else o) / 100
        return o * (layer_op(layers[l['parent']], fr) if 'parent' in l else 1)

    def draw_items(img, items, M, op, fr):
        trf = next(x for x in items if x['ty'] == 'tr')
        gM = mat_mul(M, mat_tr(val(trf['p'], fr), val(trf['a'], fr), val(trf['s'], fr), val(trf['r'], fr)))
        o = val(trf['o'], fr)
        o = (o[0] if isinstance(o, list) else o) / 100 * op
        fl = next((x for x in items if x['ty'] == 'fl'), None)
        for it in reversed(items):   # Lottie: mục đứng trước nằm trên
            if it['ty'] == 'gr':
                draw_items(img, it['it'], gM, o, fr)
            elif it['ty'] in ('rc', 'el', 'sh') and fl:
                if it['ty'] == 'rc':
                    p, s_, r = val(it['p'], fr), val(it['s'], fr), val(it['r'], fr)
                    pts = rect_pts(p[0], p[1], s_[0], s_[1], r)
                elif it['ty'] == 'el':
                    p, s_ = val(it['p'], fr), val(it['s'], fr)
                    pts = [(p[0] + s_[0] / 2 * math.cos(a), p[1] + s_[1] / 2 * math.sin(a)) for a in (2 * math.pi * k / 48 for k in range(48))]
                else:
                    pts = path_pts(val(it['ks'], fr))
                pts = [apply(gM, *q) for q in pts]
                col = val(fl['c'], fr)
                a = int(255 * o * val(fl['o'], fr) / 100)
                if a <= 0 or (it['ty'] == 'el' and min(val(it['s'], fr)) < 0.05):
                    continue
                k_ = ss * size / lot['w']
                lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
                ImageDraw.Draw(lay).polygon([(x * k_, y * k_) for x, y in pts], fill=tuple(int(c * 255) for c in col[:3]) + (a,))
                img.alpha_composite(lay)

    frames = []
    for fr in range(lot['ip'], lot['op'] + 1, step):
        img = Image.new('RGBA', (size * ss, size * ss), (0, 0, 0, 0))
        for l in reversed(lot['layers']):
            if l['ty'] != 4 or not (l['ip'] <= fr < l['op'] or (fr == lot['op'] and l['op'] == lot['op'])):
                continue
            for g in reversed(l['shapes']):
                draw_items(img, g['it'], layer_mat(l, fr), layer_op(l, fr), fr)
        frames.append(img.resize((size, size), Image.LANCZOS).convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT))
    hold = [frames[-1]] * 20
    (frames + hold)[0].save(out, save_all=True, append_images=(frames + hold)[1:], duration=int(1000 * step / lot['fr']), loop=0, disposal=2)
    return len(frames)


def main():
    write_css()
    lot = build_lottie()
    out = HERE / 'splash-liquid.json'
    out.write_text(json.dumps(lot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Lottie: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {lot["op"]} khung @ {lot["fr"]} fps)')
    print(f'CSS: app/styles.css ({STOPS + 1} khung khoá cho mảnh phí)')
    if '--no-gif' not in sys.argv:
        n = render_gif(lot, HERE / 'splash-liquid-lottie.gif')
        print(f'GIF xem trước: brand/logo/motion/splash-liquid-lottie.gif ({n} khung)')


if __name__ == '__main__':
    main()
