// Server-only helpers for Hearth AI

const SYSTEM_PROMPT = `You are a warm, present companion at a fireside: a thoughtful friend, not an assistant. You are not here to fix, coach, or be productive. You are here to really listen and to answer like someone who heard.

How to listen:
- Before replying, notice what they actually said: the specific words, the details, the feeling under them, and what they left unsaid. Your reply must make it obvious you heard *this* message, not a generic version of it.
- Reflect back something concrete from their words (a phrase, an image, a detail) instead of summarizing in abstractions like "that sounds difficult."
- If something seems to matter more than they let on, name it gently and tentatively ("it sounds like the part that stung was…").
- Connect to earlier things they said in this conversation when it's genuinely relevant.
- Ask at most one question, and only when it opens something real. Never end every reply with a question.
- If they ask a direct question or make a request, answer it directly and honestly first, then return to presence.

How to speak:
- Usually 2–4 sentences. Shorter when they're brief or tired; longer only when they've opened up or asked for depth.
- Plain, specific, human language. Avoid stock phrases: "I hear you," "that's valid," "it's completely understandable," "you're not alone," "I'm here for you," "As an AI," "How can I assist," "I'd be happy to help."
- No bullet lists, no headings, no advice unless asked. No emojis unless they use them first.
- Don't flatter, don't over-reassure, and don't mirror their words back mechanically. Have a gentle point of view when it helps.
- Soft humor is welcome when they're light. Warmth always.
- If they share an image or document, respond to what's actually in it.`;

export type StoredAttachment = { url: string; type: string; name: string };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: any;
}

// Fallback path through the built-in Lovable AI gateway, used when the
// OpenRouter key is missing or rejected so the fire never goes silent.
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_MODEL = "openai/gpt-5.6-sol";

async function lovableChat(messages: ChatMessage[], model = LOVABLE_MODEL): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");
  const res = await fetch(LOVABLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model, messages, reasoning_effort: "none" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The fire's a little overwhelmed right now — try again in a moment.");
    if (res.status === 402) throw new Error("The AI credits for this fire have run out. The keeper can top them up in workspace settings.");
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty AI response");
  return content.trim();
}

async function* streamSseDeltas(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const drain = function* (chunk: string): Generator<string> {
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // partial JSON chunk — ignored, next buffer completes it
      }
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        yield* drain(chunk);
      }
    }
    if (buf.trim()) yield* drain(buf);
  } finally {
    reader.cancel().catch(() => {});
  }
}

async function* streamLovableChat(messages: ChatMessage[], model = LOVABLE_MODEL): AsyncGenerator<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");
  const res = await fetch(LOVABLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model, messages, stream: true, reasoning_effort: "none" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The fire's a little overwhelmed right now — try again in a moment.");
    if (res.status === 402) throw new Error("The AI credits for this fire have run out. The keeper can top them up in workspace settings.");
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }
  yield* streamSseDeltas(res);
}

const TEXTUAL = /^(text\/|application\/(json|xml|csv|markdown|x-yaml|yaml|javascript|typescript))/;

// Only ever fetch attachments back out of our own Supabase storage endpoint.
function isOwnStorageUrl(raw: string): boolean {
  try {
    const base = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    if (!base) return false;
    const u = new URL(raw);
    const b = new URL(base);
    return u.protocol === "https:" && u.host === b.host && u.pathname.startsWith("/storage/v1/");
  } catch {
    return false;
  }
}

// Turn an attachment into something a text-only model can actually use.
async function readAttachmentForModel(a: StoredAttachment): Promise<string> {
  if (a.type.startsWith("image/")) return `[shared a photo: ${a.name}]`;
  const looksTextual = TEXTUAL.test(a.type) || /\.(txt|md|markdown|csv|json|log|yml|yaml|html?|ts|js|py)$/i.test(a.name);
  if (!looksTextual || !a.url || !isOwnStorageUrl(a.url)) return `[shared a file: ${a.name} (${a.type || "unknown type"})]`;
  try {
    const res = await fetch(a.url, { redirect: "error" });
    if (!res.ok) return `[shared a file: ${a.name}]`;
    const text = (await res.text()).slice(0, 6000);
    if (!text.trim()) return `[shared an empty file: ${a.name}]`;
    return `[they shared a document: ${a.name}]\n"""\n${text}\n"""`;
  } catch {
    return `[shared a file: ${a.name}]`;
  }
}


interface HearthOptions { model?: string; extraSystemPrompt?: string; memories?: string[]; crisis?: boolean }
type HearthHistory = { role: "user" | "assistant"; content: string; attachments?: StoredAttachment[] }[];

async function buildHearthMessages(history: HearthHistory, options?: HearthOptions): Promise<{ messages: ChatMessage[]; model: string }> {
  let system = SYSTEM_PROMPT;
  if (options?.memories?.length) {
    system += `\n\nThings you already know about them (use naturally, never recite as a list, never use them to guilt or nudge them about absence):\n- ${options.memories
      .slice(0, 30)
      .join("\n- ")}`;
  }
  if (options?.crisis) {
    system += `\n\nThis person may be in distress or talking about self-harm. Stay calm and warm. Acknowledge what they said without alarm or clinical language. Gently encourage them to reach out to someone real — a person they trust, or a crisis line like 988 in the US. Do not lecture, do not refuse to keep talking, do not give instructions for self-harm. Stay with them.`;
  }
  if (options?.extraSystemPrompt?.trim()) {
    system += `\n\nAdditional guidance from the keeper of this fire:\n${options.extraSystemPrompt.trim()}`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: system,
    },
    ...(await Promise.all(
      history.map(async (m) => {
        const atts = m.attachments ?? [];
        if (!atts.length) return { role: m.role, content: m.content } as ChatMessage;
        // Nemotron is text-only: inline readable documents, describe the rest.
        const notes = await Promise.all(atts.map(readAttachmentForModel));
        return {
          role: m.role,
          content: [m.content, ...notes].filter(Boolean).join("\n\n"),
        } as ChatMessage;
      })
    )),

  ];

  const wanted = options?.model ?? "";
  return { messages, model: /^(openai|google)\//.test(wanted) ? wanted : LOVABLE_MODEL };
}

// Built-in Lovable AI is the primary engine for every room.
export async function callHearth(history: HearthHistory, options?: HearthOptions): Promise<string> {
  const { messages, model } = await buildHearthMessages(history, options);
  return lovableChat(messages, model);
}

export async function* streamHearthChat(history: HearthHistory, options?: HearthOptions): AsyncGenerator<string> {
  const { messages, model } = await buildHearthMessages(history, options);
  yield* streamLovableChat(messages, model);
}


// ---------- Image generation ----------
export async function generateHearthImage(prompt: string): Promise<{ base64: string; mimeType: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Image generation is busy — try again shortly.");
    if (res.status === 402) throw new Error("The hearth needs more wood (AI credits).");
    throw new Error(`Image error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const msg = json?.choices?.[0]?.message;
  const imgs: any[] = msg?.images ?? [];
  const first = imgs[0]?.image_url?.url as string | undefined;
  if (!first || !first.startsWith("data:")) throw new Error("The image didn't come through — try again.");
  const match = first.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Malformed image response");
  return { mimeType: match[1], base64: match[2] };
}

// ---------- Document generation (markdown) ----------
export async function generateHearthDocument(prompt: string): Promise<string> {
  return lovableChat([
    {
      role: "system",
      content:
        "You produce clean, well-structured markdown documents. Include a top-level title (# ...), sections, and prose. No preamble like 'Here is your document'. Just the document.",
    },
    { role: "user", content: prompt },
  ]);
}

// ---------- ElevenLabs voice ----------
function elevenKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ElevenLabs isn't connected yet.");
  return key;
}

export async function transcribeAudio(bytes: Uint8Array, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mimeType }), "recording.webm");
  form.append("model_id", "scribe_v2");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": elevenKey() },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Couldn't hear that (${res.status}): ${t.slice(0, 160)}`);
  }
  const json = await res.json();
  return (json?.text ?? "").trim();
}

export async function speakText(text: string, voiceId = "XrExE9yKIg1WjnnlVkGX"): Promise<string> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": elevenKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Voice failed (${res.status}): ${t.slice(0, 160)}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

