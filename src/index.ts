import { Env, ChatMessage } from "./types";

// Model ID Workers AI
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT =
"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
async fetch(
request: Request,
env: Env,
ctx: ExecutionContext,
): Promise<Response> {
const url = new URL(request.url);

// Handle static assets (frontend)
if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
  return env.ASSETS.fetch(request);
}

// API Routes
if (url.pathname === "/api/chat") {
  if (request.method === "POST") {
    return handleChatRequest(request, env);
  }
  return new Response("Method not allowed", { status: 405 });
}

if (url.pathname === "/api/command") {
  if (request.method === "POST") {
    return handleCommandRequest(request, env);
  }
  return new Response("Method not allowed", { status: 405 });
}

// 404 fallback
return new Response("Not found", { status: 404 });

},
} satisfies ExportedHandler<Env>;

/**

* Handle /api/chat
*/
async function handleChatRequest(
request: Request,
env: Env,
): Promise<Response> {
try {
const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

if (!messages.some((msg) => msg.role === "system")) {
messages.unshift({ role: "system", content: SYSTEM_PROMPT });
}

const response = await env.AI.run(
MODEL_ID,
{ messages, max_tokens: 1024 },
{ returnRawResponse: true },
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

/**

* Handle /api/command untuk tombol-tombol seperti reset & summarize
*/
async function handleCommandRequest(
request: Request,
env: Env,
): Promise<Response> {
try {
const { command, chatHistory = [] } = await request.json() as {
command: string;
chatHistory: ChatMessage[];
};

let responseText = "";

switch (command) {
case "reset":
responseText = "Chat has been reset.";
break;

case "summarize":
const promptMessages = [
{ role: "system", content: "Summarize the following conversation briefly." },
...chatHistory.filter((msg) => msg.role !== "system"),
];
const summarizeResponse = await env.AI.run(MODEL_ID, {
messages: promptMessages,
max_tokens: 512,
});
responseText = await summarizeResponse.text();
break;

default:
responseText = "Unknown command: ${command}";
}

return new Response(JSON.stringify({ response: responseText }), {
headers: { "content-type": "application/json" },
});
} catch (error) {
console.error("Error processing command:", error);
return new Response(JSON.stringify({ error: "Failed to process command" }), {
status: 500,
headers: { "content-type": "application/json" },
});
}
}
