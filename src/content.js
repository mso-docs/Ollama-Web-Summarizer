'use strict';

(() => {
  const ROOT_ID = 'ows-root';
  const TOOLBAR_DELAY_MS = 250;
  const MIN_SELECTION_LENGTH = 3;

  let shadowRoot = null;
  let floatingPopup = null;
  let selectionToolbar = null;
  let selectionTimeout = null;
  let activeGenerate = null;

  const FLOATING_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    [hidden] { display: none !important; }
    .toolbar {
      position: fixed;
      display: flex;
      gap: 4px;
      padding: 6px;
      border-radius: 8px;
      z-index: 2147483647;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      background: var(--ows-card, #ffffff);
      border: 1px solid var(--ows-border, rgba(0, 0, 0, 0.1));
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .toolbar button {
      appearance: none;
      -webkit-appearance: none;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      cursor: pointer;
      background-color: var(--ows-primary, #667eea);
    }
    .toolbar button:hover,
    .toolbar button:focus-visible {
      background: var(--ows-secondary, #764ba2);
    }
    .toolbar button:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    .popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(500px, 90vw);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      overflow: hidden;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      background: var(--ows-card, #fff);
      color: var(--ows-text, #1f2937);
      border: 1px solid var(--ows-border, rgba(0, 0, 0, 0.1));
    }
    .popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      color: #fff;
      background: linear-gradient(135deg, var(--ows-primary, #667eea) 0%, var(--ows-secondary, #764ba2) 100%);
    }
    .popup-title { font-weight: 600; font-size: 16px; color: #fff; }
    .popup-close, .popup-cancel {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #fff;
      font-size: 16px;
      min-width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
    }
    .popup-close:hover, .popup-cancel:hover,
    .popup-close:focus-visible, .popup-cancel:focus-visible {
      background: rgba(255, 255, 255, 0.35);
    }
    .popup-content {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(80vh - 60px);
      font-size: 14px;
      line-height: 1.6;
      color: var(--ows-text, #1f2937);
    }
    .loading { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .spinner {
      width: 20px; height: 20px;
      border: 3px solid rgba(127, 127, 127, 0.3);
      border-top-color: var(--ows-primary, #667eea);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .result { white-space: pre-wrap; word-wrap: break-word; }
    .result a { color: var(--ows-primary, #667eea); }
    .error { color: #b91c1c; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;
    }
  `;

  function ensureShadow() {
    let host = document.getElementById(ROOT_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = ROOT_ID;
      host.style.all = 'initial';
      host.style.position = 'fixed';
      host.style.zIndex = '2147483647';
      host.style.top = '0';
      host.style.left = '0';
      host.style.width = '0';
      host.style.height = '0';
      (document.documentElement || document.body).appendChild(host);
      shadowRoot = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = FLOATING_CSS;
      shadowRoot.appendChild(style);
    } else if (!shadowRoot) {
      shadowRoot = host.shadowRoot;
    }
    return shadowRoot;
  }

  function applyThemeVars(el, theme) {
    el.style.setProperty('--ows-primary', theme.primary);
    el.style.setProperty('--ows-secondary', theme.secondary);
    el.style.setProperty('--ows-card', theme.cardBg);
    el.style.setProperty('--ows-text', theme.text);
    el.style.setProperty('--ows-border', theme.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)');
  }

  function extractPageContent() {
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content'
    ];
    let content = '';
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText) {
        content = element.innerText;
        break;
      }
    }
    if (!content && document.body) {
      content = document.body.innerText || '';
    }
    content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
    return {
      title: document.title || '',
      content: content.substring(0, CONTENT_CHAR_LIMIT)
    };
  }

  function hideSelectionToolbar() {
    if (selectionToolbar) {
      selectionToolbar.remove();
      selectionToolbar = null;
    }
  }

  function isEventInOurUi(event) {
    const host = document.getElementById(ROOT_ID);
    return Boolean(host && (event.target === host || (event.composedPath && event.composedPath().includes(host))));
  }

  function getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return { text: '', rect: null };
    }
    const text = selection.toString().trim();
    if (!text || text.length < MIN_SELECTION_LENGTH) {
      return { text: '', rect: null };
    }
    const range = selection.getRangeAt(0);
    return { text, rect: range.getBoundingClientRect() };
  }

  function showSelectionToolbar() {
    const { text, rect } = getSelectedText();
    if (!text || !rect) {
      hideSelectionToolbar();
      return;
    }

    const root = ensureShadow();
    hideSelectionToolbar();

    chrome.storage.local.get(['theme'], (stored) => {
      const theme = getTheme(stored.theme);
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      toolbar.setAttribute('role', 'toolbar');
      toolbar.setAttribute('aria-label', 'Ollama Web Summarizer');
      applyThemeVars(toolbar, theme);

      const actions = [
        { action: 'summarize', label: 'Summarize' },
        { action: 'explain', label: 'Explain' },
        { action: 'chat', label: 'Ask' }
      ];
      actions.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = item.action;
        button.textContent = item.label;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (item.action === 'chat') {
            const question = window.prompt('Ask a question about the selected text:');
            if (question && question.trim()) {
              createFloatingPopup(text, 'chat', question.trim());
            }
          } else {
            createFloatingPopup(text, item.action);
          }
          hideSelectionToolbar();
        });
        toolbar.appendChild(button);
      });

      let top = rect.bottom + 8;
      let left = rect.left;
      root.appendChild(toolbar);
      const width = toolbar.offsetWidth || 280;
      const height = toolbar.offsetHeight || 36;
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, rect.top - height - 8);
      }
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      if (left < 8) {
        left = 8;
      }
      toolbar.style.top = `${Math.round(top)}px`;
      toolbar.style.left = `${Math.round(left)}px`;
      selectionToolbar = toolbar;
    });
  }

  function closeFloatingPopup() {
    if (activeGenerate && activeGenerate.abort) {
      activeGenerate.abort();
      activeGenerate = null;
    }
    if (floatingPopup) {
      floatingPopup.remove();
      floatingPopup = null;
    }
  }

  function createFloatingPopup(text, type, question = '') {
    closeFloatingPopup();
    const root = ensureShadow();
    const titles = {
      summarize: 'Summary',
      explain: 'Explanation',
      chat: 'Question'
    };

    chrome.storage.local.get(['theme'], (stored) => {
      const theme = getTheme(stored.theme);
      const popup = document.createElement('div');
      popup.className = 'popup';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-modal', 'true');
      popup.setAttribute('aria-labelledby', 'ows-popup-title');
      applyThemeVars(popup, theme);

      const header = document.createElement('div');
      header.className = 'popup-header';

      const title = document.createElement('span');
      title.className = 'popup-title';
      title.id = 'ows-popup-title';
      title.textContent = titles[type] || 'Ollama';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'popup-cancel';
      cancelBtn.textContent = 'Stop';
      cancelBtn.hidden = true;

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'popup-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.textContent = '✕';

      header.appendChild(title);
      header.appendChild(cancelBtn);
      header.appendChild(closeBtn);

      const content = document.createElement('div');
      content.className = 'popup-content';

      const loading = document.createElement('div');
      loading.className = 'loading';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      const loadingText = document.createElement('span');
      loadingText.textContent = "I'm thinking...";
      loading.appendChild(spinner);
      loading.appendChild(loadingText);

      const result = document.createElement('div');
      result.className = 'result';
      result.hidden = true;
      result.setAttribute('aria-live', 'polite');

      content.appendChild(loading);
      content.appendChild(result);
      popup.appendChild(header);
      popup.appendChild(content);
      root.appendChild(popup);
      floatingPopup = popup;
      closeBtn.focus();

      const onKey = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          teardown();
        }
      };
      popup.addEventListener('keydown', onKey);

      const teardown = () => {
        document.removeEventListener('keydown', onDocKey, true);
        closeFloatingPopup();
      };
      const onDocKey = (event) => {
        if (event.key === 'Escape') {
          teardown();
        }
      };
      document.addEventListener('keydown', onDocKey, true);
      closeBtn.addEventListener('click', teardown);

      cancelBtn.addEventListener('click', () => {
        if (activeGenerate && activeGenerate.abort) {
          activeGenerate.abort();
        }
      });

      let prompt;
      if (type === 'summarize') {
        prompt = `Please provide a brief, clear summary of the following text:\n\n"${text}"`;
      } else if (type === 'explain') {
        prompt = `Please explain the following text in simple terms:\n\n"${text}"`;
      } else if (type === 'chat' && question) {
        prompt = `Based on this text: "${text}"\n\nQuestion: ${question}`;
      } else {
        prompt = text;
      }

      const handle = generateWithOllama(prompt, '', (fullText) => {
        loading.hidden = true;
        result.hidden = false;
        renderRichText(result, fullText);
      });
      activeGenerate = handle;
      cancelBtn.hidden = false;

      handle.promise.then((fullText) => {
        loading.hidden = true;
        result.hidden = false;
        renderRichText(result, fullText);
        cancelBtn.hidden = true;
        if (activeGenerate === handle) {
          activeGenerate = null;
        }
      }).catch((error) => {
        if (error && error.name === 'AbortError') {
          loading.hidden = true;
          result.hidden = false;
          result.classList.add('error');
          result.textContent = 'Stopped.';
        } else {
          loading.hidden = true;
          result.hidden = false;
          result.classList.add('error');
          result.textContent = error && error.message ? error.message : 'Failed to process text.';
        }
        cancelBtn.hidden = true;
        if (activeGenerate === handle) {
          activeGenerate = null;
        }
      });
    });
  }

  function generateWithOllama(prompt, context, onUpdate) {
    const port = chrome.runtime.connect({ name: 'ollama-generate' });
    const requestId = `sel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let settled = false;
    let fullText = '';

    const promise = new Promise((resolve, reject) => {
      port.onMessage.addListener((message) => {
        if (!message || message.requestId !== requestId) {
          return;
        }
        if (message.type === 'chunk') {
          fullText += message.chunk || '';
          if (onUpdate) {
            onUpdate(fullText);
          }
        } else if (message.type === 'done') {
          settled = true;
          port.disconnect();
          resolve(fullText);
        } else if (message.type === 'aborted') {
          settled = true;
          port.disconnect();
          reject(new DOMException('Aborted', 'AbortError'));
        } else if (message.type === 'error') {
          settled = true;
          port.disconnect();
          reject(new Error(message.error || 'Unknown error'));
        }
      });
      port.onDisconnect.addListener(() => {
        if (!settled) {
          settled = true;
          const err = chrome.runtime.lastError;
          reject(new Error(err && err.message ? err.message : 'Lost connection to the extension.'));
        }
      });
      port.postMessage({ action: 'generate', requestId, prompt, context });
    });

    return {
      promise,
      abort() {
        if (!settled) {
          try {
            port.postMessage({ action: 'abort', requestId });
            port.disconnect();
          } catch (error) {
            // Already disconnected.
          }
        }
      }
    };
  }

  document.addEventListener('mouseup', (event) => {
    if (isEventInOurUi(event)) {
      return;
    }
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      showSelectionToolbar();
    }, TOOLBAR_DELAY_MS);
  }, true);

  document.addEventListener('mousedown', (event) => {
    if (!isEventInOurUi(event)) {
      hideSelectionToolbar();
    }
  }, true);

  document.addEventListener('scroll', () => {
    hideSelectionToolbar();
  }, true);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || typeof request !== 'object') {
      return false;
    }
    if (request.action === 'getPageContent') {
      sendResponse(extractPageContent());
      return false;
    }
    if (request.action === 'showPopup') {
      createFloatingPopup(request.text || '', request.type || 'summarize');
      sendResponse({ success: true });
      return false;
    }
    return false;
  });
})();
