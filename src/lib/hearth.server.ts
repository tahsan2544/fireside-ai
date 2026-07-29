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

export async function callHearth(
  history: { role: "user" | "assistant"; content: string; attachments?: StoredAttachment[] }[]
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => {
      const atts = m.attachments ?? [];
      if (!atts.length) return { role: m.role, content: m.content };
      const parts: any[] = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const a of atts) {
        if (a.type.startsWith("image/")) {
          parts.push({ type: "image_url", image_url: { url: a.url } });
        } else {
          // documents — reference by name; the model can't fetch signed URLs
          parts.push({ type: "text", text: `[attached file: ${a.name}]` });
        }
      }
      return { role: m.role, content: parts };
    }),
  ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      messages,
      reasoning_effort: "none",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The fire's a little overwhelmed right now — try again in a moment.");
    if (res.status === 402) throw new Error("The hearth needs more wood (AI credits). Please add credits in Lovable.");
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Empty AI response");
  return content.trim();
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
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      messages: [
        {
          role: "system",
          content:
            "You produce clean, well-structured markdown documents. Include a top-level title (# ...), sections, and prose. No preamble like 'Here is your document'. Just the document.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 402) throw new Error("The hearth needs more wood (AI credits).");
    throw new Error(`Document error (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Empty document response");
  return content.trim();
}
