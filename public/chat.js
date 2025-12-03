/**
 * Anna Laura AI - Enterprise Chat Assistant
 * Enhanced version with 24-hour memory and session management
 * 
 * Handles chat UI with Anna Laura persona rules and memory limits.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const themeToggle = document.getElementById("theme-toggle");
const modelIndicator = document.getElementById("model-indicator");

// Chat state
let chatHistory = [];
let isProcessing = false;
let currentTheme = localStorage.getItem('anna-laura-theme') || 'light';
let sessionId = generateSessionId();
let sessionStartTime = Date.now();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Initialize
function init() {
  applyTheme();
  setupEventListeners();
  loadSession();
  updateUI();
}

// Generate unique session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Session Management
function loadSession() {
  const savedSession = localStorage.getItem('anna-laura-session');
  const savedHistory = localStorage.getItem('anna-laura-history');
  
  if (savedSession) {
    const session = JSON.parse(savedSession);
    const now = Date.now();
    
    // Check if session is still valid (less than 24 hours old)
    if (now - session.startTime < SESSION_DURATION) {
      sessionId = session.id;
      sessionStartTime = session.startTime;
      
      if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
        renderChatHistory();
      }
    } else {
      // Session expired, create new one
      clearExpiredSession();
      createWelcomeMessage();
    }
  } else {
    createWelcomeMessage();
  }
  
  updateSessionTimer();
}

function saveSession() {
  const sessionData = {
    id: sessionId,
    startTime: sessionStartTime,
    lastActivity: Date.now(),
    messageCount: chatHistory.filter(msg => msg.role === 'user').length
  };
  
  localStorage.setItem('anna-laura-session', JSON.stringify(sessionData));
  localStorage.setItem('anna-laura-history', JSON.stringify(chatHistory));
}

function clearExpiredSession() {
  localStorage.removeItem('anna-laura-session');
  localStorage.removeItem('anna-laura-history');
  sessionId = generateSessionId();
  sessionStartTime = Date.now();
  chatHistory = [];
}

function updateSessionTimer() {
  const elapsed = Date.now() - sessionStartTime;
  const remaining = SESSION_DURATION - elapsed;
  
  if (remaining <= 0) {
    // Session expired
    clearExpiredSession();
    createWelcomeMessage();
    updateUI();
  }
  
  // Update every minute
  setTimeout(updateSessionTimer, 60000);
}

function createWelcomeMessage() {
  chatHistory = [
    {
      role: "assistant",
      content: `Hello! I'm **Anna Laura**, your enterprise AI assistant created by **SOEPARNO ENTERPRISE Corp.**\n\n**About this session:**\n• This is a **demo version** - no login required\n• I will remember our conversation for **24 hours**\n• Session data will reset when you close or refresh the tab\n\nHow can I help you today?`
    }
  ];
  saveSession();
  renderChatHistory();
}

// Theme management
function applyTheme() {
  document.body.setAttribute('data-theme', currentTheme);
  const icon = themeToggle.querySelector('svg');
  
  if (currentTheme === 'dark') {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  } else {
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    `;
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('anna-laura-theme', currentTheme);
  applyTheme();
}

// Setup all event listeners
function setupEventListeners() {
  // Auto-resize textarea
  userInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  // Send message on Enter (without Shift)
  userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button
  sendButton.addEventListener("click", sendMessage);

  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Clear session on Ctrl+Shift+R (force reset)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      if (confirm("Reset session and clear all chat history?")) {
        clearExpiredSession();
        createWelcomeMessage();
        updateUI();
      }
    }
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (chatHistory.length > 1) { // More than just welcome message
      // Optional: Can save to R2 or show warning
    }
  });
}

// Update UI elements
function updateUI() {
  const userMessages = chatHistory.filter(msg => msg.role === 'user').length;
  const elapsed = Date.now() - sessionStartTime;
  const hoursLeft = Math.max(0, Math.floor((SESSION_DURATION - elapsed) / (60 * 60 * 1000)));
  
  modelIndicator.textContent = `Anna Laura AI • ${userMessages} messages • ${hoursLeft}h left`;
  modelIndicator.title = `Session valid for ${hoursLeft} more hours`;
}

// Render chat history to UI
function renderChatHistory() {
  chatMessages.innerHTML = '';
  chatHistory.forEach(msg => {
    const messageEl = createMessageElement(msg.role, msg.content);
    chatMessages.appendChild(messageEl);
    
    if (msg.role === 'assistant') {
      addCopyButton(messageEl);
    }
  });
  scrollToBottom();
}

/**
 * Sends a message to the chat API
 */
async function sendMessage() {
  const message = userInput.value.trim();

  // Don't send empty messages
  if (message === "" || isProcessing) return;

  // Disable input while processing
  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  // Add user message to chat
  addMessageToChat("user", message);

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";

  // Show enhanced typing indicator
  showTypingIndicator();

  // Add message to history
  chatHistory.push({ role: "user", content: message });
  saveSession();
  updateUI();

  try {
    // Create assistant response element
    const assistantMessageEl = createMessageElement("assistant", "");
    chatMessages.appendChild(assistantMessageEl);
    scrollToBottom();

    // Send request to API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: chatHistory,
        model: "llama-3.3-70b" // Default model
      }),
    });

    // Handle content boundary errors
    if (response.status === 400) {
      const errorData = await response.json();
      if (errorData.error === 'content_boundary') {
        updateMessageContent(assistantMessageEl, errorData.message);
        chatHistory.push({ role: "assistant", content: errorData.message });
        saveSession();
        return;
      }
    }

    // Handle other errors
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk
      const chunk = decoder.decode(value, { stream: true });

      // Process JSON response
      try {
        const jsonData = JSON.parse(chunk);
        if (jsonData.response || jsonData.content) {
          const newContent = jsonData.response || jsonData.content || "";
          if (newContent) {
            responseText += newContent;
            updateMessageContent(assistantMessageEl, responseText);
          }
        }
      } catch (e) {
        // If not JSON, treat as plain text
        if (chunk.trim() && !chunk.includes('data:') && !chunk.includes('event:')) {
          responseText += chunk;
          updateMessageContent(assistantMessageEl, responseText);
        }
      }

      scrollToBottom();
    }

    // If no content, show default
    if (!responseText) {
      responseText = "I've processed your request. Is there anything else Anna Laura can help you with?";
      updateMessageContent(assistantMessageEl, responseText);
    }

    // Add copy button
    addCopyButton(assistantMessageEl);

    // Save to history
    chatHistory.push({ role: "assistant", content: responseText });
    saveSession();

  } catch (error) {
    console.error("Chat Error:", error);
    addMessageToChat(
      "assistant",
      "Maaf, Anna Laura sedang mengalami kendala teknis. Silakan coba lagi."
    );
    chatHistory.push({ 
      role: "assistant", 
      content: "Maaf, Anna Laura sedang mengalami kendala teknis. Silakan coba lagi."
    });
    saveSession();
  } finally {
    hideTypingIndicator();
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
    updateUI();
  }
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
  const messageEl = createMessageElement(role, content);
  chatMessages.appendChild(messageEl);

  if (role === 'assistant') {
    addCopyButton(messageEl);
  }

  scrollToBottom();
}

/**
 * Create a message element with proper structure
 */
function createMessageElement(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}`;
  
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === 'user' ? 'U' : 'AL'; // AL for Anna Laura
  avatar.title = role === 'user' ? 'User' : 'Anna Laura';
  
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  contentDiv.innerHTML = formatContent(content);
  
  messageEl.appendChild(avatar);
  messageEl.appendChild(contentDiv);
  
  return messageEl;
}

/**
 * Simple content formatting
 */
function formatContent(content) {
  if (!content) return '<p></p>';
  
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  if (!formatted.startsWith('<p>')) {
    formatted = `<p>${formatted}</p>`;
  }
  
  return formatted;
}

/**
 * Update message content (for streaming)
 */
function updateMessageContent(messageEl, content) {
  const contentDiv = messageEl.querySelector('.message-content');
  if (contentDiv) {
    contentDiv.innerHTML = formatContent(content);
  }
}

/**
 * Add copy button to message
 */
function addCopyButton(messageEl) {
  if (messageEl.querySelector('.copy-button')) return;
  
  const contentDiv = messageEl.querySelector('.message-content');
  if (!contentDiv) return;
  
  const copyButton = document.createElement('button');
  copyButton.className = 'copy-button';
  copyButton.innerHTML = '📋';
  copyButton.title = 'Copy message';
  copyButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.1);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    font-size: 12px;
  `;
  
  messageEl.addEventListener('mouseenter', () => {
    copyButton.style.opacity = '1';
  });
  messageEl.addEventListener('mouseleave', () => {
    copyButton.style.opacity = '0';
  });
  
  copyButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = messageEl.querySelector('.message-content').textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.innerHTML = '✅';
      copyButton.title = 'Copied!';
      setTimeout(() => {
        copyButton.innerHTML = '📋';
        copyButton.title = 'Copy message';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      copyButton.innerHTML = '❌';
      setTimeout(() => {
        copyButton.innerHTML = '📋';
      }, 2000);
    }
  });
  
  messageEl.style.position = 'relative';
  messageEl.appendChild(copyButton);
}

/**
 * Enhanced typing indicator
 */
function showTypingIndicator() {
  typingIndicator.classList.add("visible");
  typingIndicator.style.display = 'flex';
}

function hideTypingIndicator() {
  typingIndicator.classList.remove("visible");
  typingIndicator.style.display = 'none';
}

/**
 * Scroll to bottom of chat
 */
function scrollToBottom() {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
}

// Add CSS for copy button
const style = document.createElement('style');
style.textContent = `
  .message:hover .copy-button {
    opacity: 1 !important;
  }
  .copy-button:hover {
    background: rgba(0,0,0,0.2) !important;
  }
  
  .avatar[title="Anna Laura"] {
    background-color: #2563eb !important;
  }
`;
document.head.appendChild(style);

// Initialize the chat app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
