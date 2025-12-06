# Ollama Web Summarizer Chrome Extension

![Ollama Summarizer Logo](icons/Ollama-Summarizer.png)

A Chrome extension that uses local Ollama to summarize web content and chat about it.

## Project Structure

```
ollama-ext/
├── manifest.json          # Extension manifest
├── README.md              # Main documentation
├── src/                   # Source code
│   ├── background.js      # Service worker for API calls
│   ├── content.js         # Content script for page interaction
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles with theme support
│   └── popup.js           # Popup logic and theme system
├── icons/                 # Image assets
│   ├── background-llama.png
│   ├── llama-chat.png
│   ├── icon128.svg
│   └── Ollama-Summarizer.png
├── scripts/               # Helper scripts
│   ├── start-ollama.bat   # Windows Ollama startup
│   ├── start-ollama.sh    # Unix Ollama startup
│   └── create-icons.sh    # Icon generation script
└── docs/                  # Documentation
    └── INSTALLATION.md    # Detailed setup guide
```

## Features

- 📄 **Summarize any web page** - Click the extension to get instant summaries
- 💬 **Interactive chat** - Ask follow-up questions about the content
- ✨ **Text selection popup** - Highlight text to summarize, explain, or ask questions
- 🖱️ **Right-click context menu** - Quick access to AI features on any text
- ⚡ **Real-time streaming** - See responses as they're generated with "I'm thinking..." indicators
- 🔄 **Multiple models** - Switch between llama3.2, deepseek-r1, qwen3, and more
- 🔒 **100% local** - All processing happens on your machine via Ollama
- 🚀 **No external API calls** - Complete privacy

## Prerequisites

- [Ollama](https://ollama.ai) installed and running locally
- A model installed (e.g., `llama2`, `mistral`, `phi`)

## Installation

1. Make sure Ollama is running: `ollama serve`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `ollama-ext` folder

## Usage

1. Navigate to any webpage
2. Click the extension icon in your Chrome toolbar
3. Click "Summarize Page" to get a summary
4. Use the chat below to ask follow-up questions about the content

## Configuration

You can change the Ollama model in the extension popup. Default is `llama2`.

## Troubleshooting

- **Connection Error**: Make sure Ollama is running (`ollama serve`)
- **CORS Error**: Ollama should allow localhost connections by default
- **No Summary**: Try refreshing the page and clicking the extension again
