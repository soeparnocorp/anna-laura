/**
 * Grok Lite – Frontend Chat (Fixed & Enhanced)
 * Tested 100 % dengan template Cloudflare Workers AI lo
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const modelSelect = document.getElementById("model-select");
const tempSlider = document.getElementById("temp-slider");
const tempValue = document.getElementById("temp-value");

let chatHistory = [
  {
    role: "system",
    content:
      "Kamu adalah Grok Lite – helpful, sarkastik, santai, dan selalu jawab dalam bahasa Indonesia yang asik.",
  },
];

tempSlider.addEventListener("input", () => {
  tempValue.textContent = tempSlider.value.padEnd(4, "0");
});

userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || sendButton.disabled) return;

  // Lock UI
  sendButton.disabled = true;
  userInput.disabled = true;
  addMessage("user", message);
  userInput.value = "";
  userInput.style.height = "auto";
  typingIndicator.classList.add("visible");

  chatHistory.push({ role: "user", content: message });

  // Placeholder jawaban AI
  const aiDiv = document.createElement("div");
  aiDiv.className = "message assistant-message";
  aiDiv.innerHTML = `<div class="content"></div>`;
  chatMessages.appendChild(aiDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatHistory,
        model: modelSelect.value,
        temperature: parseFloat(tempSlider.value),
      }),
    });

    if (!res.ok) throw new Error("Network error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Simpan sisa yang belum lengkap

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.response) {
            fullText += json.response;
            aiDiv.querySelector(".content").innerHTML = marked.parse(fullText);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        } catch (e) {
          // ignore malformed line
        }
      }
    }

    // Pastikan buffer sisa terakhir ikut ter-parse (ini yang bikin tidak stuck!)
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer);
        if (json.response) {
          fullText += json.response;
          aiDiv.querySelector(".content").innerHTML = marked.parse(fullText);
        }
      } catch (e) {}
    }

    // Simpan jawaban final ke history
    const finalAnswer = aiDiv.querySelector(".content").innerText || "";
    chatHistory.push({ role: "assistant", content: finalAnswer });
  } catch (err) {
    addMessage("assistant", "Maaf bro, ada error. Coba lagi ya.");
  } finally {
    typingIndicator.classList.remove("visible");
    sendButton.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

function addMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message ${role}-message`;
  const rendered = role === "user" ? content : marked.parse(content);
  div.innerHTML = `<div class="content">${rendered}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
