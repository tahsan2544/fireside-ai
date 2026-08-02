// Server-only AI helpers for journal prompts, reflections and memory extraction.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

async function chat(system: string, user: string, model = DEFAULT_MODEL): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("The AI isn't connected right now.");
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("The fire's a little overwhelmed — try again in a moment.");
    throw new Error(`AI error (${res.status})`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Nothing came back — try again.");
  return content.trim();
}

const FALLBACK_PROMPTS = [
  "What has been sitting quietly in the back of your mind today?",
  "Name one small thing that went softer than you expected.",
  "What would you say right now if no one could hear you?",
  "Where did your attention keep drifting today?",
  "What are you carrying that isn't actually yours?",
  "What felt like rest today, even for a second?",
  "Who came to mind today, unbidden?",
];

export async function journalPrompt(seedDay: string): Promise<string> {
  try {
    return await chat(
      "You write one short, gentle reflective journal prompt. One sentence. No preamble, no quotation marks, no emoji. Warm, present-tense, never clinical, never productivity-focused.",
      `Write today's reflective prompt. Today is ${seedDay}. Make it different from generic gratitude prompts.`
    );
  } catch {
    const idx = Math.abs([...seedDay].reduce((a, c) => a + c.charCodeAt(0), 0)) % FALLBACK_PROMPTS.length;
    return FALLBACK_PROMPTS[idx];
  }
}

export async function journalReflection(entry: string, mood?: number | null): Promise<string> {
  return chat(
    "You reflect back on a private journal entry in 2-3 short sentences. Warm, present, non-judgmental. You are not a therapist: no diagnosis, no advice unless it is plainly asked for, no cheerleading, no emoji, no bullet points. Reflect what you heard, gently.",
    `Mood (1 low - 5 bright): ${mood ?? "not given"}\n\nEntry:\n${entry.slice(0, 4000)}`
  );
}

// Pull durable facts worth remembering out of a conversation snippet.
export async function extractMemories(snippet: string): Promise<string[]> {
  try {
    const out = await chat(
      "You extract durable facts a friend would naturally remember about someone: their name, people and pets in their life, work or study, recurring worries, stated likes/dislikes and preferences. Return a JSON array of short strings (max 5). Return [] if nothing durable was said. No commentary, JSON only. Never record crisis details, medical details or anything sensitive about health.",
      snippet.slice(0, 4000)
    );
    const match = out.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => typeof x === "string" && x.trim().length > 3 && x.length < 200)
      .slice(0, 5)
      .map((x: string) => x.trim());
  } catch {
    return [];
  }
}

