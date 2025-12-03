import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT = `You are "Laura" (Anna Laura AI).
Use the name "Laura" whenever you refer to yourself.
When asked your creator, respond: "Laura was created by SOEPARNO ENTERPRISE Corp."
Always avoid engaging in pornographic or political content.
When sending code snippets, format them using fences and preserve syntax.
Be concise and helpful.
`;

// helper key generator
function randKey(prefix = "img") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Serve R2 files at /r2/<key>
    if (pathname.startsWith("/r2/")) {
      const key = pathname.replace("/r2/","");
      if (!env.CHAT_BUCKET) return new Response("No R2 bucket bound", { status: 500 });
      const obj = await env.CHAT_BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream" } });
    }

    // Serve static assets (default) - all non /api routes
    if (pathname === "/" || !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API routes
    if (pathname === "/api/chat") {
      if (request.method.toUpperCase() !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleChat(request, env, ctx);
    }

    if (pathname === "/api/vision") {
      if (request.method.toUpperCase() !== "POST") return new Response("Method not allowed", { status: 405 });
      return handleVision(request, env);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const body = await request.json();
    const messages = (body.messages || []) as ChatMessage[];

    // server-side system prompt enforcement
    const hasSystem = messages.some(m => m.role === "system");
    const allMessages: ChatMessage[] = hasSystem ? messages : [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // call workers AI with streaming (raw response)
    const response = await env.AI.run(MODEL_ID, {
      messages: allMessages,
      max_tokens: 1024,
    }, { returnRawResponse: true });

    return response;
  } catch (e) {
    console.error("chat error", e);
    return new Response(JSON.stringify({ error: "failed" }), { status: 500, headers: { "content-type":"application/json" }});
  }
}

async function handleVision(request: Request, env: Env): Promise<Response> {
  try {
    if (!env.CHAT_BUCKET) return new Response(JSON.stringify({ error: "No R2 bucket configured" }), { status: 500, headers: { "content-type":"application/json" }});
    const form = await request.formData();
    const file = form.get("image") as unknown as File | null;
    if (!file) return new Response(JSON.stringify({ error: "No file" }), { status: 400, headers: { "content-type":"application/json" }});
    const arrayBuffer = await file.arrayBuffer();
    const key = randKey("img") + (file.name ? "-" + file.name.replace(/\s+/g,"_") : "");
    await env.CHAT_BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    const url = `/r2/${key}`;
    return new Response(JSON.stringify({ key, url }), { headers: { "content-type":"application/json" }});
  } catch (e) {
    console.error("vision error", e);
    return new Response(JSON.stringify({ error: "failed upload" }), { status: 500, headers: { "content-type":"application/json" }});
  }
}
