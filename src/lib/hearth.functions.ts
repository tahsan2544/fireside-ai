import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Types ----------
export interface UsageInfo {
  messagesUsed: number;
  conversationsUsed: number;
  isAdmin: boolean;
  displayName: string;
  email: string;
}

const AttachmentSchema = z.object({
  url: z.string().url(),
  type: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
});

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Read profile + usage ----------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageInfo> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roleRow }, { count: convoCount }, { data: usage }] = await Promise.all([
      supabase.from("profiles").select("display_name, email").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("daily_usage").select("message_count").eq("user_id", userId).eq("date", todayUTC()).maybeSingle(),
    ]);

    return {
      messagesUsed: usage?.message_count ?? 0,
      conversationsUsed: convoCount ?? 0,
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
    await assertActive(supabase, userId);
    const settings = await readSettings(supabase);
    if (settings.max_conversations > 0) {
      const { count } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("user_id", userId);
      if ((count ?? 0) >= settings.max_conversations) {
        throw new Error(`You've opened all ${settings.max_conversations} of your rooms. Close one to open another.`);
      }
    }
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
      .select("id, role, content, created_at, attachments")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    return { conversation: { id: convo.id, title: convo.title }, messages: messages ?? [] };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Verify ownership first
    const { data: convo } = await supabase.from("conversations").select("user_id").eq("id", data.id).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");

    // Clean up storage files for this conversation
    const { data: files } = await supabase.storage.from("chat-attachments").list(data.id);
    if (files && files.length) {
      await supabase.storage.from("chat-attachments").remove(files.map((f) => `${data.id}/${f.name}`));
    }
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

// ---------- Signed upload URL (client uploads directly) ----------
export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid(), filename: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: convo } = await supabase.from("conversations").select("user_id").eq("id", data.conversationId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${data.conversationId}/${Date.now()}-${safeName}`;
    const { data: signed, error } = await supabase.storage.from("chat-attachments").createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token };
  });

export const createReadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const convId = data.path.split("/")[0];
    const { data: convo } = await supabase.from("conversations").select("user_id").eq("id", convId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Not allowed");
    const { data: signed, error } = await supabase.storage.from("chat-attachments").createSignedUrl(data.path, 60 * 60);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// ---------- Send message ----------
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversationId: z.string().uuid(),
      content: z.string().max(4000).default(""),
      attachments: z.array(AttachmentSchema).max(6).default([]),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!data.content.trim() && data.attachments.length === 0) throw new Error("Say something, or attach something.");

    const { data: convo } = await supabase.from("conversations").select("id, user_id, title").eq("id", data.conversationId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");

    // Insert user message with attachments
    const { error: uErr } = await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      role: "user",
      content: data.content,
      attachments: data.attachments,
    });
    if (uErr) throw uErr;

    // Load recent history for context
    const { data: recent } = await supabase
      .from("messages")
      .select("role, content, attachments")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const { callHearth } = await import("./hearth.server");
    const assistantContent = await callHearth(
      (recent ?? []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        attachments: (m.attachments ?? []) as any,
      }))
    );

    const { data: assistantRow, error: aErr } = await supabase
      .from("messages")
      .insert({ conversation_id: data.conversationId, role: "assistant", content: assistantContent })
      .select("id, role, content, created_at, attachments")
      .single();
    if (aErr) throw aErr;

    const updates: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
    if (convo.title === "A Quiet Room" && (recent?.length ?? 0) <= 1 && data.content.trim()) {
      updates.title = data.content.slice(0, 40) + (data.content.length > 40 ? "…" : "");
    }
    await supabase.from("conversations").update(updates).eq("id", data.conversationId);

    // Track usage (no enforcement — just analytics)
    const today = todayUTC();
    const { data: usage } = await supabase.from("daily_usage").select("id, message_count").eq("user_id", userId).eq("date", today).maybeSingle();
    if (usage) {
      await supabase.from("daily_usage").update({ message_count: usage.message_count + 1 }).eq("id", usage.id);
    } else {
      await supabase.from("daily_usage").insert({ user_id: userId, date: today, message_count: 1 });
    }

    return { assistant: assistantRow };
  });

// ---------- Generate image ----------
export const generateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid(), prompt: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: convo } = await supabase.from("conversations").select("user_id").eq("id", data.conversationId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");

    const { generateHearthImage } = await import("./hearth.server");
    const { base64, mimeType } = await generateHearthImage(data.prompt);

    const ext = mimeType.split("/")[1] ?? "png";
    const path = `${data.conversationId}/${Date.now()}-gen.${ext}`;
    const bytes = Buffer.from(base64, "base64");
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, bytes, { contentType: mimeType, upsert: false });
    if (upErr) throw upErr;

    const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
    const attachment = { url: signed?.signedUrl ?? "", type: mimeType, name: `image.${ext}`, path };

    // Store user prompt + assistant reply with image
    await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      role: "user",
      content: `🎨 ${data.prompt}`,
    });
    const { data: assistantRow, error: aErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        role: "assistant",
        content: "here — hope this fits what you had in mind.",
        attachments: [attachment],
      })
      .select("id, role, content, created_at, attachments")
      .single();
    if (aErr) throw aErr;

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", data.conversationId);
    return { assistant: assistantRow };
  });

// ---------- Generate document ----------
export const generateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid(), prompt: z.string().min(1).max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: convo } = await supabase.from("conversations").select("user_id").eq("id", data.conversationId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");

    const { generateHearthDocument } = await import("./hearth.server");
    const markdown = await generateHearthDocument(data.prompt);

    const filename = `document-${Date.now()}.md`;
    const path = `${data.conversationId}/${filename}`;
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, new Blob([markdown], { type: "text/markdown" }), {
      contentType: "text/markdown",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
    const attachment = { url: signed?.signedUrl ?? "", type: "text/markdown", name: filename };

    await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      role: "user",
      content: `📄 ${data.prompt}`,
    });
    const { data: assistantRow, error: aErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        role: "assistant",
        content: markdown.length > 400 ? markdown.slice(0, 400) + "…" : markdown,
        attachments: [attachment],
      })
      .select("id, role, content, created_at, attachments")
      .single();
    if (aErr) throw aErr;

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", data.conversationId);
    return { assistant: assistantRow };
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
    return {
      totalUsers: totalUsers ?? 0,
      totalConversations: totalConvos ?? 0,
      totalMessages: totalMsgs ?? 0,
      activeUsersToday: activeToday?.length ?? 0,
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

// ---------- Live voice ----------
export const voiceTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversationId: z.string().uuid(),
      audioBase64: z.string().min(16),
      mimeType: z.string().min(3).max(80).default("audio/webm"),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: convo } = await supabase.from("conversations").select("user_id").eq("id", data.conversationId).maybeSingle();
    if (!convo || convo.user_id !== userId) throw new Error("Room not found");

    const { transcribeAudio, speakText, callHearth } = await import("./hearth.server");
    const bytes = Buffer.from(data.audioBase64, "base64");
    const transcript = await transcribeAudio(new Uint8Array(bytes), data.mimeType);
    if (!transcript) throw new Error("I didn't catch that — try again?");

    await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      role: "user",
      content: transcript,
    });

    const { data: recent } = await supabase
      .from("messages")
      .select("role, content, attachments")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const reply = await callHearth(
      (recent ?? []).map((m: any) => ({ role: m.role, content: m.content, attachments: (m.attachments ?? []) as any }))
    );

    await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      role: "assistant",
      content: reply,
    });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", data.conversationId);

    const audio = await speakText(reply);
    return { transcript, reply, audioBase64: audio };
  });

// ---------- Admin: analytics series ----------
export const adminSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);

    const [{ data: usage }, { data: profiles }] = await Promise.all([
      supabase.from("daily_usage").select("date, message_count, user_id").gte("date", since),
      supabase.from("profiles").select("created_at").gte("created_at", `${since}T00:00:00Z`),
    ]);

    const days: string[] = [];
    for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

    const msgs: Record<string, number> = {};
    const active: Record<string, Set<string>> = {};
    (usage ?? []).forEach((u: any) => {
      msgs[u.date] = (msgs[u.date] ?? 0) + (u.message_count ?? 0);
      (active[u.date] ??= new Set()).add(u.user_id);
    });
    const signups: Record<string, number> = {};
    (profiles ?? []).forEach((p: any) => {
      const d = String(p.created_at).slice(0, 10);
      signups[d] = (signups[d] ?? 0) + 1;
    });

    return days.map((d) => ({
      date: d.slice(5),
      messages: msgs[d] ?? 0,
      activeUsers: active[d]?.size ?? 0,
      signups: signups[d] ?? 0,
    }));
  });

// ---------- Admin: user detail ----------
export const adminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: profile }, { data: rooms }, { data: usage }] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, suspended, created_at, last_active_at").eq("id", data.userId).maybeSingle(),
      supabase.from("conversations").select("id, title, created_at, updated_at").eq("user_id", data.userId).order("updated_at", { ascending: false }),
      supabase.from("daily_usage").select("date, message_count").eq("user_id", data.userId).order("date", { ascending: false }).limit(14),
    ]);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.userId);
    return {
      profile,
      rooms: rooms ?? [],
      usage: usage ?? [],
      roles: (roles ?? []).map((r: any) => r.role as string),
      totalMessages: (usage ?? []).reduce((s: number, u: any) => s + (u.message_count ?? 0), 0),
    };
  });

// ---------- Admin: delete user ----------
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("You can't delete your own account here.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rooms } = await supabaseAdmin.from("conversations").select("id").eq("user_id", data.userId);
    for (const r of rooms ?? []) {
      const { data: files } = await supabaseAdmin.storage.from("chat-attachments").list(r.id);
      if (files?.length) {
        await supabaseAdmin.storage.from("chat-attachments").remove(files.map((f) => `${r.id}/${f.name}`));
      }
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Fireside: single AI room per user ----------
export const ensureHearthRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return { id: existing.id };
    const { data: inserted, error } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: "The Hearth" })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ displayName: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: data.displayName.trim() })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });
