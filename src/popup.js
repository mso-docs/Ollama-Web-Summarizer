// Popup script
let pageContent = null;
let conversationHistory = [];

// Convert Markdown-style formatting to HTML
function formatText(text) {
  // Escape HTML first to prevent XSS
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Bold: **text** or __text__
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Code: `code`
  formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  // Bullet points (lines starting with - or *)
  formatted = formatted.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Numbered lists
  formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  return formatted;
}

// Convert URLs in text to clickable links
function linkifyText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    // Remove trailing punctuation that's not part of URL
    let cleanUrl = url.replace(/[.,;!?]$/, '');
    let punctuation = url.length > cleanUrl.length ? url.slice(-1) : '';
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="chat-link">${cleanUrl}</a>${punctuation}`;
  });
}

// Apply both formatting and linkify
function processText(text) {
  let processed = formatText(text);
  processed = linkifyText(processed);
  return processed;
}

// DOM elements
const summarizeBtn = document.getElementById('summarizeBtn');
const sendBtn = document.getElementById('sendBtn');
const chatInput = document.getElementById('chatInput');
const summarySection = document.getElementById('summarySection');
const summaryContent = document.getElementById('summaryContent');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
const chatErrorMessage = document.getElementById('chatErrorMessage');
const statusText = document.getElementById('statusText');
const modelSelect = document.getElementById('modelSelect');

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    
    // Update active states
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
  });
});

// Theme definitions
const themes = {
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

const themeSelect = document.getElementById('themeSelect');

// Fetch available models from Ollama
async function loadAvailableModels() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      if (data.models && data.models.length > 0) {
        // Clear current options
        modelSelect.innerHTML = '';
        
        // Add available models
        data.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.name;
          option.textContent = model.name.replace(':latest', '');
          modelSelect.appendChild(option);
        });
        
        // Restore saved selection or use first available
        chrome.storage.local.get(['model'], (result) => {
          if (result.model && Array.from(modelSelect.options).some(opt => opt.value === result.model)) {
            modelSelect.value = result.model;
          } else if (modelSelect.options.length > 0) {
            modelSelect.value = modelSelect.options[0].value;
            chrome.storage.local.set({ model: modelSelect.value });
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to load models:', error);
    // Keep default options if fetch fails
  }
}

// Load models on startup
loadAvailableModels();

// Load saved settings
chrome.storage.local.get(['model', 'theme'], (result) => {
  if (result.model) {
    modelSelect.value = result.model;
  }
  if (result.theme) {
    themeSelect.value = result.theme;
    applyTheme(result.theme);
  } else {
    applyTheme('purple-light');
  }
});

// Save model selection
modelSelect.addEventListener('change', () => {
  chrome.storage.local.set({ model: modelSelect.value });
  showStatus('Model changed to ' + modelSelect.value);
});

// Save and apply theme selection
themeSelect.addEventListener('change', () => {
  const selectedTheme = themeSelect.value;
  chrome.storage.local.set({ theme: selectedTheme });
  applyTheme(selectedTheme);
  showStatus('Theme changed');
});

// Apply theme to the popup
function applyTheme(themeName) {
  const theme = themes[themeName] || themes['purple-light'];
  const root = document.documentElement;
  
  root.style.setProperty('--primary-color', theme.primary);
  root.style.setProperty('--secondary-color', theme.secondary);
  root.style.setProperty('--bg-color', theme.bg);
  root.style.setProperty('--text-color', theme.text);
  root.style.setProperty('--card-bg', theme.cardBg);
  root.style.setProperty('--tab-bg', theme.tabBg);
  
  // Update body background
  document.body.style.background = theme.bg;
  document.body.style.color = theme.text;
  
  // Apply dark mode specific styles
  if (theme.dark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// Summarize button click
summarizeBtn.addEventListener('click', async () => {
  try {
    showLoading(true);
    hideError();
    
    // Get page content from content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
      if (chrome.runtime.lastError) {
        showError('Could not access page content. Try refreshing the page.');
        showLoading(false);
        return;
      }

      pageContent = response;
      
      // Create summarization prompt
      const prompt = `Please provide a concise summary of the following webpage content in 3-5 bullet points:\n\nTitle: ${pageContent.title}\n\nContent: ${pageContent.content}`;
      
      // Show sections and prepare for streaming
      summaryContent.textContent = 'I\'m thinking...';
      summaryContent.style.fontStyle = 'italic';
      summaryContent.style.color = '#999';
      summarySection.classList.remove('hidden');
      
      const messageId = 'summary-' + Date.now();
      
      // Listen for streaming chunks
      let firstChunk = true;
      let accumulatedText = '';
      const chunkListener = (message) => {
        if (message.action === 'streamChunk' && message.messageId === messageId) {
          if (firstChunk) {
            summaryContent.textContent = '';
            summaryContent.style.fontStyle = 'normal';
            summaryContent.style.color = '#444';
            firstChunk = false;
          }
          accumulatedText += message.chunk;
          summaryContent.innerHTML = processText(accumulatedText);
        }
      };
      chrome.runtime.onMessage.addListener(chunkListener);
      
      // Call Ollama
      const summary = await callOllama(prompt, '', messageId);
      
      // Remove listener
      chrome.runtime.onMessage.removeListener(chunkListener);
      
      // Display final summary
      summaryContent.innerHTML = processText(summary);
      summaryContent.style.fontStyle = 'normal';
      summaryContent.style.color = '#444';
      
      // Initialize conversation history
      conversationHistory = [
        { role: 'system', content: `You are a helpful assistant. The user is reading a webpage titled "${pageContent.title}". Here is the content: ${pageContent.content}` }
      ];
      
      showLoading(false);
      showStatus('Summary complete!');
    });
  } catch (error) {
    showError(error.message);
    showLoading(false);
  }
});

// Send chat message
sendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  try {
    // Get page content if not already loaded
    if (!pageContent) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      try {
        pageContent = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error('Could not access page content. Try refreshing the page.'));
            } else {
              resolve(response);
            }
          });
        });
      } catch (error) {
        showChatError(error.message);
        return;
      }
    }

    // Add user message to chat
    addChatMessage(message, 'user');
    chatInput.value = '';
    chatLoadingIndicator.classList.remove('hidden');
    hideChatError();

    // Remove welcome message if present
    const welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) {
      welcome.remove();
    }
    
    // Create placeholder for assistant message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';
    
    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'Assistant';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = 'I\'m thinking...';
    content.style.fontStyle = 'italic';
    content.style.color = '#999';
    
    messageDiv.appendChild(label);
    messageDiv.appendChild(content);
    chatMessages.appendChild(messageDiv);
    
    const messageId = 'chat-' + Date.now();
    
    // Listen for streaming chunks
    let firstChunk = true;
    let accumulatedText = '';
    const chunkListener = (msg) => {
      if (msg.action === 'streamChunk' && msg.messageId === messageId) {
        if (firstChunk) {
          content.textContent = '';
          content.style.fontStyle = 'normal';
          content.style.color = '#333';
          firstChunk = false;
        }
        accumulatedText += msg.chunk;
        content.innerHTML = processText(accumulatedText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    };
    chrome.runtime.onMessage.addListener(chunkListener);

    // Call Ollama with context
    const response = await callOllama(message, pageContent.content, messageId);
    
    // Remove listener
    chrome.runtime.onMessage.removeListener(chunkListener);
    
    // Ensure final content is set
    content.innerHTML = processText(response);
    content.style.fontStyle = 'normal';
    content.style.color = '#333';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    chatLoadingIndicator.classList.add('hidden');
  } catch (error) {
    showChatError(error.message);
    chatLoadingIndicator.classList.add('hidden');
  }
}

function addChatMessage(text, role) {
  // Remove welcome message if present
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
  content.innerHTML = processText(text);
  
  messageDiv.appendChild(label);
  messageDiv.appendChild(content);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function callOllama(prompt, context = '', messageId = '') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'callOllama', prompt, context, messageId },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      }
    );
  });
}

function showLoading(show) {
  loadingIndicator.classList.toggle('hidden', !show);
}

function showError(message) {
  errorMessage.textContent = '❌ ' + message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

function showChatError(message) {
  chatErrorMessage.textContent = '❌ ' + message;
  chatErrorMessage.classList.remove('hidden');
}

function hideChatError() {
  chatErrorMessage.classList.add('hidden');
}

function showStatus(message) {
  statusText.textContent = message;
  setTimeout(() => {
    statusText.textContent = 'Ready';
  }, 3000);
}
