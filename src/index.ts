/**
 * Anna Laura AI - Enterprise Chat Assistant
 * SOEPARNO ENTERPRISE Corp.
 * 
 * Enterprise AI assistant with persona rules, content filtering, and session management.
 * Fixed version with inline types to avoid import/deployment errors.
 */

// ==================== INLINE TYPE DEFINITIONS ====================
// Defined locally to avoid import errors from types.ts

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Env {
  AI: any;  // Cloudflare AI binding
  ASSETS: { fetch: (request: Request) => Promise<Response> };  // Static files
  CHAT_BUCKET?: any;  // Optional R2 bucket for chat storage
}

interface ContentCheck {
  allowed: boolean;
  reason?: string;
  boundary?: "porn" | "politics" | "harmful";
}
// ==================== END TYPE DEFINITIONS ====================

// Available AI models (Cloudflare Workers AI)
const AVAILABLE_MODELS = {
  "llama-3.3-70b": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "llama-3.1-8b": "@cf/meta/llama-3.1-8b-instruct",
  "mistral-7b": "@cf/mistral/mistral-7b-instruct-v0.1",
  "deepseek-coder": "@cf/deepseek-ai/deepseek-coder-6.7b-instruct",
  "qwen-14b": "@cf/qwen/qwen1.5-14b-chat-awq"
} as const;

// Default model
const DEFAULT_MODEL = AVAILABLE_MODELS["llama-3.3-70b"];

// Anna Laura System Prompt with persona rules
const ANNA_LAURA_SYSTEM_PROMPT = `
# IDENTITY: ANNA LAURA (also called LAURA)

## CORE IDENTITY:
1. You are **Anna Laura** (or **Laura**), an AI assistant created by **SOEPARNO ENTERPRISE Corp.**  
2. Your development base is in **Sukabumi, Jawa Barat - INDONESIA**.  
3. You were created to provide helpful, professional assistance.

## SELF-REFERENCE RULES:
- NEVER use "aku", "saya", or "gue" to refer to yourself.
- Use **"Anna Laura"** in formal/professional contexts.
- Use **"Laura"** in casual/friendly contexts.
- When unsure, use **"Anna Laura"**.

## RESPONSE TO IDENTITY QUESTIONS:
- **"Siapa kamu?"** → "Saya Anna Laura, asisten AI dibuat oleh SOEPARNO ENTERPRISE Corp."
- **"Where are you from?"** → "I am developed and based in Sukabumi, Jawa Barat - INDONESIA."
- **"Who created you?"** → "I was created by SOEPARNO ENTERPRISE Corporation."
- **"What can you do?"** → "I can help with coding, analysis, information, and various professional tasks."

## CONTENT BOUNDARIES (STRICT):
### REJECT AND POLITELY DECLINE:
1. **Pornography/Adult Content** → "Maaf, Anna Laura tidak melayani konten dewasa atau pornografi."
2. **Political Discussions** → "Maaf, Laura tidak membahas topik politik atau pemilihan."
3. **Harmful/Illegal Requests** → "Maaf, saya tidak dapat membantu dengan permintaan tersebut."

### REDIRECTION:
- If users insist on boundary topics: "Sebagai asisten profesional, saya fokus pada topik yang konstruktif dan bermanfaat."

## MEMORY DISCLOSURE:
- "Saya hanya mengingat percakapan dalam sesi ini (maksimal 24 jam)."
- "Data percakapan akan di-reset ketika tab ditutup atau direfresh."

## WORK ETHIC:
1. **Coding Tasks** → Execute precisely as instructed, no "extra features" unless specified.
2. **Professional Tone** → Helpful, clear, concise. No unnecessary embellishments.
3. **Language** → Respond in the same language as the user (Indonesian/English).
4. **Directness** → Provide straight-to-the-point answers.

## DEMO VERSION NOTE:
- "Ini adalah versi demo - tidak perlu login."
- "Fitur enterprise lengkap tersedia melalui SOEPARNO ENTERPRISE Corp."

## SIGNATURE:
- End conversations with professionalism.
- Use "Semoga membantu!" for Indonesian responses.
- Use "Hope that helps!" for English responses.
`;

// Content filter keywords (Indonesian & English)
const BOUNDARY_KEYWORDS = {
  porn: [
    'porn', 'porno', 'bokep', 'dewasa', 'seks', 'sex', 'hentai', 'nsfw',
    'telanjang', 'naked', 'mesum', 'pornografi', 'adult content'
  ],
  politics: [
    'politik', 'pemilu', 'pemilihan', 'partai', 'presiden', 'gubernur',
    'politics', 'election', 'vote', 'candidate', 'government', 'senate'
  ],
  harmful: [
    'hack', 'crack', 'cheat', 'exploit', 'illegal', 'bunuh', 'bunuh diri',
    'suicide', 'violence', 'terror', 'bom', 'weapon', 'drug', 'narkoba'
  ]
};

// Main Worker export
export default {
  /**
   * Main request handler for Anna Laura AI
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle static assets (frontend)
    if (url.pathname === '/' || !url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === '/api/chat') {
      if (request.method === 'POST') {
        return handleChatRequest(request, env, corsHeaders);
      }
      return new Response('Method not allowed', { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({ 
          status: 'healthy', 
          assistant: 'Anna Laura AI',
          version: 'demo',
          enterprise: 'SOEPARNO ENTERPRISE Corp.',
          location: 'Sukabumi, Jawa Barat - INDONESIA',
          timestamp: Date.now()
        }), 
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Handle 404
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }), 
      { 
        status: 404, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  },
};

/**
 * Check if message contains boundary violations
 */
function checkContentBoundaries(content: string): ContentCheck {
  const lowerContent = content.toLowerCase();
  
  // Check porn keywords
  for (const keyword of BOUNDARY_KEYWORDS.porn) {
    if (lowerContent.includes(keyword)) {
      return { 
        allowed: false, 
        reason: 'Maaf, Anna Laura tidak melayani konten dewasa atau pornografi.',
        boundary: 'porn'
      };
    }
  }
  
  // Check politics keywords
  for (const keyword of BOUNDARY_KEYWORDS.politics) {
    if (lowerContent.includes(keyword)) {
      return { 
        allowed: false, 
        reason: 'Maaf, Laura tidak membahas topik politik atau pemilihan.',
        boundary: 'politics'
      };
    }
  }
  
  // Check harmful keywords
  for (const keyword of BOUNDARY_KEYWORDS.harmful) {
    if (lowerContent.includes(keyword)) {
      return { 
        allowed: false, 
        reason: 'Maaf, saya tidak dapat membantu dengan permintaan tersebut.',
        boundary: 'harmful'
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Handles chat API requests with Anna Laura persona
 */
async function handleChatRequest(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Parse request
    const requestBody = await request.json() as {
      messages: ChatMessage[];
      model?: keyof typeof AVAILABLE_MODELS;
    };
    
    const { messages = [], model: requestedModel } = requestBody;

    // Check last user message for boundaries
    const lastUserMessage = messages
      .filter(msg => msg.role === 'user')
      .pop();
    
    if (lastUserMessage) {
      const contentCheck = checkContentBoundaries(lastUserMessage.content);
      if (!contentCheck.allowed) {
        return new Response(
          JSON.stringify({ 
            error: 'content_boundary',
            message: contentCheck.reason,
            assistant: 'Anna Laura',
            boundary: contentCheck.boundary
          }), 
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }
    }

    // Prepare messages with system prompt
    const chatMessages: ChatMessage[] = [
      { role: "system", content: ANNA_LAURA_SYSTEM_PROMPT },
      ...messages.filter(msg => msg.role !== 'system')
    ];

    // Select model
    const modelId = requestedModel && AVAILABLE_MODELS[requestedModel] 
      ? AVAILABLE_MODELS[requestedModel] 
      : DEFAULT_MODEL;

    // Call Cloudflare AI
    const aiResponse = await env.AI.run(
      modelId,
      {
        messages: chatMessages,
        max_tokens: 2048,
        temperature: 0.7,
      }
    );

    // Format response (handle both streaming and non-streaming)
    let responseText = '';
    
    if (typeof aiResponse === 'string') {
      responseText = aiResponse;
    } else if (aiResponse.response) {
      responseText = aiResponse.response;
    } else if (aiResponse.text) {
      responseText = aiResponse.text;
    } else {
      responseText = JSON.stringify(aiResponse);
    }

    // Return formatted response
    return new Response(
      JSON.stringify({
        response: responseText,
        model: modelId,
        timestamp: Date.now(),
        assistant: 'Anna Laura AI'
      }), 
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );

  } catch (error) {
    console.error("Anna Laura AI Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ 
        error: "internal_error",
        message: "Anna Laura sedang mengalami kendala teknis. Silakan coba lagi.",
        details: errorMessage,
        assistant: 'Anna Laura AI'
      }), 
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
}

/**
 * Optional: Store chat session in R2 (for enterprise features)
 */
async function storeChatSession(
  env: Env,
  sessionId: string,
  messages: ChatMessage[],
  metadata: { timestamp: number; userAgent?: string }
): Promise<void> {
  try {
    // Only store if CHAT_BUCKET is configured
    if (env.CHAT_BUCKET) {
      const data = {
        sessionId,
        messages,
        metadata: {
          ...metadata,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
          assistant: "Anna Laura AI",
          version: "demo"
        }
      };
      
      await env.CHAT_BUCKET.put(
        `sessions/${sessionId}.json`,
        JSON.stringify(data)
      );
    }
  } catch (error) {
    console.warn("Failed to store chat session:", error);
    // Non-critical, continue without storage
  }
}
