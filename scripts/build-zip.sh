#!/bin/bash
# Build a Chrome Web Store zip with manifest.json at the archive root.
# Excludes docs, helper scripts, the large marketing PNG, and other dev files.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')"
name="ollama-web-summarizer-${version}.zip"
dist="${root}/dist"
stage="${dist}/package"

rm -rf "${stage}"
mkdir -p "${stage}/src" "${stage}/icons"

cp manifest.json "${stage}/manifest.json"
cp src/background.js src/content.js src/popup.css src/popup.html src/popup.js src/shared.js "${stage}/src/"
cp icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png icons/llama-chat.png "${stage}/icons/"

# Confirm required files exist and icons are the declared sizes.
python3 - "${stage}" << 'PY'
import json, sys
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    Image = None

stage = Path(sys.argv[1])
manifest = json.loads((stage / "manifest.json").read_text())
missing = []
for key, path in manifest.get("icons", {}).items():
    full = stage / path
    if not full.is_file():
        missing.append(path)
        continue
    if Image:
        with Image.open(full) as im:
            expected = int(key)
            if im.size != (expected, expected):
                raise SystemExit(f"Icon {path} is {im.size}, expected {expected}x{expected}")
if missing:
    raise SystemExit("Missing packaged files: " + ", ".join(missing))
print("Package checks passed.")
PY

mkdir -p "${dist}"
out="${dist}/${name}"
rm -f "${out}"
# Zip from the staged root so manifest.json is at the top of the archive.
python3 - "${stage}" "${out}" << 'PYZIP'
import sys, zipfile
from pathlib import Path
stage, out = Path(sys.argv[1]), Path(sys.argv[2])
with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(stage.rglob("*")):
        if not path.is_file():
            continue
        if path.name == ".DS_Store":
            continue
        zf.write(path, path.relative_to(stage).as_posix())
print("Wrote", out)
PYZIP
python3 - "${out}" << 'PY'
import sys, zipfile
path = sys.argv[1]
with zipfile.ZipFile(path) as zf:
    names = zf.namelist()
    print(f"Wrote {path}")
    print(f"Files: {len(names)}")
    if "manifest.json" not in names:
        raise SystemExit("manifest.json is not at the zip root")
    blocked = [n for n in names if n.startswith("docs/") or n.startswith("scripts/") or n.endswith(".md") or "Ollama-Summarizer.png" in n]
    if blocked:
        raise SystemExit("Zip contains excluded files: " + ", ".join(blocked))
    print("Size bytes:", __import__("pathlib").Path(path).stat().st_size)
    for name in sorted(names):
        print(" ", name, zf.getinfo(name).file_size)
PY
