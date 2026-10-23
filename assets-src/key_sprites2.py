"""把 sprites2 的品红底生图抠成透明精灵 → keyed2（build_assets.py 的输入）。
抠像规则：R>150 且 B>150 且 G<130 判为品红底。am-25 是单独的干净会话派生，源在 templates/。"""
from PIL import Image
import numpy as np, os, glob, re

ROOT = os.path.expanduser('~/workspace/born-in-time/assets-src')
SRC = os.path.join(ROOT, 'sprites2')
TPL = os.path.join(ROOT, 'templates')
OUT = os.path.join(ROOT, 'keyed2')
os.makedirs(OUT, exist_ok=True)

def key_out(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    alpha = np.where((r > 150) & (b > 150) & (g < 130), 0, 255).astype(np.uint8)
    out = np.dstack([np.asarray(im), alpha])
    ys, xs = np.where(alpha > 0)
    return Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')

for p in sorted(glob.glob(os.path.join(SRC, 'media-generation-*.webp'))):
    stem = re.sub(r'^media-generation-', '', os.path.basename(p)).split('-0-')[0]
    key_out(p).save(os.path.join(OUT, stem + '.png'))
    print('keyed', stem)

fresh = os.path.join(TPL, 'media-generation-drv-am-25-fresh-0-1a423cc2-958a-4589-ba17-869f22525692.webp')
key_out(fresh).save(os.path.join(OUT, 'am-25.png'))
print('keyed am-25 (fresh)')
