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

PLATE_STEMS = [
    'yard-film', 'yard-calendar', 'yard-digital', 'street-calendar', 'street-digital',
    'classroom-film', 'classroom-calendar', 'classroom-digital',
    'factory-film', 'factory-calendar', 'factory-digital',
    'rental-film', 'rental-calendar', 'rental-digital',
    'living-film', 'living-calendar', 'living-digital',
    'office-calendar', 'office-digital', 'late-digital',
]
for name in PLATE_STEMS:
    hits = glob.glob(os.path.join(ROOT, 'assets-src/plates2', f'media-generation-plate-{name}-0-*.webp'))
    assert hits, f'plate missing: {name}'
    im = Image.open(hits[0]).convert('RGB')
    h = int(im.height * 1440 / im.width)
    im.resize((1440, h), Image.LANCZOS).save(os.path.join(PUB, 'plates', name + '.webp'), 'WEBP', quality=84, method=6)
    print('plate', name, im.size)

# 证件照（2026-10-23 新增）：源图 assets-src/idphotos/<set>-<stage>.png（1344×1792 生图），
# 打包为 336×448 webp（身份证卡显示 56×75，6 倍图保 Retina 清晰度）
os.makedirs(os.path.join(PUB, 'idphotos'), exist_ok=True)
for set_id in ['am', 'bm', 'cm', 'af', 'bf', 'cf', 'df']:
    for stage in SETS[set_id]:
        src = os.path.join(ROOT, 'assets-src/idphotos', f'{set_id}-{stage}.png')
        assert os.path.exists(src), f'idphoto missing: {set_id}-{stage}'
        im = Image.open(src).convert('RGB')
        im.resize((336, 448), Image.LANCZOS).save(os.path.join(PUB, 'idphotos', f'{set_id}-{stage}.webp'), 'WEBP', quality=85, method=6)
        print('idphoto', set_id, stage)
