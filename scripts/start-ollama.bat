@echo off
REM Set OLLAMA_ORIGINS to allow Chrome extension access
set OLLAMA_ORIGINS=*
ollama serve
