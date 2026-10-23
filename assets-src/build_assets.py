"""把抠像精灵与背景板打包进 public/assets（游戏运行时素材）。
精灵：高度 640 的 webp（带 alpha）；背景板：宽 1440 的 webp。
精灵源 = keyed2（模板派生批，2026-10-23：10 张阶段模板锁定骨架，48 张全员派生）。"""
from PIL import Image
import os, glob

ROOT = os.path.expanduser('~/workspace/born-in-time')
KEYED = os.path.join(ROOT, 'assets-src/keyed2')
PUB = os.path.join(ROOT, 'public/assets')
os.makedirs(os.path.join(PUB, 'sprites'), exist_ok=True)
os.makedirs(os.path.join(PUB, 'plates'), exist_ok=True)

def save_sprite(src_png, out_name):
    im = Image.open(src_png)
    w = int(im.width * 640 / im.height)
    im.resize((w, 640), Image.LANCZOS).save(os.path.join(PUB, 'sprites', out_name), 'WEBP', quality=88, method=6)
    print('sprite', out_name)

SETS = {
    'am': ['03', '08', '15', '25', '45', '70'],
    'bm': ['03', '08', '15', '25', '45', '70'],
    'cm': ['03', '08', '15', '25', '45', '70'],
    'af': ['03', '08', '15', '25', '45', '70'],
    'bf': ['03', '08', '15', '25', '45', '70'],
    'cf': ['03', '08', '15', '25', '45', '70'],
    'df': ['03', '08', '15', '25', '45', '70'],
    'dad': ['30', '50', '75'],
    'mom': ['28', '48', '72'],
}
for set_id, stages in SETS.items():
    for stage in stages:
        save_sprite(os.path.join(KEYED, f'{set_id}-{stage}.png'), f'{set_id}-{stage}.webp')

PLATES = {
    'yard-film': 'media-generation-plate-yard-film-0-7460b47c-abdc-4a51-9810-264ffeecb491.webp',
    'street-calendar': 'media-generation-plate-street-calendar-0-92f4f6af-f122-4b18-9f47-8d92080da1b6.webp',
    'street-digital': 'media-generation-plate-street-digital-0-f648d250-a8c9-44eb-85f8-1399d16ebfd7.webp',
}
for name, fn in PLATES.items():
    im = Image.open(os.path.join(ROOT, 'assets-src/plates', fn)).convert('RGB')
    h = int(im.height * 1440 / im.width)
    im.resize((1440, h), Image.LANCZOS).save(os.path.join(PUB, 'plates', name + '.webp'), 'WEBP', quality=84, method=6)
    print('plate', name, im.size)
