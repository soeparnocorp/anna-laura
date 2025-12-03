/**
 * Anna Laura AI - Enterprise Chat Assistant
 * Enhanced version for SOEPARNO ENTERPRISE Corp.
 * 
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const themeToggle = document.getElementById("theme-toggle");
const modelIndicator = document.getElementById("model-indicator");

// Chat state
let chatHistory = [
  {
    role: "assistant",
    content: "Hello! I'm **Anna Laura AI**, your enterprise AI assistant powered by Cloudflare Workers AI.\n\nThis is a **demo version** - no login required. How can I help you today?"
  },
];
let isProcessing = false;
let currentTheme = localStorage.getItem('anna-laura-theme') || 'light';
let messageCount = 0;

// Initialize
function init() {
  applyTheme();
  setupEventListeners();
  updateMessageCount();
}

// Theme management
function applyTheme() {
  document.body.setAttribute('data-theme', currentTheme);
  const icon = themeToggle.querySelector('svg');
  
  if (currentTheme === 'dark') {
    // Change to moon icon for dark mode
    icon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    `;
  } else {
    // Sun icon for light mode
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
  // Auto-resize textarea as user types
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

  // Send button click handler
  sendButton.addEventListener("click", sendMessage);

  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Clear chat on Ctrl+Shift+C (for testing)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      clearChat();
    }
  });
}

// Update message count in model indicator
function updateMessageCount() {
  messageCount = chatHistory.filter(msg => msg.role === 'user').length;
  modelIndicator.textContent = `Cloudflare AI • ${messageCount} messages`;
}

/**
 * Sends a message to the chat API and processes the response
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
  updateMessageCount();

  try {
    // Create new assistant response element with copy button
    const assistantMessageEl = createMessageElement("assistant", "");
    chatMessages.appendChild(assistantMessageEl);

    // Scroll to bottom
    scrollToBottom();

    // Send request to API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: chatHistory,
      }),
    });

    // Handle errors
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";
    let isFirstChunk = true;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk
      const chunk = decoder.decode(value, { stream: true });

      // Process SSE format or direct JSON
      try {
        // Try to parse as JSON (for Cloudflare AI format)
        const jsonData = JSON.parse(chunk);
        if (jsonData.response || jsonData.content) {
          const newContent = jsonData.response || jsonData.content || "";
          if (newContent) {
            responseText += newContent;
            updateMessageContent(assistantMessageEl, responseText);
            isFirstChunk = false;
          }
        }
      } catch (e) {
        // If not JSON, might be plain text or other format
        if (chunk.trim() && !chunk.includes('data:') && !chunk.includes('event:')) {
          responseText += chunk;
          updateMessageContent(assistantMessageEl, responseText);
          isFirstChunk = false;
        }
      }

      // Scroll to bottom as content arrives
      scrollToBottom();
    }

    // If no content was received, show default message
    if (!responseText) {
      responseText = "I've processed your request. Is there anything else I can help you with?";
      updateMessageContent(assistantMessageEl, responseText);
    }

    // Add copy button to completed message
    addCopyButton(assistantMessageEl);

    // Add completed response to chat history
    chatHistory.push({ role: "assistant", content: responseText });

  } catch (error) {
    console.error("Chat Error:", error);
    addMessageToChat(
      "assistant",
      "Sorry, there was an error processing your request. Please try again."
    );
  } finally {
    // Hide typing indicator
    hideTypingIndicator();

    // Re-enable input
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

/**
 * Helper function to add message to chat with enhanced formatting
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
  avatar.textContent = role === 'user' ? 'U' : 'AI';
  
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  
  // Simple markdown-like formatting
  const formattedContent = formatContent(content);
  contentDiv.innerHTML = formattedContent;
  
  messageEl.appendChild(avatar);
  messageEl.appendChild(contentDiv);
  
  return messageEl;
}

/**
 * Simple content formatting (bold, italics, code)
 */
function formatContent(content) {
  if (!content) return '<p></p>';
  
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
    .replace(/`([^`]+)`/g, '<code>$1</code>') // `code`
    .replace(/\n\n/g, '</p><p>') // Paragraphs
    .replace(/\n/g, '<br>'); // Line breaks
  
  // Wrap in paragraph if not already
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
  // Check if copy button already exists
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
  
  // Show on hover
  messageEl.addEventListener('mouseenter', () => {
    copyButton.style.opacity = '1';
  });
  messageEl.addEventListener('mouseleave', () => {
    copyButton.style.opacity = '0';
  });
  
  // Copy functionality
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
  
  // Position relative for absolute positioning
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

/**
 * Clear chat (for testing)
 */
function clearChat() {
  if (confirm("Clear all chat messages? This cannot be undone.")) {
    chatMessages.innerHTML = `
      <div class="message assistant">
        <div class="avatar">AI</div>
        <div class="message-content">
          <p>Chat cleared. I'm <strong>Anna Laura AI</strong>, your enterprise AI assistant. How can I help you now?</p>
        </div>
      </div>
    `;
    chatHistory = [
      {
        role: "assistant",
        content: "Chat cleared. I'm Anna Laura AI, your enterprise AI assistant. How can I help you now?"
      }
    ];
    updateMessageCount();
  }
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
`;
document.head.appendChild(style);

// Initialize the chat app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
