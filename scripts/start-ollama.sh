#!/bin/bash
# Set OLLAMA_ORIGINS to allow Chrome extension access
export OLLAMA_ORIGINS="*"
ollama serve
