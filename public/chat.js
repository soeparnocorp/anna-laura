// DOM Elements
const landingContainer = document.getElementById("landing-container");
const landingInput = document.getElementById("landing-input");
const optionButtons = document.querySelectorAll(".option");
const chatContainer = document.getElementById("chat-container");
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// State
let chatHistory = [
{ role: "assistant", content: "Hello! Aku Laura, asisten AI kamu. Apa yang bisa aku bantu hari ini?" }
];
let isProcessing = false;
let sessionTitle = "";

// --- Landing Input Event ---
function startChatWithInput(text) {
sessionTitle = text || "Percakapan Baru";
landingContainer.classList.add("hidden");
chatContainer.classList.add("active");
document.title = sessionTitle;
userInput.focus();
if(text) {
addMessageToChat("user", text);
chatHistory.push({role:"user", content:text});
}
}

landingInput.addEventListener("keydown", function(e){
if(e.key === "Enter") {
e.preventDefault();
const text = landingInput.value.trim();
if(text) startChatWithInput(text);
}
});

// --- Option Buttons ---
optionButtons.forEach(btn => {
btn.addEventListener("click", () => {
const prompt = btn.dataset.prompt;
startChatWithInput(prompt);
});
});

// --- Chat JS Logic (UI + AI) ---
// Auto-resize textarea
userInput.addEventListener("input", function() {
this.style.height = "auto";
this.style.height = this.scrollHeight + "px";
});

// Send on Enter (without Shift)
userInput.addEventListener("keydown", function(e) {
if(e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
sendMessage();
}
});

// Send button
sendButton.addEventListener("click", sendMessage);

function addMessageToChat(role, content) {
const messageEl = document.createElement("div");
messageEl.className = "message ${role}-message";
messageEl.innerHTML = "<p>${content}</p>";
chatMessages.appendChild(messageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
const message = userInput.value.trim();
if(message === "" || isProcessing) return;

isProcessing = true;
userInput.disabled = true;
sendButton.disabled = true;

addMessageToChat("user", message);
chatHistory.push({role:"user", content:message});
userInput.value = "";
userInput.style.height = "auto";
typingIndicator.classList.add("visible");

try {
const assistantMessageEl = document.createElement("div");
assistantMessageEl.className = "message assistant-message";
assistantMessageEl.innerHTML = "<p></p>";
chatMessages.appendChild(assistantMessageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;

// --- Backend fetch --- (index.ts tetap tidak disentuh)
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: chatHistory })
});

if(!response.ok) throw new Error("Failed to get response");

const reader = response.body.getReader();
const decoder = new TextDecoder();
let responseText = "";

while(true) {
  const {done, value} = await reader.read();
  if(done) break;
  const chunk = decoder.decode(value, {stream:true});
  const lines = chunk.split("\n");
  for(const line of lines){
    try{
      const jsonData = JSON.parse(line);
      if(jsonData.response){
        responseText += jsonData.response;
        assistantMessageEl.querySelector("p").textContent = responseText;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    } catch(e){ console.error("JSON parse error:", e); }
  }
}

chatHistory.push({role:"assistant", content:responseText});

} catch(err) {
console.error(err);
addMessageToChat("assistant", "Maaf, terjadi kesalahan saat memproses pesanmu.");
} finally {
typingIndicator.classList.remove("visible");
isProcessing = false;
userInput.disabled = false;
sendButton.disabled = false;
userInput.focus();
}
}
