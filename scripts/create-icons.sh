#!/bin/bash
# Rebuild the toolbar and store icons from the high-resolution llama art.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

python3 - << 'PY'
from pathlib import Path
from PIL import Image

root = Path('.').resolve()
# Prefer a cropped high-res source if present next to the marketing banner.
src_path = root / 'icons' / 'Ollama-Summarizer.png'
if not src_path.is_file():
    raise SystemExit('icons/Ollama-Summarizer.png is missing')

im = Image.open(src_path).convert('RGBA')
px = im.load()
w, h = im.size

def is_teal(r, g, b, a, tol=25):
    return a >= 200 and abs(r - 61) < tol and abs(g - 131) < tol and abs(b - 136) < tol

xs, ys = [], []
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if is_teal(r, g, b, a):
            xs.append(x)
            ys.append(y)
if not xs:
    raise SystemExit('Could not find the llama icon in the source art')
x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
src = im.crop((x0, y0, x1 + 1, y1 + 1))

def fit_square(image, size, padding=0):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    inner = max(1, size - padding * 2)
    fitted = image.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas

# 128 is the Chrome Web Store icon: 96px artwork with 16px transparent padding.
outputs = {
    'icon16.png': (16, 0),
    'icon32.png': (32, 1),
    'icon48.png': (48, 2),
    'icon128.png': (128, 16),
}
for name, (size, padding) in outputs.items():
    dest = root / 'icons' / name
    fit_square(src, size, padding).save(dest, 'PNG', optimize=True)
    print('Wrote', dest)
PY
