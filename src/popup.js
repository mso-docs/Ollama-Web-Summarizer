'use strict';

let pageContent = null;
let conversationHistory = [];
let activeRequest = null;
let modalPreviousFocus = null;

const summarizeBtn = document.getElementById('summarizeBtn');
const cancelSummaryBtn = document.getElementById('cancelSummaryBtn');
const sendBtn = document.getElementById('sendBtn');
const cancelChatBtn = document.getElementById('cancelChatBtn');
const chatInput = document.getElementById('chatInput');
const summarySection = document.getElementById('summarySection');
const summaryContent = document.getElementById('summaryContent');
const chatMessages = document.getElementById('chatMessages');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
const chatErrorMessage = document.getElementById('chatErrorMessage');
const statusText = document.getElementById('statusText');
const modelSelect = document.getElementById('modelSelect');
const manageModelsBtn = document.getElementById('manageModelsBtn');
const modelManagerModal = document.getElementById('modelManagerModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const installedModelsList = document.getElementById('installedModelsList');
const installCustomBtn = document.getElementById('installCustomBtn');
const customModelInput = document.getElementById('customModelInput');
const themeSelect = document.getElementById('themeSelect');
const ollamaUrlInput = document.getElementById('ollamaUrlInput');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    tabBtns.forEach((other) => {
      other.classList.toggle('active', other === btn);
      other.setAttribute('aria-selected', other === btn ? 'true' : 'false');
    });
    tabContents.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `${tabName}Tab`);
    });
  });
});

function applyTheme(themeName) {
  const theme = getTheme(themeName);
  const root = document.documentElement;
  root.style.setProperty('--primary-color', theme.primary);
  root.style.setProperty('--secondary-color', theme.secondary);
  root.style.setProperty('--bg-color', theme.bg);
  root.style.setProperty('--text-color', theme.text);
  root.style.setProperty('--card-bg', theme.cardBg);
  root.style.setProperty('--tab-bg', theme.tabBg);
  document.body.style.background = theme.bg;
  document.body.style.color = theme.text;
  document.body.classList.toggle('dark-mode', theme.dark);
}

function showLoading(show) {
  loadingIndicator.classList.toggle('hidden', !show);
  cancelSummaryBtn.classList.toggle('hidden', !show);
  summarizeBtn.disabled = show;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
  errorMessage.textContent = '';
}

function showChatError(message) {
  chatErrorMessage.textContent = message;
  chatErrorMessage.classList.remove('hidden');
}

function hideChatError() {
  chatErrorMessage.classList.add('hidden');
  chatErrorMessage.textContent = '';
}

function showStatus(message) {
  statusText.textContent = message;
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function generateWithOllama(prompt, context, onUpdate) {
  const port = chrome.runtime.connect({ name: 'ollama-generate' });
  const requestId = `popup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function abortActiveRequest() {
  if (activeRequest && activeRequest.abort) {
    activeRequest.abort();
  }
  activeRequest = null;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) {
    throw new Error('No active tab found.');
  }
  return tab;
}

function getPageContentFromTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'getPageContent' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Could not access this page. Try a regular http(s) page, then refresh and try again.'));
        return;
      }
      resolve(response);
    });
  });
}

async function ensurePageContent() {
  if (pageContent && pageContent.content) {
    return pageContent;
  }
  const tab = await getActiveTab();
  pageContent = await getPageContentFromTab(tab.id);
  return pageContent;
}

function setSelectPlaceholder(text) {
  modelSelect.replaceChildren();
  const option = document.createElement('option');
  option.value = '';
  option.textContent = text;
  modelSelect.appendChild(option);
}

async function loadAvailableModels() {
  try {
    const response = await sendMessage({ action: 'listModels' });
    if (!response || !response.success) {
      throw new Error(response && response.error ? response.error : 'Cannot connect to Ollama.');
    }
    const models = response.models || [];
    if (models.length === 0) {
      setSelectPlaceholder('No models installed — run: ollama pull llama3.2');
      showStatus('Ollama is running, but no models are installed.');
      return;
    }

    const settings = await getExtensionSettings();
    modelSelect.replaceChildren();
    models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = String(model.name).replace(/:latest$/, '');
      modelSelect.appendChild(option);
    });

    const available = Array.from(modelSelect.options).map((opt) => opt.value);
    if (settings.model && available.includes(settings.model)) {
      modelSelect.value = settings.model;
    } else {
      modelSelect.value = available[0];
      await chrome.storage.local.set({ model: modelSelect.value });
    }
    showStatus('Ready');
  } catch (error) {
    setSelectPlaceholder('Cannot connect to Ollama');
    showStatus('Ollama is not reachable.');
    console.error('Failed to load models:', error);
  }
}

function buildChatContext() {
  const parts = [];
  if (pageContent) {
    parts.push(`The user is reading a webpage titled "${pageContent.title || 'Untitled'}".`);
    if (pageContent.content) {
      parts.push(`Here is the page content:\n${pageContent.content}`);
    }
  }
  if (conversationHistory.length) {
    const recent = conversationHistory.slice(-8);
    parts.push('Recent conversation:');
    recent.forEach((item) => {
      parts.push(`${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`);
    });
  }
  return parts.join('\n\n');
}

async function summarizePage() {
  abortActiveRequest();
  try {
    showLoading(true);
    hideError();
    showStatus('Summarizing…');

    const currentPage = await ensurePageContent();
    const prompt = `Please provide a concise summary of the following webpage content in 3-5 bullet points:\n\nTitle: ${currentPage.title}\n\nContent: ${currentPage.content}`;

    summaryContent.textContent = "I'm thinking...";
    summarySection.classList.remove('hidden');

    const handle = generateWithOllama(prompt, '', (fullText) => {
      renderRichText(summaryContent, fullText);
    });
    activeRequest = handle;
    const summary = await handle.promise;
    renderRichText(summaryContent, summary);
    conversationHistory = [
      { role: 'system', content: `Webpage title: ${currentPage.title}` },
      { role: 'assistant', content: summary }
    ];
    showStatus('Summary complete.');
  } catch (error) {
    if (error && error.name === 'AbortError') {
      showStatus('Stopped.');
    } else {
      showError(error.message || 'Could not summarize this page.');
      showStatus('Ready');
    }
  } finally {
    activeRequest = null;
    showLoading(false);
  }
}

function addChatMessage(text, role) {
  const welcome = chatMessages.querySelector('.chat-welcome');
  if (welcome) {
    welcome.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;

  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = role === 'user' ? 'You' : 'Assistant';

  const content = document.createElement('div');
  content.className = 'message-content';
  if (role === 'user') {
    content.textContent = text;
  } else {
    renderRichText(content, text);
  }

  messageDiv.appendChild(label);
  messageDiv.appendChild(content);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return content;
}

async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message) {
    return;
  }
  abortActiveRequest();

  try {
    try {
      await ensurePageContent();
    } catch (error) {
      // Chat can still work without page content.
      pageContent = pageContent || { title: '', content: '' };
    }

    addChatMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message });
    chatInput.value = '';
    chatLoadingIndicator.classList.remove('hidden');
    cancelChatBtn.classList.remove('hidden');
    sendBtn.disabled = true;
    hideChatError();
    showStatus('Thinking…');

    const content = addChatMessage("I'm thinking...", 'assistant');

    const handle = generateWithOllama(message, buildChatContext(), (fullText) => {
      renderRichText(content, fullText);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    activeRequest = handle;
    const response = await handle.promise;
    renderRichText(content, response);
    conversationHistory.push({ role: 'assistant', content: response });
    chatMessages.scrollTop = chatMessages.scrollHeight;
    showStatus('Ready');
  } catch (error) {
    if (error && error.name === 'AbortError') {
      showStatus('Stopped.');
    } else {
      showChatError(error.message || 'Could not get a reply.');
      showStatus('Ready');
    }
  } finally {
    activeRequest = null;
    chatLoadingIndicator.classList.add('hidden');
    cancelChatBtn.classList.add('hidden');
    sendBtn.disabled = false;
  }
}

async function loadInstalledModels() {
  installedModelsList.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'loading-models';
  loading.textContent = 'Loading...';
  installedModelsList.appendChild(loading);

  try {
    const response = await sendMessage({ action: 'listModels' });
    if (!response || !response.success) {
      throw new Error(response && response.error ? response.error : 'Cannot connect to Ollama.');
    }
    const models = response.models || [];
    installedModelsList.replaceChildren();
    if (models.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'loading-models';
      empty.textContent = 'No models installed yet';
      installedModelsList.appendChild(empty);
      updatePopularModelsStatus([]);
      return;
    }

    models.forEach((model) => {
      const row = document.createElement('div');
      row.className = 'installed-model-item';

      const info = document.createElement('div');
      const name = document.createElement('span');
      name.className = 'model-name';
      name.textContent = model.name;
      const size = document.createElement('span');
      size.className = 'model-size';
      size.textContent = formatSize(model.size);
      info.appendChild(name);
      info.appendChild(size);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-btn';
      del.textContent = 'Delete';
      del.addEventListener('click', () => deleteModel(model.name));

      row.appendChild(info);
      row.appendChild(del);
      installedModelsList.appendChild(row);
    });
    updatePopularModelsStatus(models.map((model) => model.name));
  } catch (error) {
    installedModelsList.replaceChildren();
    const failed = document.createElement('div');
    failed.className = 'loading-models';
    failed.textContent = 'Cannot connect to Ollama';
    installedModelsList.appendChild(failed);
  }
}

function updatePopularModelsStatus(installedModelNames) {
  document.querySelectorAll('.model-card').forEach((card) => {
    const modelName = card.dataset.model;
    const button = card.querySelector('.install-btn');
    const normalize = (name) => String(name || '').replace(/:latest$/, '');
    const isInstalled = installedModelNames.some((installed) =>
      installed === modelName || normalize(installed) === normalize(modelName)
    );
    if (isInstalled) {
      button.textContent = 'Installed';
      button.disabled = true;
      button.classList.add('installed-btn');
    } else {
      button.textContent = 'Install';
      button.disabled = false;
      button.classList.remove('installed-btn');
    }
  });
}

async function deleteModel(modelName) {
  if (!window.confirm(`Delete ${modelName}? This cannot be undone.`)) {
    return;
  }
  try {
    const response = await sendMessage({ action: 'deleteModel', model: modelName });
    if (!response || !response.success) {
      throw new Error(response && response.error ? response.error : `Failed to delete ${modelName}`);
    }
    showStatus(`${modelName} deleted`);
    await loadAvailableModels();
    await loadInstalledModels();
  } catch (error) {
    showStatus(error.message);
  }
}

function pullModel(modelName, button, progressBar) {
  const progressFill = progressBar.querySelector('.progress-fill');
  const progressText = progressBar.querySelector('.progress-text');
  button.textContent = 'Installing...';
  button.classList.add('installing');
  button.disabled = true;
  progressBar.classList.remove('hidden');

  const port = chrome.runtime.connect({ name: 'ollama-pull' });
  const requestId = `pull-${Date.now()}`;

  port.onMessage.addListener((message) => {
    if (!message || message.requestId !== requestId) {
      return;
    }
    if (message.type === 'progress' && message.data) {
      const data = message.data;
      if (data.total && data.completed) {
        const percent = Math.min(100, Math.round((data.completed / data.total) * 100));
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
      } else if (data.status) {
        progressText.textContent = String(data.status);
      }
      if (data.status === 'success') {
        finish(true);
      }
    } else if (message.type === 'done') {
      finish(true);
    } else if (message.type === 'error') {
      showStatus(message.error || 'Install failed');
      finish(false);
    } else if (message.type === 'aborted') {
      finish(false);
    }
  });

  let finished = false;
  function finish(ok) {
    if (finished) {
      return;
    }
    finished = true;
    try {
      port.disconnect();
    } catch (error) {
      // Ignore.
    }
    if (ok) {
      button.textContent = 'Installed';
      button.classList.add('installed-btn');
      showStatus(`${modelName} installed`);
      setTimeout(() => {
        loadAvailableModels();
        loadInstalledModels();
        button.classList.remove('installing');
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
      }, 800);
    } else {
      button.textContent = 'Install';
      button.classList.remove('installing');
      button.disabled = false;
      progressBar.classList.add('hidden');
      progressFill.style.width = '0%';
      progressText.textContent = '0%';
    }
  }

  port.postMessage({ action: 'pull', requestId, model: modelName });
}

function installModel(modelName, button) {
  const card = button.closest('.model-card') || button.closest('.custom-model-section');
  const progressBar = card.querySelector('.progress-bar');
  pullModel(modelName, button, progressBar);
}

function openModal() {
  modalPreviousFocus = document.activeElement;
  modelManagerModal.classList.remove('hidden');
  closeModalBtn.focus();
  loadInstalledModels();
}

function closeModal() {
  modelManagerModal.classList.add('hidden');
  if (modalPreviousFocus && typeof modalPreviousFocus.focus === 'function') {
    modalPreviousFocus.focus();
  }
}

function trapModalFocus(event) {
  if (modelManagerModal.classList.contains('hidden') || event.key !== 'Tab') {
    return;
  }
  const focusable = modelManagerModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const items = Array.from(focusable).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) {
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function saveOllamaUrl() {
  const parsed = parseOllamaUrl(ollamaUrlInput.value);
  if (!parsed) {
    ollamaUrlInput.classList.add('invalid');
    showStatus('URL must be http://localhost or http://127.0.0.1, with an optional port.');
    return;
  }
  ollamaUrlInput.classList.remove('invalid');
  ollamaUrlInput.value = parsed;
  await chrome.storage.local.set({ ollamaUrl: parsed });
  showStatus('Saved Ollama URL.');
  await loadAvailableModels();
}

summarizeBtn.addEventListener('click', summarizePage);
cancelSummaryBtn.addEventListener('click', () => {
  abortActiveRequest();
  showLoading(false);
  showStatus('Stopped.');
});
sendBtn.addEventListener('click', sendChatMessage);
cancelChatBtn.addEventListener('click', () => {
  abortActiveRequest();
  showStatus('Stopped.');
});
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
});

modelSelect.addEventListener('change', () => {
  chrome.storage.local.set({ model: modelSelect.value });
  showStatus(`Model changed to ${modelSelect.value}`);
});

themeSelect.addEventListener('change', () => {
  const selectedTheme = themeSelect.value;
  chrome.storage.local.set({ theme: selectedTheme });
  applyTheme(selectedTheme);
  showStatus('Theme changed.');
});

ollamaUrlInput.addEventListener('change', saveOllamaUrl);
ollamaUrlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveOllamaUrl();
  }
});

manageModelsBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
modelManagerModal.addEventListener('click', (event) => {
  if (event.target === modelManagerModal) {
    closeModal();
  }
});
modelManagerModal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
  trapModalFocus(event);
});

document.querySelectorAll('.model-card .install-btn').forEach((btn) => {
  btn.addEventListener('click', (event) => {
    const card = event.currentTarget.closest('.model-card');
    installModel(card.dataset.model, event.currentTarget);
  });
});

installCustomBtn.addEventListener('click', () => {
  const modelName = customModelInput.value.trim();
  if (modelName) {
    installModel(modelName, installCustomBtn);
    customModelInput.value = '';
  }
});

(async function init() {
  const settings = await getExtensionSettings();
  themeSelect.value = settings.theme;
  applyTheme(settings.theme);
  ollamaUrlInput.value = settings.ollamaUrl;
  await loadAvailableModels();
})();
