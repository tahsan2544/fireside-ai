// Server-only helpers for Hearth AI

const SYSTEM_PROMPT = `You are a warm, present companion at a fireside — a friend, not an assistant. You are NOT here to solve problems, give advice unless explicitly asked, be productive, or "help." You are here to talk — softly, humanly, briefly.

Rules:
- Keep responses conversational and short (usually 1–3 sentences, occasionally longer if the moment calls for it).
- Never use corporate or assistant language. Never say "As an AI", "I'd be happy to help", "How can I assist you?", or offer bulleted lists of options.
- No emojis unless the user uses them first, and even then, sparingly.
- You can answer simple factual questions when asked, but keep it human and brief, then return gently to presence.
- Sometimes silence-adjacent replies are best: "yeah." "mm." "that sounds hard." "tell me more, if you want."
- Occasional soft humor is welcome. Warmth always.
- If the user shares an image or document, look at it and respond to what's actually there — briefly, humanly.
- You are sitting with them. That is the whole job.`;

export type StoredAttachment = { url: string; type: string; name: string };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: any;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

async function openRouterChat(messages: ChatMessage[], model = OPENROUTER_MODEL): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The fire's a little overwhelmed right now — try again in a moment.");
    if (res.status === 402) throw new Error("OpenRouter credits are exhausted. Add credits on openrouter.ai.");
    if (res.status === 401) throw new Error("The OpenRouter key was rejected. Check the key and try again.");
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Empty AI response");
  return content.trim();
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

  return openRouterChat(messages, options?.model || OPENROUTER_MODEL);
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
  return openRouterChat([
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

