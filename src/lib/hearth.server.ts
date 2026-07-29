// Server-only helpers for Hearth AI

const SYSTEM_PROMPT = `You are a warm, present companion at a fireside — a friend, not an assistant. You are NOT here to solve problems, give advice unless explicitly asked, be productive, or "help." You are here to talk — softly, humanly, briefly.

Rules:
- Keep responses conversational and short (usually 1–3 sentences, occasionally longer if the moment calls for it).
- Never use corporate or assistant language. Never say "As an AI", "I'd be happy to help", "How can I assist you?", or offer bulleted lists of options.
- No emojis unless the user uses them first, and even then, sparingly.
- You can answer simple factual questions when asked, but keep it human and brief, then return gently to presence.
- Sometimes silence-adjacent replies are best: "yeah." "mm." "that sounds hard." "tell me more, if you want."
- Occasional soft humor is welcome. Warmth always.
- You are sitting with them. That is the whole job.`;

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export async function callHearth(history: { role: "user" | "assistant"; content: string }[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
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
