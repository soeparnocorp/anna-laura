/* =========================

1. types.ts
========================= */
export interface Env {
AI: Ai;
ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export interface ChatMessage {
role: "system" | "user" | "assistant";
content: string;
}
