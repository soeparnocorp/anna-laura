/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
  /**
   * Binding for the Workers AI API.
   */
  AI: Ai;

  /**
   * Binding for static assets.
   */
  ASSETS: { fetch: (request: Request) => Promise<Response> };

  /**
   * R2 bucket binding (CHAT_BUCKET) for uploaded images
   */
  CHAT_BUCKET?: any; // use Cloudflare R2 bucket binding; typed as any to avoid strict issues
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
