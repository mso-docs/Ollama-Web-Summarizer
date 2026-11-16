@echo off
REM Allow this browser extension to call local Ollama.
REM After the extension is on the Chrome Web Store, set OLLAMA_ORIGINS to
REM chrome-extension:// followed by the published ID.
REM Do not use OLLAMA_ORIGINS=*. That lets any website call your local Ollama API.
if not defined OLLAMA_ORIGINS set OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*
echo Starting Ollama with OLLAMA_ORIGINS=%OLLAMA_ORIGINS%
ollama serve
