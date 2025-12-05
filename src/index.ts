import { Env, ChatMessage } from "./types";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve static files
    if (url.pathname === "/" || url.pathname.startsWith("/chat.js")) {
      return env.ASSETS.fetch(request);
    }

    // API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const { messages, model = DEFAULT_MODEL, temperature = 0.7 } = await request.json<{
        messages: ChatMessage[];
        model?: string;
        temperature?: number;
      }>();

      const response = await env.AI.run(
        model,
        {
          messages,
          temperature,
          max_tokens: 1024,
        },
        { returnRawResponse: true }
      );

      return response; // streaming langsung
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
