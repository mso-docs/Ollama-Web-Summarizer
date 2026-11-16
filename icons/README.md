# Extension icons

The Chrome Web Store and Chrome itself need raster PNG icons at the exact sizes declared in `manifest.json`:

- `icon16.png` — 16×16, toolbar
- `icon32.png` — 32×32, Windows and high-DPI toolbars
- `icon48.png` — 48×48, `chrome://extensions`
- `icon128.png` — 128×128, installation and the store listing. The artwork sits in a 96×96 area with 16 pixels of transparent padding, per Chrome’s store icon guidelines.

`llama-chat.png` is the small header image in the popup. `Ollama-Summarizer.png` is marketing art for the README. It is not packed into the store zip.

To regenerate the sized icons from the source art, run `scripts/create-icons.sh` (requires Python and Pillow).
