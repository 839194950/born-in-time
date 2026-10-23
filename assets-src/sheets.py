"""每套角色拼一张六阶段对照图，供一致性验收。"""
from PIL import Image
import os, glob

KEYED = os.path.expanduser('~/workspace/born-in-time/assets-src/sprites/keyed')
DEST = os.path.expanduser('~/workspace/your_files/born-in-time-redesign/sheets')
os.makedirs(DEST, exist_ok=True)
FR = {'03': .30, '08': .42, '15': .62, '25': .72, '45': .72, '70': .68,
      '28': .72, '30': .72, '48': .72, '50': .72, '72': .68, '75': .68}

def sheet(prefix, stages, fname):
    H = 900
    items = []
    total_w = 60
    for st in stages:
        p = os.path.join(KEYED, f'{prefix}-{st}.png')
        if not os.path.exists(p): print('missing', p); return
        sp = Image.open(p)
        h = int(H * FR[st]); w = int(sp.width * h / sp.height)
        items.append((sp.resize((w, h), Image.LANCZOS), w, h))
        total_w += w + 45
    canvas = Image.new('RGBA', (total_w, H), (246, 239, 219, 255))
    x = 40
    for sp, w, h in items:
        canvas.alpha_composite(sp, (x, H - 50 - h)); x += w + 45
    canvas.convert('RGB').save(os.path.join(DEST, fname))
    print('sheet', fname, canvas.size)

S6 = ['03', '08', '15', '25', '45', '70']
sheet('char-a-m', S6, 'sheet-a-m.png')
sheet('char-b-m', S6, 'sheet-b-m-v1.png')
sheet('char-b-m-v2', S6, 'sheet-b-m-v2.png')
sheet('char-c-m', S6, 'sheet-c-m.png')
sheet('char-a-f', S6, 'sheet-a-f.png')
sheet('char-b-f', S6, 'sheet-b-f.png')
sheet('char-c-f', S6, 'sheet-c-f.png')
sheet('char-d-f', S6, 'sheet-d-f.png')
# 父母拼一张
H = 900
items = []
total_w = 60
for prefix, stages in [('char-dad', ['30', '50', '75']), ('char-mom', ['28', '48', '72'])]:
    for st in stages:
        sp = Image.open(os.path.join(KEYED, f'{prefix}-{st}.png'))
        h = int(H * FR[st]); w = int(sp.width * h / sp.height)
        items.append((sp.resize((w, h), Image.LANCZOS), w, h)); total_w += w + 45
canvas = Image.new('RGBA', (total_w, H), (246, 239, 219, 255))
x = 40
for sp, w, h in items:
    canvas.alpha_composite(sp, (x, H - 50 - h)); x += w + 45
canvas.convert('RGB').save(os.path.join(DEST, 'sheet-parents.png'))
print('sheet sheet-parents.png', canvas.size)
