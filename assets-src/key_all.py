"""批量抠像：sprites/*.webp → sprites/keyed/<stem>.png（同 stem 多份时加 -v2 后缀）。"""
from PIL import Image
import numpy as np, glob, os, re

SRC = os.path.expanduser('~/workspace/born-in-time/assets-src/sprites')
OUT = os.path.join(SRC, 'keyed'); os.makedirs(OUT, exist_ok=True)

def key_out(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (r > 150) & (b > 150) & (g < 130)
    alpha = np.where(magenta, 0, 255).astype(np.uint8)
    out = np.dstack([np.asarray(im), alpha])
    ys, xs = np.where(alpha > 0)
    return Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')

seen = {}
for p in sorted(glob.glob(os.path.join(SRC, '*.webp'))):
    stem = re.sub(r'^media-generation-', '', os.path.basename(p)).split('-0-')[0]
    n = seen.get(stem, 0) + 1; seen[stem] = n
    name = stem if n == 1 else f'{stem}-v{n}'
    key_out(p).save(os.path.join(OUT, name + '.png'))
    print('keyed', name)
print('total', sum(seen.values()), 'unique stems', len(seen))
