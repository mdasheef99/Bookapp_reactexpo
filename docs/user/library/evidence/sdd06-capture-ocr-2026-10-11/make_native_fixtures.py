"""Synthetic test images only; no personal photos or copied book text."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

out = Path(__file__).parent / 'fixtures'
out.mkdir(exist_ok=True)
grid = Image.new('RGB', (120, 80))
for y in range(80):
    for x in range(120):
        grid.putpixel((x, y), (240, 30, 40) if x < 40 and y < 40 else (20, 200, 60) if y < 40 else (30, 70, 230) if x < 40 else (240, 200, 20))
grid.save(out / 'regions.png')
exif = Image.Exif(); exif[274] = 6
grid.save(out / 'oriented-regions.jpg', quality=100, subsampling=0, exif=exif)

page = Image.new('RGB', (1600, 2200), 'white')
draw = ImageDraw.Draw(page)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 38)
heading = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 48)
draw.text((200, 170), 'OUTSIDE TOP SENTINEL', font=heading, fill='black')
draw.text((200, 1860), 'OUTSIDE BOTTOM SENTINEL', font=heading, fill='black')
lines = [
    'A PAGE FOR CAREFUL READING', '',
    'A reader walks into a quiet library and chooses a book.',
    'The morning light falls across the open page.',
    'Each paragraph gives the reader time to pause.',
    'Clear words can carry a useful idea without haste.', '',
    'Before making a note, the reader checks the source.',
    'A question may matter as much as an answer.',
    'A short reflection can connect a page to daily life.',
    'The chosen passage stays inside the outlined area.', '',
    'Reading is a patient practice of attention.',
    'This synthetic page contains no private information.',
    'Its text was written only to verify local recognition.',
]
for index, line in enumerate(lines):
    draw.text((200, 500 + index * 62), line, font=heading if index == 0 else font, fill='black')
page.save(out / 'english-page.png')
(out / 'fixture-oracle.json').write_text(json.dumps({
    'regions': {'source': [120, 80], 'crop': [30, 20, 60, 40]},
    'exif6': {'decoded': [80, 120], 'clockwise90': [120, 80]},
    'english': {'source': [1600, 2200], 'selection': [160, 440, 1280, 1100], 'expected_lines': lines, 'excluded': ['OUTSIDE TOP SENTINEL', 'OUTSIDE BOTTOM SENTINEL']},
}, indent=2))
