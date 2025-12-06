# Installation Guide

## Quick Setup (5 minutes)

### Step 1: Prepare Icons

Place your icon images in the `icons/` folder:
- `background-llama.png` - Extension icon
- `llama-chat.png` - Chat icon in the popup header

The extension needs these two image files to display properly.

### Step 2: Start Ollama
```bash
ollama serve
```

Make sure you have a model installed:
```bash
ollama pull llama2
```

### Step 3: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right corner)
4. Click "Load unpacked"
5. Select the `ollama-ext` folder
6. The extension icon should appear in your toolbar

### Step 4: Test It

1. Navigate to any article or webpage (e.g., Wikipedia, news article)
2. Click the extension icon
3. Click "Summarize Page"
4. Wait for the summary
5. Ask questions in the chat!

## Troubleshooting

### "Could not access page content"
- Refresh the webpage and try again
- Some pages (like chrome:// URLs) can't be accessed by extensions

### "Ollama API error"
- Make sure Ollama is running: `ollama serve`
- Check that Ollama is accessible at http://localhost:11434
- Try: `curl http://localhost:11434/api/tags`

### "Model not found"
- Install the model: `ollama pull llama2`
- Or change to a model you have in the extension dropdown

### Extension not loading
- Make sure all files are in the correct location
- Check for icon files in the `icons/` folder
- Look at Chrome's extension error console for details

## Customization

### Change Default Model
Edit `background.js` line 7 to change from `llama2` to your preferred model.

### Adjust Content Length
Edit `content.js` line 37 to increase/decrease the character limit (default: 8000).

### Change Ollama URL
If Ollama runs on a different port, update the URL in the extension popup settings or in `background.js`.

## Tips

- The extension works best on text-heavy pages (articles, blogs, documentation)
- For long articles, the summary may take 10-30 seconds
- You can switch models anytime from the dropdown in the popup
- Chat history is maintained per session
