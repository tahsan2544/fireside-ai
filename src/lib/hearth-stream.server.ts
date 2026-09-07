// Streaming Hearth chat pipeline — server-only.
// Mirrors the guard rails in hearth.functions.ts sendMessage (keep in sync):
// suspension check, maintenance mode, safety screen, atomic daily cap,
// room ownership, attachment path verification, memory.

export interface StreamChatInput {
  conversationId: string;
  content: string;
  attachments: { path: string; type: string; name: string }[];
}

type SseEvent =
  | { event: "token"; t: string }
  | { event: "done"; assistant: unknown; crisis: boolean }
  | { event: "error"; message: string };

function sse(e: SseEvent): string {
  const { event, ...data } = e;
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Keep these defaults in sync with SETTINGS_DEFAULTS in hearth.functions.ts.
const SETTINGS_DEFAULTS = {
  maintenance_mode: false,
  ai_model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  system_prompt: "",
  max_daily_messages: 0,
  free_daily_messages: 30,
};

async function readSettings(supabase: any) {
  const { data } = await supabase.from("site_settings").select("*").eq("id", true).maybeSingle();
  return { ...SETTINGS_DEFAULTS, ...(data ?? {}) } as typeof SETTINGS_DEFAULTS;
}

async function bumpUsage(supabase: any, messages: number): Promise<number> {
  const { data, error } = await supabase.rpc("bump_daily_usage", { _messages: messages, _voice_seconds: 0 });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.message_count ?? 0;
}

async function readMemories(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("memory_facts")
    .select("content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((m: { content: string }) => m.content);
}

async function rememberFrom(supabase: any, userId: string, snippet: string, existing: string[]) {
  try {
    const { extractMemories } = await import("./fireside.server");
    const facts = await extractMemories(snippet);
    const lower = existing.map((e) => e.toLowerCase());
    const fresh = facts.filter((f) => !lower.some((e) => e.includes(f.toLowerCase()) || f.toLowerCase().includes(e)));
    if (!fresh.length) return;
    await supabase.from("memory_facts").insert(fresh.map((content) => ({ user_id: userId, content, kind: "chat" })));
  } catch {
    /* memory is a nicety, never a blocker */
  }
}

// Yields SSE-encoded events. The caller's supabase client must already be
// authenticated as the user (RLS applies).
export async function* streamChat(supabase: any, userId: string, input: StreamChatInput): AsyncGenerator<string> {
  const fail = (message: string) => sse({ event: "error", message });
  try {
    if (!input.content.trim() && input.attachments.length === 0) {
      yield fail("Say something, or attach something.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, memory_enabled, suspended")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.suspended) {
      yield fail("Your seat by the fire has been paused. Reach out if this seems wrong.");
      return;
    }

    const settings = await readSettings(supabase);
    if (settings.maintenance_mode) {
      yield fail("The fire is being tended. Back shortly.");
      return;
    }

    const { checkSafety } = await import("./safety");
    const safety = checkSafety(input.content);
    if (safety.blocked) {
      yield fail(safety.reason!);
      return;
    }

    const plan = profile?.plan ?? "free";
    const dailyCap =
      settings.max_daily_messages > 0
        ? settings.max_daily_messages
        : plan === "free"
          ? (settings.free_daily_messages ?? 30)
          : 0;
    const reserved = await bumpUsage(supabase, 1);
    if (dailyCap > 0 && reserved > dailyCap) {
      await bumpUsage(supabase, -1);
      yield fail(`That's ${dailyCap} messages today on the free hearth. Come back tomorrow, or open the door wider from Pricing.`);
      return;
    }

    const { data: convo } = await supabase
      .from("conversations")
      .select("id, user_id, title")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (!convo || convo.user_id !== userId) {
      yield fail("Room not found");
      return;
    }

    const resolvedAttachments: { url: string; type: string; name: string; path: string }[] = [];
    for (const a of input.attachments) {
      const path = a.path.replace(/^\/+/, "");
      if (!path.startsWith(`${input.conversationId}/`) || path.includes("..")) {
        yield fail("That attachment doesn't belong to this room.");
        return;
      }
      const { data: signed, error: sErr } = await supabase.storage
        .from("chat-attachments")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) {
        yield fail("That attachment couldn't be read.");
        return;
      }
      resolvedAttachments.push({ url: signed.signedUrl, type: a.type, name: a.name, path });
    }

    const { error: uErr } = await supabase.from("messages").insert({
      conversation_id: input.conversationId,
      role: "user",
      content: input.content,
      attachments: resolvedAttachments,
    });
    if (uErr) {
      yield fail("That message didn't come through. Try again.");
      return;
    }

    const { data: recent } = await supabase
      .from("messages")
      .select("role, content, attachments")
      .eq("conversation_id", input.conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const memories = profile?.memory_enabled === false ? [] : await readMemories(supabase, userId);

    const { streamHearthChat } = await import("./hearth.server");
    let full = "";
    for await (const delta of streamHearthChat(
      (recent ?? []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        attachments: (m.attachments ?? []) as any,
      })),
      { model: settings.ai_model, extraSystemPrompt: settings.system_prompt, memories, crisis: safety.crisis }
    )) {
      full += delta;
      yield sse({ event: "token", t: delta });
    }

    const assistantContent = full.trim();
    if (!assistantContent) {
      yield fail("Empty AI response");
      return;
    }

    const { data: assistantRow, error: aErr } = await supabase
      .from("messages")
      .insert({ conversation_id: input.conversationId, role: "assistant", content: assistantContent })
      .select("id, role, content, created_at, attachments")
      .single();
    if (aErr) {
      yield fail("That reply didn't come through. Try again.");
      return;
    }

    const updates: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (convo.title === "A Quiet Room" && (recent?.length ?? 0) <= 1 && input.content.trim()) {
      updates.title = input.content.slice(0, 40) + (input.content.length > 40 ? "…" : "");
    }
    await supabase.from("conversations").update(updates).eq("id", input.conversationId);

    if (profile?.memory_enabled !== false && !safety.crisis && input.content.trim().length > 25) {
      await rememberFrom(supabase, userId, `${input.content}\n\nCompanion replied: ${assistantContent}`, memories);
    }

    yield sse({ event: "done", assistant: assistantRow, crisis: safety.crisis });
  } catch (e) {
    yield fail(e instanceof Error ? e.message : "Something didn't come through. Try again.");
  }
}
