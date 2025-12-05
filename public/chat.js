// chat.js – versi stabil Grok Lite AI

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const modelSelect = document.getElementById("model-select");
const personaSelect = document.getElementById("persona-select");
const tempSlider = document.getElementById("temp-slider");
const tempValue = document.getElementById("temp-value");

let chatHistory = [
{
role: "assistant",
content: "Halo bro! Gue Grok Lite – siap ngobrol iseng atau serius. Pilih persona ya!",
},
];
let isProcessing = false;

// Update slider value
tempSlider.addEventListener("input", () => {
tempValue.textContent = parseFloat(tempSlider.value).toFixed(2);
});

// Auto-resize textarea
userInput.addEventListener("input", function () {
this.style.height = "auto";
this.style.height = this.scrollHeight + "px";
});

// Send on Enter
userInput.addEventListener("keydown", function (e) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
sendMessage();
}
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage() {
const message = (userInput.value || "").trim();
if (message === "" || isProcessing) return;

isProcessing = true;
userInput.disabled = true;
sendButton.disabled = true;

addMessageToChat("user", message);
userInput.value = "";
userInput.style.height = "auto";

typingIndicator.classList.add("visible");

chatHistory.push({ role: "user", content: message });

let easterMode = /grok mode/i.test(message);

try {
const assistantMessageEl = document.createElement("div");
assistantMessageEl.className = "message assistant-message";
assistantMessageEl.innerHTML = "<p></p>";
chatMessages.appendChild(assistantMessageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;

const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: chatHistory,
    model: modelSelect.value,
    temperature: parseFloat(tempSlider.value),
    persona: personaSelect.value,
    easterMode,
  }),
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
    } catch (e) { console.error("Error parsing JSON:", e); }
  }
}

chatHistory.push({ role: "assistant", content: responseText });

} catch (error) {
console.error("Error:", error);
addMessageToChat("assistant", "Maaf, ada error. Coba lagi ya.");
} finally {
typingIndicator.classList.remove("visible");
isProcessing = false;
userInput.disabled = false;
sendButton.disabled = false;
userInput.focus();
}
}

function addMessageToChat(role, content) {
if (!content) content = "";
const messageEl = document.createElement("div");
messageEl.className = "message ${role}-message";
messageEl.textContent = content; // aman, no template literal
chatMessages.appendChild(messageEl);
chatMessages.scrollTop = chatMessages.scrollHeight;
}
