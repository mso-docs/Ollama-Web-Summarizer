// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Ollama Web Summarizer installed');
  
  // Set default URL only - model will be auto-selected from available models
  chrome.storage.local.set({
    ollamaUrl: 'http://localhost:11434'
  });
  
  // Create context menu for selected text
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
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'summarizeSelection' || info.menuItemId === 'explainSelection') {
    const action = info.menuItemId === 'summarizeSelection' ? 'summarize' : 'explain';
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'showPopup',
      text: info.selectionText,
      type: action
    });
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callOllama') {
    let fullResponse = '';
    
    callOllamaAPI(request.prompt, request.context, (chunk) => {
      fullResponse += chunk;
      // Send incremental updates
      chrome.runtime.sendMessage({
        action: 'streamChunk',
        chunk: chunk,
        messageId: request.messageId
      }).catch(() => {}); // Ignore errors if popup is closed
    })
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Call Ollama API with streaming
async function callOllamaAPI(prompt, context = '', onChunk) {
  const settings = await chrome.storage.local.get(['ollamaUrl', 'model']);
  const ollamaUrl = settings.ollamaUrl || 'http://localhost:11434';
  const model = settings.model || 'llama3.2:latest';

  const fullPrompt = context 
    ? `Context: ${context}\n\nQuestion: ${prompt}`
    : prompt;

  let response;
  try {
    response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        stream: true
      })
    });
  } catch (fetchError) {
    throw new Error(`Cannot connect to Ollama. Please restart Ollama app and reload the extension. Details: ${fetchError.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    let errorMsg = `Ollama API error (${response.status}): ${errorText}`;
    
    if (response.status === 403) {
      errorMsg += '\n\n⚠️ CORS Error: Set OLLAMA_ORIGINS="*" environment variable and restart Ollama.';
    } else if (response.status === 404 && errorText.includes('not found')) {
      errorMsg += `\n\n⚠️ Model "${model}" not found!\n\nOptions:\n1. Select a different model from the dropdown (shows your installed models)\n2. Install this model: ollama pull ${model}`;
    }
    
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.response) {
          fullResponse += data.response;
          if (onChunk) {
            onChunk(data.response);
          }
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
  }

  return fullResponse;
}
