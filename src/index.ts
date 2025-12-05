import { Env, ChatMessage } from "./types";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
async fetch(request: Request, env: Env): Promise<Response> {
const url = new URL(request.url);

// Serve static assets
if (url.pathname === "/" || url.pathname.startsWith("/chat.js")) {
  return env.ASSETS.fetch(request);
}

// Chat API
if (url.pathname === "/api/chat" && request.method === "POST") {
  const { messages, model = DEFAULT_MODEL, temperature, persona = "normal", easterMode = false }: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    persona?: string;
    easterMode?: boolean;
  } = await request.json();

  let promptMessages = messages.map(m => ({ ...m }));

  // Tambahkan persona ke prompt
  if (persona === "sarkastik") {
    promptMessages.push({
      role: "system",
      content: "Jawablah dengan sarkastik dan lucu, tetap informatif."
    });
  } else if (persona === "matre") {
    promptMessages.push({
      role: "system",
      content: "Jawablah dengan gaya matre / ngejual, tapi tetap masuk akal."
    });
  } else {
    promptMessages.push({
      role: "system",
      content: "Jawablah secara netral dan informatif."
    });
  }

  // Easter egg: Grok mode
  if (easterMode) {
    promptMessages.push({
      role: "system",
      content: "Kadang-kadang ngaku-ngaku Grok Lite untuk iseng."
    });
  }

  const options: any = { messages: promptMessages, max_tokens: 1024 };
  if (typeof temperature === "number" && !isNaN(temperature)) {
    options.temperature = temperature;
  }

  const response = await env.AI.run(model, options, { returnRawResponse: true });
  return response;
}

return new Response("Not found", { status: 404 });

},
} satisfies ExportedHandler<Env>;
