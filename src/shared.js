'use strict';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const CONTENT_CHAR_LIMIT = 8000;
const DEFAULT_THEME = 'purple-light';

const THEMES = {
  'light': { primary: '#6366f1', secondary: '#4f46e5', bg: '#ffffff', text: '#1f2937', cardBg: '#ffffff', tabBg: '#ffffff', dark: false },
  'dark': { primary: '#818cf8', secondary: '#6366f1', bg: '#1a1a1a', text: '#f3f4f6', cardBg: '#1a1a1a', tabBg: '#1a1a1a', dark: true },
  'purple-light': { primary: '#667eea', secondary: '#764ba2', bg: '#ffffff', text: '#1f2937', cardBg: '#ffffff', tabBg: '#ffffff', dark: false },
  'purple-dark': { primary: '#7c3aed', secondary: '#9333ea', bg: '#1a1a1a', text: '#e0e0e0', cardBg: '#1a1a1a', tabBg: '#1a1a1a', dark: true },
  'blue-light': { primary: '#3b82f6', secondary: '#2563eb', bg: '#ffffff', text: '#1e293b', cardBg: '#ffffff', tabBg: '#ffffff', dark: false },
  'blue-dark': { primary: '#60a5fa', secondary: '#3b82f6', bg: '#1a1a1a', text: '#e2e8f0', cardBg: '#1a1a1a', tabBg: '#1a1a1a', dark: true },
  'green-light': { primary: '#10b981', secondary: '#059669', bg: '#ffffff', text: '#064e3b', cardBg: '#ffffff', tabBg: '#ffffff', dark: false },
  'green-dark': { primary: '#34d399', secondary: '#10b981', bg: '#1a1a1a', text: '#d1fae5', cardBg: '#1a1a1a', tabBg: '#1a1a1a', dark: true },
  'teal-light': { primary: '#14b8a6', secondary: '#0d9488', bg: '#ffffff', text: '#134e4a', cardBg: '#ffffff', tabBg: '#ffffff', dark: false },
  'teal-dark': { primary: '#2dd4bf', secondary: '#14b8a6', bg: '#1a1a1a', text: '#ccfbf1', cardBg: '#1a1a1a', tabBg: '#1a1a1a', dark: true },
  'red-light': { primary: '#ef4444', secondary: '#dc2626', bg: '#ffffff', text: '#7f1d1d', cardBg: '#ffffff', tabBg: '#ffffff', dark: false },
  'red-dark': { primary: '#f87171', secondary: '#ef4444', bg: '#1a1a1a', text: '#fee2e2', cardBg: '#1a1a1a', tabBg: '#1a1a1a', dark: true }
};

function getTheme(name) {
  return THEMES[name] || THEMES[DEFAULT_THEME];
}

function parseOllamaUrl(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:') {
      return null;
    }
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return null;
    }
    if (url.username || url.password) {
      return null;
    }
    if (url.pathname && url.pathname !== '/') {
      return null;
    }
    if (url.search || url.hash) {
      return null;
    }
    const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
    return `http://${host}`;
  } catch (error) {
    return null;
  }
}

function connectionErrorMessage(error) {
  const detail = error && error.message ? error.message : 'Network request failed';
  return (
    'Cannot connect to Ollama. Start Ollama on this computer and try again. ' +
    'If this is your first time, install Ollama, pull a model (for example, ollama pull llama3.2), ' +
    'and set OLLAMA_ORIGINS for this extension. Details: ' + detail
  );
}

async function httpErrorMessage(response, model) {
  let body = '';
  try {
    body = (await response.text()).trim();
  } catch (error) {
    body = 'Unknown error';
  }

  let message = `Ollama API error (${response.status}): ${body || response.statusText || 'Unknown error'}`;

  if (response.status === 403) {
    message +=
      '\n\nThis is usually a CORS block. Set OLLAMA_ORIGINS to this extension\'s origin ' +
      '(chrome-extension:// followed by the ID shown on chrome://extensions) and restart Ollama. ' +
      'Do not set OLLAMA_ORIGINS to *.';
  } else if (response.status === 404) {
    if (model) {
      message += `\n\nModel "${model}" was not found. Select an installed model or run: ollama pull ${model}`;
    }
  } else if (response.status === 0 || response.status >= 500) {
    message += '\n\nOllama may be starting up or busy. Wait a moment and try again.';
  }

  return message;
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    if (url.username || url.password) {
      return false;
    }
    return Boolean(url.hostname);
  } catch (error) {
    return false;
  }
}

function formatSize(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) {
    return '';
  }
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return gb.toFixed(1) + ' GB';
  }
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(0) + ' MB';
}

function appendInline(parent, text) {
  const pattern = /(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+`|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_|https?:\/\/[^\s<]+)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      const el = document.createElement('strong');
      el.textContent = token.slice(2, -2);
      parent.appendChild(el);
    } else if (token.startsWith('`')) {
      const el = document.createElement('code');
      el.textContent = token.slice(1, -1);
      parent.appendChild(el);
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      const cleaned = token.replace(/[.,;!?)]+$/, '');
      const punctuation = token.slice(cleaned.length);
      if (isSafeHttpUrl(cleaned)) {
        const link = document.createElement('a');
        link.href = cleaned;
        link.textContent = cleaned;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'chat-link';
        parent.appendChild(link);
      } else {
        parent.appendChild(document.createTextNode(token));
      }
      if (punctuation) {
        parent.appendChild(document.createTextNode(punctuation));
      }
    } else {
      const el = document.createElement('em');
      el.textContent = token.slice(1, -1);
      parent.appendChild(el);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function renderRichText(target, text) {
  if (!target) {
    return;
  }
  target.replaceChildren();
  if (!text) {
    return;
  }
  const lines = String(text).split('\n');
  let list = null;
  lines.forEach((line, index) => {
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) {
      const tag = bullet ? 'UL' : 'OL';
      if (!list || list.tagName !== tag) {
        list = document.createElement(bullet ? 'ul' : 'ol');
        target.appendChild(list);
      }
      const item = document.createElement('li');
      appendInline(item, (bullet || numbered)[1]);
      list.appendChild(item);
      return;
    }
    list = null;
    if (line === '') {
      target.appendChild(document.createElement('br'));
      return;
    }
    const span = document.createElement('span');
    appendInline(span, line);
    target.appendChild(span);
    if (index < lines.length - 1) {
      target.appendChild(document.createElement('br'));
    }
  });
}

async function readNdjsonStream(response, onObject, signal) {
  if (!response.body) {
    throw new Error('Ollama did not return a response stream.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal && signal.aborted) {
        try {
          await reader.cancel();
        } catch (error) {
          // Ignore cancel errors.
        }
        throw new DOMException('Aborted', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        let data;
        try {
          data = JSON.parse(trimmed);
        } catch (error) {
          continue;
        }
        if (data.error) {
          throw new Error(String(data.error));
        }
        await onObject(data);
      }
    }
    const leftover = buffer.trim();
    if (leftover) {
      try {
        const data = JSON.parse(leftover);
        if (data.error) {
          throw new Error(String(data.error));
        }
        await onObject(data);
      } catch (error) {
        if (error.name !== 'SyntaxError') {
          throw error;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (error) {
      // Already released.
    }
  }
}

async function getExtensionSettings() {
  const stored = await chrome.storage.local.get(['ollamaUrl', 'model', 'theme']);
  return {
    ollamaUrl: parseOllamaUrl(stored.ollamaUrl) || DEFAULT_OLLAMA_URL,
    model: stored.model || '',
    theme: stored.theme && THEMES[stored.theme] ? stored.theme : DEFAULT_THEME
  };
}
