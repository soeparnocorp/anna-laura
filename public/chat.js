/* =========================
3. chat.js
========================= */
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [
{ role: "assistant", content: "Hello! I'm Laura, powered by Cloudflare Workers AI." },
];
let isProcessing = false;

userInput.addEventListener("input", function () {
this.style.height = "auto";
this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
sendMessage();
}
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage() {
const message = userInput.value.trim();
if (message === "" || isProcessing) return;

isProcessing = true;
userInput.disabled = true;
sendButton.disabled = true;

addMessageToChat("user", message);
chatHistory.push({ role: "user", content: message });

userInput.value = "";
userInput.style.height = "auto";
typingIndicator.classList.add("visible");

const assistantMessageEl = document.createElement("div");
assistantMessageEl.className = "message assistant-message";
assistantMessageEl.innerHTML = "<p></p>";
chatMessages.appendChild(assistantMessageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;

try {
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
        responseText += jsonData.response.replace(/\baku\b/gi, "Laura");
        assistantMessageEl.querySelector("p").textContent = responseText;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    } catch {}
  }
}

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

function addMessageToChat(role, content) {
const messageEl = document.createElement("div");
messageEl.className = "message ${role}-message";
messageEl.innerHTML = "<p>${content}</p>";
chatMessages.appendChild(messageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;
}
