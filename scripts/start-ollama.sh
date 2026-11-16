#!/bin/bash
# Allow this browser extension (and, optionally, Firefox) to call local Ollama.
# After the extension is on the Chrome Web Store, replace the wildcard with the
# published ID, for example:
#   export OLLAMA_ORIGINS="chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"
# Do not use OLLAMA_ORIGINS="*". That lets any website call your local Ollama API.
set -euo pipefail
export OLLAMA_ORIGINS="${OLLAMA_ORIGINS:-chrome-extension://*,moz-extension://*}"
echo "Starting Ollama with OLLAMA_ORIGINS=${OLLAMA_ORIGINS}"
exec ollama serve
