/**

* Final Chat.js
* LLM Chat App Frontend
* 
* Memisahkan jelas antara UI dan logic, siap integrasi dengan index.ts
*/

// -------------------- DOM ELEMENTS --------------------
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// -------------------- CHAT STATE --------------------
let chatHistory = [
{
role: "assistant",
content:
"Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
},
];
let isProcessing = false;

// -------------------- UI HELPERS --------------------
/**

* Auto-resize textarea based on content
*/
userInput.addEventListener("input", function () {
this.style.height = "auto";
this.style.height = this.scrollHeight + "px";
});

/**

* Send message on Enter (without Shift)
*/
userInput.addEventListener("keydown", function (e) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
sendMessage();
});

/**

* Send button click handler
*/
sendButton.addEventListener("click", sendMessage);

/**

* Add message to chat UI
* @param {"user"|"assistant"} role
* @param {string} content
*/
function addMessageToChat(role, content) {
const messageEl = document.createElement("div");
messageEl.className = "message ${role}-message";
messageEl.innerHTML = "<p>${content}</p>";
chatMessages.appendChild(messageEl);

// Scroll to bottom
chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**

* Show typing indicator
*/
function showTypingIndicator() {
typingIndicator.classList.add("visible");
}

/**

* Hide typing indicator
*/
function hideTypingIndicator() {
typingIndicator.classList.remove("visible");
}

// -------------------- LOGIC --------------------
/**

* Main function to send a message and process AI response
*/
async function sendMessage() {
const message = userInput.value.trim();

// Prevent empty messages or concurrent requests
if (!message || isProcessing) return;

// -------------------- UI STATE DURING PROCESSING --------------------
isProcessing = true;
userInput.disabled = true;
sendButton.disabled = true;

// Add user message to chat
addMessageToChat("user", message);

// Clear input
userInput.value = "";
userInput.style.height = "auto";

// Show typing indicator
showTypingIndicator();

// -------------------- CHAT HISTORY --------------------
chatHistory.push({ role: "user", content: message });

// -------------------- AI API CALL --------------------
try {
// Create assistant message placeholder
const assistantMessageEl = document.createElement("div");
assistantMessageEl.className = "message assistant-message";
assistantMessageEl.innerHTML = "<p></p>";
chatMessages.appendChild(assistantMessageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;

// Fetch AI response via index.ts endpoint
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: chatHistory }),
});

if (!response.ok) throw new Error("Failed to get response");

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

// Add completed response to history
chatHistory.push({ role: "assistant", content: responseText });

} catch (error) {
console.error("Error:", error);
addMessageToChat(
"assistant",
"Sorry, there was an error processing your request."
);
} finally {
// -------------------- UI RESET --------------------
hideTypingIndicator();
isProcessing = false;
userInput.disabled = false;
sendButton.disabled = false;
userInput.focus();
}
}

// -------------------- EXPORT --------------------
// Siap untuk di-import atau digunakan langsung di index.html
export default {
sendMessage,
addMessageToChat,
};
