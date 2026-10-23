"""品红抠像 + 合成试点：精灵图 → 透明 PNG → 贴到背景板上。
用法：python3 key_and_compose.py
产出：assets-src/sprites/keyed/*.png、试点合成图与六阶段对照图（写到 your_files）。"""
from PIL import Image, ImageFilter, ImageDraw
import numpy as np, glob, os

SRC = os.path.expanduser('~/workspace/born-in-time/assets-src/sprites')
OUT = os.path.join(SRC, 'keyed'); os.makedirs(OUT, exist_ok=True)
PLATE = glob.glob(os.path.expanduser('~/workspace/born-in-time/assets-src/plates/*.webp'))[0]
DEST = os.path.expanduser('~/workspace/your_files/born-in-time-redesign')

def key_out(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # 品红判定：红蓝高、绿低
    magenta = (r > 150) & (b > 150) & (g < 130)
    alpha = np.where(magenta, 0, 255).astype(np.uint8)
    # 边缘去溢色：与品红相邻的半透明圈把 r/b 压向 g
    out = np.dstack([np.asarray(im), alpha])
    ys, xs = np.where(alpha > 0)
    crop = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(crop, 'RGBA')

sprites = {}
for p in sorted(glob.glob(os.path.join(SRC, '*.webp'))):
    name = os.path.basename(p).split('-0-')[0].replace('media-generation-', '')
    sp = key_out(p)
    sp.save(os.path.join(OUT, name + '.png'))
    sprites[name] = sp
    print('keyed', name, sp.size)

plate = Image.open(PLATE).convert('RGB')
W, H = plate.size
FEET = int(H * 0.94)

def paste(canvas, sprite, cx, height):
    w = int(sprite.width * height / sprite.height)
    s = sprite.resize((w, height), Image.LANCZOS)
    x, y = int(cx - w / 2), FEET - height
    sh = Image.new('RGBA', (w, int(height * 0.06)), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse([w * 0.12, 0, w * 0.88, sh.height], fill=(40, 26, 14, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(6))
    canvas.alpha_composite(sh, (x, FEET - int(height * 0.03)))
    canvas.alpha_composite(s, (x, y))

# 合成图：45 岁（父辈位）+ 8 岁（主角）+ 70 岁（祖辈位）三代同堂
comp = plate.convert('RGBA')
adult_h = int(H * 0.52)
paste(comp, sprites['char-a-m-45'], W * 0.36, adult_h)
paste(comp, sprites['char-a-m-08'], W * 0.50, int(H * 0.34))
paste(comp, sprites['char-a-m-70'], W * 0.64, int(H * 0.50))
comp.convert('RGB').save(os.path.join(DEST, 'pilot-composite.png'))
print('composite saved', comp.size)

# 六阶段对照图：同角色从 3 岁到 70 岁
order = ['char-a-m-03', 'char-a-m-08', 'char-a-m-15', 'char-a-m-25', 'char-a-m-45', 'char-a-m-70']
hs = {'03': 0.30, '08': 0.42, '15': 0.62, '25': 0.72, '45': 0.72, '70': 0.68}
strip_h = 900
strip = Image.new('RGBA', (2400, strip_h), (246, 239, 219, 255))
x = 60
for name in order:
    h = int(strip_h * hs[name[-2:]])
    sp = sprites[name]
    w = int(sp.width * h / sp.height)
    strip.alpha_composite(sp.resize((w, h), Image.LANCZOS), (x, strip_h - 60 - h))
    x += w + 55
strip.convert('RGB').save(os.path.join(DEST, 'pilot-ageline.png'))
print('ageline saved', strip.size)
