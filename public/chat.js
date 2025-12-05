/**

* LLM Chat App Frontend - Final Version
* 
* Handles chat UI interactions and communicates with backend API.
* Ensures messages display correctly and connects properly with index.html and index.ts.
*/

// --- DOM Elements ---
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// --- Chat State ---
let chatHistory = [
{
role: "assistant",
content: "Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
},
];
let isProcessing = false;

// --- Helpers ---
// Add message to chat container
function addMessageToChat(role, content) {
const messageEl = document.createElement("div");
messageEl.className = "message ${role}-message";
messageEl.innerHTML = "<p>${content}</p>";
chatMessages.appendChild(messageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Auto-resize textarea
userInput.addEventListener("input", function () {
this.style.height = "auto";
this.style.height = "${this.scrollHeight}px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
sendMessage();
}
});

// Send button click
sendButton.addEventListener("click", sendMessage);

// --- Main Function ---
async function sendMessage() {
const message = userInput.value.trim();
if (!message || isProcessing) return;

isProcessing = true;
userInput.disabled = true;
sendButton.disabled = true;

// Add user message to UI & history
addMessageToChat("user", message);
chatHistory.push({ role: "user", content: message });

userInput.value = "";
userInput.style.height = "auto";

// Show typing indicator
typingIndicator.classList.add("visible");

// Prepare assistant message container
const assistantMessageEl = document.createElement("div");
assistantMessageEl.className = "message assistant-message";
assistantMessageEl.innerHTML = "<p></p>";
chatMessages.appendChild(assistantMessageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;

try {
// Send API request
const response = await fetch("/api/chat", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ messages: chatHistory }),
});

if (!response.ok) throw new Error("Failed to get response");

// Stream response
const reader = response.body.getReader();
const decoder = new TextDecoder();
let responseText = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split("\n");
  for (const line of lines) {
    try {
      const jsonData = JSON.parse(line);
      if (jsonData.response) {
        responseText += jsonData.response;
        assistantMessageEl.querySelector("p").textContent = responseText;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    } catch (e) {
      console.error("Error parsing JSON:", e);
    }
  }
}

// Add completed assistant message to history
chatHistory.push({ role: "assistant", content: responseText });

} catch (error) {
console.error("Error:", error);
addMessageToChat("assistant", "Sorry, there was an error processing your request.");
} finally {
typingIndicator.classList.remove("visible");
isProcessing = false;
userInput.disabled = false;
sendButton.disabled = false;
userInput.focus();
}
}

// --- Initial Render ---
addMessageToChat("assistant", chatHistory[0].content);
