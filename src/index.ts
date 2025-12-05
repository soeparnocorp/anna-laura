import { Env, ChatMessage } from "./types";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname.startsWith("/chat.js")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      const { messages, model = DEFAULT_MODEL, temperature }: {
        messages: ChatMessage[];
        model?: string;
        temperature?: number;
      } = await request.json();

      const options: any = { messages, max_tokens: 1024 };

      // Hanya kirim temperature kalau ada & bukan NaN
      if (typeof temperature === "number" && !isNaN(temperature)) {
        options.temperature = temperature;
      }

      const response = await env.AI.run(model, options, {
        returnRawResponse: true,
      });

      return response;
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
