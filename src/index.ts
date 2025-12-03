/* =========================
2. index.ts
========================= */
import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SYSTEM_PROMPT =
"You are Laura, a helpful assistant. Replace 'aku' with 'Laura'. Avoid porn/politics. Answer code snippets separately. Creator: SOEPARNO ENTERPRISE Corp.";

export default {
async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
const url = new URL(request.url);

if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
  return env.ASSETS.fetch(request);
}

if (url.pathname === "/api/chat") {
  if (request.method === "POST") return handleChatRequest(request, env);
  return new Response("Method not allowed", { status: 405 });
}

return new Response("Not found", { status: 404 });

},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
try {
const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

if (!messages.some((msg) => msg.role === "system")) {
  messages.unshift({ role: "system", content: SYSTEM_PROMPT });
}

const response = await env.AI.run(
  MODEL_ID,
  { messages, max_tokens: 1024 },
  { returnRawResponse: true }
);

return response;

} catch (error) {
console.error("Error processing chat request:", error);
return new Response(JSON.stringify({ error: "Failed to process request" }), {
status: 500,
headers: { "content-type": "application/json" },
});
}
}
