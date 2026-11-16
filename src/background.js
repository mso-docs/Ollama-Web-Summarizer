'use strict';

importScripts('shared.js');

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(['ollamaUrl']);
  if (!parseOllamaUrl(stored.ollamaUrl)) {
    await chrome.storage.local.set({ ollamaUrl: DEFAULT_OLLAMA_URL });
  }
  await setupContextMenus();
});

async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'summarizeSelection',
    title: 'Summarize with Ollama',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'explainSelection',
    title: 'Explain with Ollama',
    contexts: ['selection']
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'summarizeSelection' && info.menuItemId !== 'explainSelection') {
    return;
  }
  if (!tab || tab.id == null) {
    return;
  }
  const action = info.menuItemId === 'summarizeSelection' ? 'summarize' : 'explain';
  chrome.tabs.sendMessage(tab.id, {
    action: 'showPopup',
    text: info.selectionText || '',
    type: action
  }).catch(() => {
    // The page may not allow content scripts (Chrome Web Store, chrome://, and similar).
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'ollama-generate') {
    handleGeneratePort(port);
    return;
  }
  if (port.name === 'ollama-pull') {
    handlePullPort(port);
  }
});

function handleGeneratePort(port) {
  const controllers = new Map();
  port.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }
    if (message.action === 'generate') {
      startGenerate(port, message, controllers);
      return;
    }
    if (message.action === 'abort' && message.requestId) {
      const controller = controllers.get(message.requestId);
      if (controller) {
        controller.abort();
      }
    }
  });
  port.onDisconnect.addListener(() => {
    for (const controller of controllers.values()) {
      controller.abort();
    }
    controllers.clear();
  });
}

async function startGenerate(port, message, controllers) {
  const requestId = message.requestId || `req-${Date.now()}`;
  const controller = new AbortController();
  controllers.set(requestId, controller);

  try {
    const settings = await getExtensionSettings();
    const model = settings.model || 'llama3.2:latest';
    const prompt = message.context
      ? `Context: ${message.context}\n\nQuestion: ${message.prompt}`
      : (message.prompt || '');

    let response;
    try {
      response = await fetch(`${settings.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: true
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        safePost(port, { type: 'aborted', requestId });
        return;
      }
      throw new Error(connectionErrorMessage(error));
    }

    if (!response.ok) {
      throw new Error(await httpErrorMessage(response, model));
    }

    await readNdjsonStream(response, (data) => {
      if (data.response) {
        safePost(port, { type: 'chunk', chunk: data.response, requestId });
      }
    }, controller.signal);

    safePost(port, { type: 'done', requestId });
  } catch (error) {
    if (error.name === 'AbortError') {
      safePost(port, { type: 'aborted', requestId });
    } else {
      safePost(port, { type: 'error', error: error.message || 'Unknown error', requestId });
    }
  } finally {
    controllers.delete(requestId);
  }
}

function handlePullPort(port) {
  let controller = null;
  port.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }
    if (message.action === 'pull') {
      controller = new AbortController();
      startPull(port, message, controller);
      return;
    }
    if (message.action === 'abort' && controller) {
      controller.abort();
    }
  });
  port.onDisconnect.addListener(() => {
    if (controller) {
      controller.abort();
    }
  });
}

async function startPull(port, message, controller) {
  const requestId = message.requestId || `pull-${Date.now()}`;
  const modelName = String(message.model || '').trim();
  if (!modelName) {
    safePost(port, { type: 'error', error: 'Enter a model name.', requestId });
    return;
  }

  try {
    const settings = await getExtensionSettings();
    let response;
    try {
      response = await fetch(`${settings.ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        safePost(port, { type: 'aborted', requestId });
        return;
      }
      throw new Error(connectionErrorMessage(error));
    }

    if (!response.ok) {
      throw new Error(await httpErrorMessage(response, modelName));
    }

    await readNdjsonStream(response, (data) => {
      safePost(port, { type: 'progress', data, requestId });
      if (data.status === 'success') {
        safePost(port, { type: 'done', requestId });
      }
    }, controller.signal);
    safePost(port, { type: 'done', requestId });
  } catch (error) {
    if (error.name === 'AbortError') {
      safePost(port, { type: 'aborted', requestId });
    } else {
      safePost(port, { type: 'error', error: error.message || 'Unknown error', requestId });
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request !== 'object') {
    return false;
  }

  // Content scripts and the popup may request these actions. Do not accept
  // arbitrary URLs or prompts for anything other than the local Ollama API.
  if (request.action === 'listModels') {
    listModels()
      .then((models) => sendResponse({ success: true, models }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'deleteModel') {
    deleteModel(request.model)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'testConnection') {
    testConnection()
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

async function listModels() {
  const settings = await getExtensionSettings();
  let response;
  try {
    response = await fetch(`${settings.ollamaUrl}/api/tags`, { method: 'GET' });
  } catch (error) {
    throw new Error(connectionErrorMessage(error));
  }
  if (!response.ok) {
    throw new Error(await httpErrorMessage(response));
  }
  const data = await response.json();
  return Array.isArray(data.models) ? data.models : [];
}

async function deleteModel(modelName) {
  const name = String(modelName || '').trim();
  if (!name) {
    throw new Error('No model specified.');
  }
  const settings = await getExtensionSettings();
  let response;
  try {
    response = await fetch(`${settings.ollamaUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  } catch (error) {
    throw new Error(connectionErrorMessage(error));
  }
  if (!response.ok) {
    throw new Error(await httpErrorMessage(response, name));
  }
}

async function testConnection() {
  const models = await listModels();
  return { ok: true, modelCount: models.length };
}

function safePost(port, payload) {
  try {
    port.postMessage(payload);
  } catch (error) {
    // The other end hung up.
  }
}
