// Content script - extracts page content and shows selection popup
(function() {
  let floatingPopup = null;
  let selectionToolbar = null;
  let selectionTimeout = null;
  
  // Theme color mapping (must match popup.js)
  function getThemeColors(themeName) {
    const themes = {
      'light': { primary: '#6366f1', secondary: '#4f46e5', bg: '#ffffff', text: '#1f2937', cardBg: '#ffffff', dark: false },
      'dark': { primary: '#818cf8', secondary: '#6366f1', bg: '#1a1a1a', text: '#f3f4f6', cardBg: '#1a1a1a', dark: true },
      'purple-light': { primary: '#667eea', secondary: '#764ba2', bg: '#ffffff', text: '#1f2937', cardBg: '#ffffff', dark: false },
      'purple-dark': { primary: '#7c3aed', secondary: '#9333ea', bg: '#1a1a1a', text: '#e0e0e0', cardBg: '#1a1a1a', dark: true },
      'blue-light': { primary: '#3b82f6', secondary: '#2563eb', bg: '#ffffff', text: '#1e293b', cardBg: '#ffffff', dark: false },
      'blue-dark': { primary: '#60a5fa', secondary: '#3b82f6', bg: '#1a1a1a', text: '#e2e8f0', cardBg: '#1a1a1a', dark: true },
      'green-light': { primary: '#10b981', secondary: '#059669', bg: '#ffffff', text: '#064e3b', cardBg: '#ffffff', dark: false },
      'green-dark': { primary: '#34d399', secondary: '#10b981', bg: '#1a1a1a', text: '#d1fae5', cardBg: '#1a1a1a', dark: true },
      'teal-light': { primary: '#14b8a6', secondary: '#0d9488', bg: '#ffffff', text: '#134e4a', cardBg: '#ffffff', dark: false },
      'teal-dark': { primary: '#2dd4bf', secondary: '#14b8a6', bg: '#1a1a1a', text: '#ccfbf1', cardBg: '#1a1a1a', dark: true },
      'red-light': { primary: '#ef4444', secondary: '#dc2626', bg: '#ffffff', text: '#7f1d1d', cardBg: '#ffffff', dark: false },
      'red-dark': { primary: '#f87171', secondary: '#ef4444', bg: '#1a1a1a', text: '#fee2e2', cardBg: '#1a1a1a', dark: true }
    };
    return themes[themeName] || themes['purple-light'];
  }
  
  // Extract main content from the page
  function extractPageContent() {
    // Try to get main content area
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
    
    // Try each selector
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        content = element.innerText;
        break;
      }
    }

    // Fallback to body if no main content found
    if (!content) {
      content = document.body.innerText;
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();

    return {
      title: document.title,
      url: window.location.href,
      content: content.substring(0, 8000), // Limit to 8000 chars to avoid token issues
      timestamp: new Date().toISOString()
    };
  }
  
  // Create floating popup for selection summary
  function createFloatingPopup(text, type, question = '') {
    // Remove existing popup if any
    if (floatingPopup) {
      floatingPopup.remove();
    }
    
    const titleMap = {
      'summarize': '📄 Summary',
      'explain': '💡 Explanation',
      'chat': '💬 Question'
    };
    
    // Create popup container
    floatingPopup = document.createElement('div');
    floatingPopup.id = 'ollama-floating-popup';
    floatingPopup.innerHTML = `
      <div class="ollama-popup-header">
        <span class="ollama-popup-title">${titleMap[type] || '🦙 Ollama'}</span>
        <button class="ollama-popup-close">✕</button>
      </div>
      <div class="ollama-popup-content">
        <div class="ollama-popup-loading">
          <div class="ollama-popup-spinner"></div>
          <span>I'm thinking...</span>
        </div>
        <div class="ollama-popup-text" style="display: none;"></div>
      </div>
    `;
    
    // Add styles with theme
    const style = document.createElement('style');
    
    // Get theme colors
    chrome.storage.local.get(['theme'], (result) => {
      const themeName = result.theme || 'purple-light';
      const themeColors = getThemeColors(themeName);
      
      style.textContent = `
        #ollama-floating-popup {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 500px;
          max-width: 90vw;
          max-height: 80vh;
          background: ${themeColors.cardBg};
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          animation: ollamaPopupSlideIn 0.2s ease-out;
          border: 1px solid ${themeColors.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
        }
        
        @keyframes ollamaPopupSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        
        .ollama-popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%);
          color: white;
        }
        
        .ollama-popup-title {
          font-weight: 600;
          font-size: 16px;
        }
        
        .ollama-popup-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 18px;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .ollama-popup-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .ollama-popup-content {
          padding: 20px;
          max-height: calc(80vh - 60px);
          overflow-y: auto;
          background: ${themeColors.cardBg};
          color: ${themeColors.text};
        }
        
        .ollama-popup-loading {
          display: flex;
          align-items: center;
          gap: 12px;
          color: ${themeColors.dark ? '#aaa' : '#666'};
          font-size: 14px;
        }
        
        .ollama-popup-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid ${themeColors.dark ? '#444' : '#e0e0e0'};
          border-top-color: ${themeColors.primary};
          border-radius: 50%;
          animation: ollamaSpinnerRotate 0.8s linear infinite;
        }
        
        @keyframes ollamaSpinnerRotate {
          to { transform: rotate(360deg); }
        }
        
        .ollama-popup-text {
          font-size: 14px;
          line-height: 1.6;
          color: ${themeColors.text};
          white-space: pre-wrap;
          word-wrap: break-word;
        }
      `;
    });
    
    document.head.appendChild(style);
    document.body.appendChild(floatingPopup);
    
    // Close button handler
    floatingPopup.querySelector('.ollama-popup-close').addEventListener('click', () => {
      floatingPopup.remove();
      floatingPopup = null;
    });
    
    // Close on outside click
    floatingPopup.addEventListener('click', (e) => {
      if (e.target === floatingPopup) {
        floatingPopup.remove();
        floatingPopup = null;
      }
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape' && floatingPopup) {
        floatingPopup.remove();
        floatingPopup = null;
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Process the text
    processSelection(text, type, question);
  }
  
  // Process selected text with Ollama
  async function processSelection(text, type, question = '') {
    const loading = floatingPopup.querySelector('.ollama-popup-loading');
    const resultDiv = floatingPopup.querySelector('.ollama-popup-text');
    
    try {
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
      
      const messageId = 'selection-' + Date.now();
      let fullResponse = '';
      
      // Function to format text with Markdown-style formatting
      function formatText(text) {
        let formatted = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
        formatted = formatted.replace(/`(.+?)`/g, '<code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
      }
      
      function linkifyText(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
          let cleanUrl = url.replace(/[.,;!?]$/, '');
          let punctuation = url.length > cleanUrl.length ? url.slice(-1) : '';
          return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: underline;">${cleanUrl}</a>${punctuation}`;
        });
      }
      
      function processText(text) {
        let processed = formatText(text);
        processed = linkifyText(processed);
        return processed;
      }
      
      // Listen for streaming chunks
      const chunkListener = (message) => {
        if (message.action === 'streamChunk' && message.messageId === messageId) {
          fullResponse += message.chunk;
          resultDiv.innerHTML = processText(fullResponse);
          
          // Show result div and hide loading
          if (loading.style.display !== 'none') {
            loading.style.display = 'none';
            resultDiv.style.display = 'block';
          }
        }
      };
      chrome.runtime.onMessage.addListener(chunkListener);
      
      // Call background script to process with Ollama
      chrome.runtime.sendMessage({
        action: 'callOllama',
        prompt: prompt,
        context: '',
        messageId: messageId
      }, (response) => {
        chrome.runtime.onMessage.removeListener(chunkListener);
        
        if (response && response.success) {
          resultDiv.innerHTML = processText(response.data);
          loading.style.display = 'none';
          resultDiv.style.display = 'block';
        } else {
          resultDiv.textContent = '❌ Error: ' + (response?.error || 'Failed to process text');
          resultDiv.style.color = '#d32f2f';
          loading.style.display = 'none';
          resultDiv.style.display = 'block';
        }
      });
      
    } catch (error) {
      resultDiv.textContent = '❌ Error: ' + error.message;
      resultDiv.style.color = '#d32f2f';
      loading.style.display = 'none';
      resultDiv.style.display = 'block';
    }
  }

  // Show selection toolbar on text selection
  function showSelectionToolbar(mouseX, mouseY) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText || selectedText.length < 3) {
      hideSelectionToolbar();
      return;
    }
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Remove existing toolbar
    hideSelectionToolbar();
    
    // Create toolbar
    selectionToolbar = document.createElement('div');
    selectionToolbar.id = 'ollama-selection-toolbar';
    selectionToolbar.innerHTML = `
      <button class="ollama-toolbar-btn" data-action="summarize" title="Summarize">
        📄 Summarize
      </button>
      <button class="ollama-toolbar-btn" data-action="explain" title="Explain">
        💡 Explain
      </button>
      <button class="ollama-toolbar-btn" data-action="chat" title="Ask a question">
        💬 Ask
      </button>
    `;
    
    // Add styles
    if (!document.getElementById('ollama-toolbar-styles')) {
      const style = document.createElement('style');
      style.id = 'ollama-toolbar-styles';
      // Get theme from storage
      chrome.storage.local.get(['theme'], (result) => {
        const themeName = result.theme || 'purple-light';
        const themeColors = getThemeColors(themeName);
        
        style.textContent = `
          #ollama-selection-toolbar {
            position: absolute;
            display: flex;
            gap: 4px;
            background: ${themeColors.cardBg};
            border-radius: 8px;
            padding: 6px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            z-index: 999998;
            animation: ollamaToolbarSlideDown 0.2s ease-out;
            border: 1px solid ${themeColors.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          }
          
          @keyframes ollamaToolbarSlideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .ollama-toolbar-btn {
            background: linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            transition: transform 0.1s, box-shadow 0.1s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .ollama-toolbar-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
          
          .ollama-toolbar-btn:active {
            transform: translateY(0);
          }
        `;
      });
      document.head.appendChild(style);
    }
    
    document.body.appendChild(selectionToolbar);
    
    // Position near cursor if available, otherwise above selection
    const toolbarRect = selectionToolbar.getBoundingClientRect();
    let top, left;
    
    if (mouseX !== undefined && mouseY !== undefined) {
      // Position near cursor
      top = mouseY + window.scrollY - toolbarRect.height - 10;
      left = mouseX + window.scrollX - (toolbarRect.width / 2);
    } else {
      // Fallback to selection position
      top = rect.top + window.scrollY - toolbarRect.height - 8;
      left = rect.left + window.scrollX + (rect.width / 2) - (toolbarRect.width / 2);
    }
    
    selectionToolbar.style.top = Math.max(10, top) + 'px';
    selectionToolbar.style.left = Math.max(10, Math.min(window.innerWidth - toolbarRect.width - 10, left)) + 'px';
    
    // Add click handlers
    selectionToolbar.querySelectorAll('.ollama-toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        
        if (action === 'chat') {
          // Show input dialog for chat
          const question = prompt('Ask a question about the selected text:');
          if (question) {
            createFloatingPopup(selectedText, 'chat', question);
          }
        } else {
          createFloatingPopup(selectedText, action);
        }
        
        hideSelectionToolbar();
      });
    });
  }
  
  function hideSelectionToolbar() {
    if (selectionToolbar) {
      selectionToolbar.remove();
      selectionToolbar = null;
    }
  }
  
  // Handle text selection
  let lastMouseX, lastMouseY;
  
  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });
  
  document.addEventListener('mouseup', (e) => {
    // Don't show if clicking on our own elements
    if (e.target.closest('#ollama-selection-toolbar') || e.target.closest('#ollama-floating-popup')) {
      return;
    }
    
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(() => {
      showSelectionToolbar(lastMouseX, lastMouseY);
    }, 100);
  });
  
  // Hide toolbar when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#ollama-selection-toolbar')) {
      hideSelectionToolbar();
    }
  });

  // Listen for messages from the popup and background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
      const pageData = extractPageContent();
      sendResponse(pageData);
    } else if (request.action === 'showPopup') {
      createFloatingPopup(request.text, request.type);
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });
})();
