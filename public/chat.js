// public/chat.js
// Frontend interactions for Anna Laura AI
// - UI + streaming chat (/api/chat)
// - image upload to /api/vision via + button
// - per-message actions: copy, like, dislike, sound (client TTS), reload, share
// - localStorage per-tab 24-hour memory

(() => {
  // DOM refs
  const loadingEl = document.getElementById("loading");
  const appEl = document.getElementById("app");
  const messagesEl = document.getElementById("messages");
  const typingEl = document.getElementById("typing");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const plusBtn = document.getElementById("plus-btn");

  let isProcessing = false;
  let chatHistory = []; // { role: 'user'|'assistant', content: string, ts: number, originalUser?: string }

  const LS_CHAT = "laura_chat_v1";
  const LS_TIME = "laura_chat_time_v1";
  const MAX_CTX = 12;

  // Utilities
  function now() { return Date.now(); }

  function loadChat() {
    try {
      const ts = Number(localStorage.getItem(LS_TIME) || "0");
      if (!ts || (now() - ts) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(LS_CHAT);
        localStorage.setItem(LS_TIME, String(now()));
        return [];
      }
      const raw = localStorage.getItem(LS_CHAT);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("loadChat parse failed", e);
      return [];
    }
  }

  function saveChat() {
    try {
      localStorage.setItem(LS_CHAT, JSON.stringify(chatHistory));
      localStorage.setItem(LS_TIME, String(now()));
    } catch (e) {
      console.warn("saveChat failed", e);
    }
  }

  function escapeHtml(s) {
    return (s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\n","<br/>");
  }

  function stripHtml(s) {
    const tmp = document.createElement("div");
    tmp.innerHTML = s || "";
    return tmp.textContent || tmp.innerText || "";
  }

  // Create bubble with action buttons
  function createBubble(role, content, meta = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = `bubble ${role === "assistant" ? "ai" : "user"}`;
    const inner = document.createElement("div");
    inner.className = "bubble-content";
    inner.innerHTML = content;
    wrapper.appendChild(inner);

    const actions = document.createElement("div");
    actions.className = "msg-actions";

    // Copy
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const txt = stripHtml(inner.innerText || inner.textContent || "");
      navigator.clipboard.writeText(txt);
    });
    actions.appendChild(copyBtn);

    // Like
    const likeBtn = document.createElement("button");
    likeBtn.textContent = "👍";
    likeBtn.addEventListener("click", () => {
      likeBtn.animate([{ transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 120 });
    });
    actions.appendChild(likeBtn);

    // Dislike
    const dislikeBtn = document.createElement("button");
    dislikeBtn.textContent = "👎";
    actions.appendChild(dislikeBtn);

    // Sound (client-side TTS)
    const soundBtn = document.createElement("button");
    soundBtn.textContent = "🔊";
    soundBtn.addEventListener("click", () => {
      const txt = stripHtml(inner.innerText || inner.textContent || "");
      if (!("speechSynthesis" in window)) {
        alert("Text-to-Speech tidak tersedia di browser ini.");
        return;
      }
      const utter = new SpeechSynthesisUtterance(txt);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
    actions.appendChild(soundBtn);

    // Reload (regenerate)
    const reloadBtn = document.createElement("button");
    reloadBtn.textContent = "⟳";
    reloadBtn.addEventListener("click", () => {
      // if originalUser exists in meta, re-run conversation with that prompt
      if (meta.originalUser) {
        sendMessage(meta.originalUser, { systemFollowUp: true });
      } else {
        alert("Tidak ada prompt asli untuk diulang.");
      }
    });
    actions.appendChild(reloadBtn);

    // Share
    const shareBtn = document.createElement("button");
    shareBtn.textContent = "Share";
    shareBtn.addEventListener("click", async () => {
      const txt = stripHtml(inner.innerText || inner.textContent || "");
      if (navigator.share) {
        try { await navigator.share({ text: txt }); } catch (e) { /* ignore */ }
      } else {
        navigator.clipboard.writeText(txt);
        alert("Teks disalin ke clipboard");
      }
    });
    actions.appendChild(shareBtn);

    wrapper.appendChild(actions);
    return wrapper;
  }

  // Append assistant chunk safely (for streaming)
  function appendToAssistantChunk(textChunk) {
    const assistants = messagesEl.querySelectorAll(".bubble.ai .bubble-content");
    const last = assistants[assistants.length - 1];
    if (!last) return;
    // append escaped chunk
    last.innerHTML = (last.innerHTML || "") + escapeHtml(textChunk);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Push message to UI and optionally save
  function pushMessage(role, content, meta = {}, save = true) {
    const el = createBubble(role === "assistant" ? "assistant" : "user", escapeHtml(content), meta);
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (save) {
      chatHistory.push({ role: role === "assistant" ? "assistant" : "user", content, ts: now(), originalUser: meta.originalUser || null });
      saveChat();
    }
  }

  // Build conversation payload limited to last N messages
  function buildPayload(userText) {
    const payload = [];
    const start = Math.max(0, chatHistory.length - MAX_CTX);
    for (let i = start; i < chatHistory.length; i++) {
      const m = chatHistory[i];
      payload.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
    }
    payload.push({ role: "user", content: userText });
    return payload;
  }

  // Send message to backend (streaming)
  async function sendMessage(textParam, opts = {}) {
    if (isProcessing) return;
    const text = typeof textParam === "string" ? textParam : (userInput.value || "").trim();
    if (!text) return;
    if (!textParam) userInput.value = "";

    isProcessing = true;
    typingEl.classList.add("visible");
    sendBtn.disabled = true;
    userInput.disabled = true;

    // push user bubble
    pushMessage("user", text, {}, true);

    // prepare payload
    const payload = buildPayload(text);

    // add assistant placeholder
    const placeholder = createBubble("assistant", "", { originalUser: text });
    messagesEl.appendChild(placeholder);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload })
      });

      if (!res.ok) {
        const txt = await res.text();
        appendToAssistantChunk("\n[Error: " + (txt || res.statusText) + "]");
        throw new Error("Bad response");
      }

      // stream - robustly append chunks
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const rr = await reader.read();
        done = rr.done;
        if (rr.value) {
          const chunk = decoder.decode(rr.value, { stream: true });
          // strip SSE "data: " prefixes if present and [DONE] tokens, then append best-effort
          const cleaned = chunk.replace(/data: /g, "").replace(/\[DONE\]/g, "");
          appendToAssistantChunk(cleaned);
        }
      }

      // finalize: capture assistant final text (textContent)
      const lastAssistant = Array.from(messagesEl.querySelectorAll(".bubble.ai")).pop();
      const assistantText = lastAssistant ? (lastAssistant.firstElementChild.innerText || lastAssistant.firstElementChild.textContent) : "";
      // post-process: replace occurrences of ' aku ' (word) with ' Laura ' for display safety (additional to server prompt)
      const finalText = assistantText.replace(/\baku\b/gi, "Laura");
      // replace inner content with escaped finalText (keep line breaks)
      if (lastAssistant) {
        lastAssistant.firstElementChild.innerHTML = escapeHtml(finalText).replaceAll("\n","<br/>");
      }

      // save assistant final into chatHistory (update last assistant)
      chatHistory.push({ role: "assistant", content: finalText, ts: now(), originalUser: text });
      saveChat();

    } catch (e) {
      console.error("sendMessage error", e);
      // replace placeholder with error bubble
      const lastAssistant = Array.from(messagesEl.querySelectorAll(".bubble.ai")).pop();
      if (lastAssistant) {
        lastAssistant.firstElementChild.innerText = "Maaf, terjadi kesalahan saat memproses permintaan.";
      } else {
        pushMessage("assistant", "Maaf, terjadi kesalahan saat memproses permintaan.", {}, true);
      }
    } finally {
      isProcessing = false;
      typingEl.classList.remove("visible");
      sendBtn.disabled = false;
      userInput.disabled = false;
      userInput.focus();
    }
  }

  // Image upload flow -> POST /api/vision
  function handleImageUpload(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    // optimistic UI: show preview as user message
    const url = URL.createObjectURL(file);
    pushMessage("user", `[Image uploaded]`, { preview: url }, true);
    fetch("/api/vision", { method: "POST", body: fd })
      .then(r => r.json())
      .then(res => {
        if (res && res.url) {
          // inform user with returned r2 URL
          pushMessage("assistant", `Gambar diunggah: ${res.url}\nKetik "analisa gambar ${res.url}" untuk meminta Laura menganalisis.`, {}, true);
        } else {
          pushMessage("assistant", "Gagal mengunggah gambar.", {}, true);
        }
      })
      .catch(err => {
        console.error("vision upload failed", err);
        pushMessage("assistant", "Gagal mengunggah gambar.", {}, true);
      });
  }

  // plus button -> open file picker for image only
  plusBtn.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = () => {
      if (inp.files && inp.files[0]) handleImageUpload(inp.files[0]);
    };
    inp.click();
  });

  // send actions
  sendBtn.addEventListener("click", () => sendMessage());
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // init
  function init() {
    setTimeout(() => {
      loadingEl.style.display = "none";
      appEl.style.display = "block";
    }, 2400);

    chatHistory = loadChat();
    if (!chatHistory || chatHistory.length === 0) {
      chatHistory = [{ role: "assistant", content: "Hello! Laura siap membantu. Apa yang ingin kamu tanyakan?", ts: now() }];
      saveChat();
    }
    // render loaded history
    messagesEl.innerHTML = "";
    for (const m of chatHistory) {
      const role = (m.role === "assistant") ? "assistant" : "user";
      const bubble = createBubble(role, escapeHtml(m.content), { originalUser: m.originalUser });
      messagesEl.appendChild(bubble);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // start
  init();

})();
