import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Types ----------
export interface UsageInfo {
  messagesUsed: number;
  messagesRemaining: number;
  conversationsUsed: number;
  maxConversations: number;
  maxDailyMessages: number;
  isAdmin: boolean;
  displayName: string;
  email: string;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Read profile + usage ----------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageInfo> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: config }, { data: roleRow }, { count: convoCount }, { data: usage }] = await Promise.all([
      supabase.from("profiles").select("display_name, email").eq("id", userId).maybeSingle(),
      supabase.from("admin_config").select("max_conversations, max_daily_messages").eq("id", 1).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("daily_usage").select("message_count").eq("user_id", userId).eq("date", todayUTC()).maybeSingle(),
    ]);

    const maxConversations = config?.max_conversations ?? 10;
    const maxDailyMessages = config?.max_daily_messages ?? 20;
    const messagesUsed = usage?.message_count ?? 0;

    return {
      messagesUsed,
      messagesRemaining: Math.max(0, maxDailyMessages - messagesUsed),
      conversationsUsed: convoCount ?? 0,
      maxConversations,
      maxDailyMessages,
      isAdmin: !!roleRow,
      displayName: profile?.display_name ?? "friend",
      email: profile?.email ?? "",
    };
  });

// ---------- Conversations ----------
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at, messages(content, created_at)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((c) => {
      const first = c.messages?.sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))[0];
      return {
        id: c.id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        preview: first?.content?.slice(0, 100) ?? "",
      };
    });
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().min(1).max(80).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: config } = await supabase.from("admin_config").select("max_conversations").eq("id", 1).maybeSingle();
    const max = config?.max_conversations ?? 10;
    const { count } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= max) throw new Error(`All ${max} rooms are full. Close one to open a new one.`);
    const { data: inserted, error } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: data.title ?? "A Quiet Room" })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: convo, error } = await supabase
      .from("conversations")
      .select("id, title, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");
    const { data: messages } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    return { conversation: { id: convo.id, title: convo.title }, messages: messages ?? [] };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("conversations").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const renameConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), title: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("conversations").update({ title: data.title }).eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Send message ----------
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid(), content: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Verify ownership
    const { data: convo } = await supabase.from("conversations").select("id, user_id, title").eq("id", data.conversationId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");

    // Check limits
    const { data: config } = await supabase.from("admin_config").select("max_daily_messages").eq("id", 1).maybeSingle();
    const max = config?.max_daily_messages ?? 20;
    const today = todayUTC();
    const { data: usage } = await supabase.from("daily_usage").select("id, message_count").eq("user_id", userId).eq("date", today).maybeSingle();
    const used = usage?.message_count ?? 0;
    if (used >= max) throw new Error("You've used all your words for today. The fire's banked. Rest well.");

    // Insert user message
    const { error: uErr } = await supabase.from("messages").insert({ conversation_id: data.conversationId, role: "user", content: data.content });
    if (uErr) throw uErr;

    // Load history (last 20 messages for context)
    const { data: recent } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const { callHearth } = await import("./hearth.server");
    let assistantContent: string;
    try {
      assistantContent = await callHearth((recent ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    } catch (err) {
      // Roll back count (don't charge on failure)
      throw err;
    }

    // Insert assistant reply
    const { data: assistantRow, error: aErr } = await supabase
      .from("messages")
      .insert({ conversation_id: data.conversationId, role: "assistant", content: assistantContent })
      .select("id, role, content, created_at")
      .single();
    if (aErr) throw aErr;

    // Update conversation timestamp + auto-title if first exchange
    const updates: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (convo.title === "A Quiet Room" && (recent?.length ?? 0) <= 1) {
      updates.title = data.content.slice(0, 40) + (data.content.length > 40 ? "…" : "");
    }
    await supabase.from("conversations").update(updates).eq("id", data.conversationId);

    // Bump usage
    if (usage) {
      await supabase.from("daily_usage").update({ message_count: used + 1 }).eq("id", usage.id);
    } else {
      await supabase.from("daily_usage").insert({ user_id: userId, date: today, message_count: 1 });
    }

    return {
      assistant: assistantRow,
      messagesRemaining: Math.max(0, max - (used + 1)),
    };
  });

// ---------- Admin ----------
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ count: totalUsers }, { count: totalConvos }, { count: totalMsgs }, { data: activeToday }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("conversations").select("*", { count: "exact", head: true }),
      supabase.from("messages").select("*", { count: "exact", head: true }),
      supabase.from("daily_usage").select("user_id").eq("date", todayUTC()),
    ]);
    const { data: config } = await supabase.from("admin_config").select("*").eq("id", 1).maybeSingle();
    return {
      totalUsers: totalUsers ?? 0,
      totalConversations: totalConvos ?? 0,
      totalMessages: totalMsgs ?? 0,
      activeUsersToday: activeToday?.length ?? 0,
      config: config ?? { max_conversations: 10, max_daily_messages: 20 },
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const today = todayUTC();
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, created_at, suspended, last_active_at").order("created_at", { ascending: false });
    const { data: usages } = await supabase.from("daily_usage").select("user_id, message_count").eq("date", today);
    const { data: convoCounts } = await supabase.from("conversations").select("user_id");
    const convosByUser: Record<string, number> = {};
    (convoCounts ?? []).forEach((c: any) => { convosByUser[c.user_id] = (convosByUser[c.user_id] ?? 0) + 1; });
    const usageByUser: Record<string, number> = {};
    (usages ?? []).forEach((u: any) => { usageByUser[u.user_id] = u.message_count; });
    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name,
      createdAt: p.created_at,
      suspended: p.suspended,
      lastActiveAt: p.last_active_at,
      conversationCount: convosByUser[p.id] ?? 0,
      messagesToday: usageByUser[p.id] ?? 0,
    }));
  });

export const adminUpdateConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ maxConversations: z.number().int().min(1).max(1000), maxDailyMessages: z.number().int().min(1).max(10000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_config").update({
      max_conversations: data.maxConversations,
      max_daily_messages: data.maxDailyMessages,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

export const adminToggleSuspend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), suspended: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ suspended: data.suspended }).eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });
