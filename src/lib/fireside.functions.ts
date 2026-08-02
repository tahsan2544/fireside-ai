import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { checkSafety } from "./safety";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- Preferences ----------------
export interface Prefs {
  displayName: string;
  email: string;
  voiceId: string;
  memoryEnabled: boolean;
  reflectionOptin: boolean;
  ageConfirmed: boolean;
  plan: string;
}

export const getPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Prefs> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, email, voice_id, memory_enabled, reflection_optin, age_confirmed, plan")
      .eq("id", userId)
      .maybeSingle();
    return {
      displayName: data?.display_name ?? "friend",
      email: data?.email ?? "",
      voiceId: data?.voice_id ?? "XrExE9yKIg1WjnnlVkGX",
      memoryEnabled: data?.memory_enabled ?? true,
      reflectionOptin: data?.reflection_optin ?? false,
      ageConfirmed: data?.age_confirmed ?? false,
      plan: data?.plan ?? "free",
    };
  });

export const updatePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        displayName: z.string().min(1).max(40).optional(),
        voiceId: z.string().min(4).max(60).optional(),
        memoryEnabled: z.boolean().optional(),
        reflectionOptin: z.boolean().optional(),
        ageConfirmed: z.literal(true).optional(),
      })
      .parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: {
      display_name?: string;
      voice_id?: string;
      memory_enabled?: boolean;
      reflection_optin?: boolean;
      age_confirmed?: boolean;
    } = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName.trim();
    if (data.voiceId !== undefined) patch.voice_id = data.voiceId;
    if (data.memoryEnabled !== undefined) patch.memory_enabled = data.memoryEnabled;
    if (data.reflectionOptin !== undefined) patch.reflection_optin = data.reflectionOptin;
    if (data.ageConfirmed !== undefined) patch.age_confirmed = true;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Journal ----------------
export const getJournalPrompt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { journalPrompt } = await import("./fireside.server");
    return { prompt: await journalPrompt(todayUTC()) };
  });

export const listJournal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, prompt, content, mood, reflection, entry_date, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return data ?? [];
  });

export const saveJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        content: z.string().min(1).max(20000),
        prompt: z.string().max(400).default(""),
        mood: z.number().int().min(1).max(5).nullable().default(null),
        wantReflection: z.boolean().default(false),
      })
      .parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const safety = checkSafety(data.content);
    if (safety.blocked) throw new Error(safety.reason!);

    let reflection: string | null = null;
    if (data.wantReflection) {
      const { journalReflection } = await import("./fireside.server");
      reflection = await journalReflection(data.content, data.mood).catch(() => null);
    }

    const { data: row, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userId,
        content: data.content,
        prompt: data.prompt,
        mood: data.mood,
        reflection,
      })
      .select("id, prompt, content, mood, reflection, entry_date, created_at")
      .single();
    if (error) throw error;
    return { entry: row, crisis: safety.crisis };
  });

export const deleteJournalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("journal_entries").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const reflectOnEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: entry } = await supabase
      .from("journal_entries")
      .select("content, mood")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!entry) throw new Error("That entry isn't here.");
    const { journalReflection } = await import("./fireside.server");
    const reflection = await journalReflection(entry.content, entry.mood);
    const { error } = await supabase
      .from("journal_entries")
      .update({ reflection })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { reflection };
  });

// ---------------- Memory ----------------
export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("memory_facts")
      .select("id, kind, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), content: z.string().min(2).max(300), kind: z.string().max(40).default("note") }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("memory_facts")
        .update({ content: data.content, kind: data.kind })
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await supabase.from("memory_facts").insert({ user_id: userId, content: data.content, kind: data.kind });
    if (error) throw error;
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("memory_facts").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const forgetEverything = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("memory_facts").delete().eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Usage & plan ----------------
export interface UsageSummary {
  plan: string;
  messagesToday: number;
  voiceSecondsToday: number;
  messageLimit: number; // 0 = unlimited
  voiceSecondsLimit: number; // 0 = unlimited
  journalEntries: number;
  memories: number;
}

export const getUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageSummary> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: usage }, { data: settings }, { count: journalCount }, { count: memCount }] =
      await Promise.all([
        supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
        supabase
          .from("daily_usage")
          .select("message_count, voice_seconds")
          .eq("user_id", userId)
          .eq("date", todayUTC())
          .maybeSingle(),
        supabase.from("site_settings").select("free_daily_messages, free_daily_voice_seconds").eq("id", true).maybeSingle(),
        supabase.from("journal_entries").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("memory_facts").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);
    const plan = profile?.plan ?? "free";
    const paid = plan !== "free";
    return {
      plan,
      messagesToday: usage?.message_count ?? 0,
      voiceSecondsToday: usage?.voice_seconds ?? 0,
      messageLimit: paid ? 0 : (settings?.free_daily_messages ?? 30),
      voiceSecondsLimit: paid ? 0 : (settings?.free_daily_voice_seconds ?? 300),
      journalEntries: journalCount ?? 0,
      memories: memCount ?? 0,
    };
  });

// ---------------- Commons: rooms, reports, blocks ----------------
export const listCommonsRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("commons_rooms")
      .select("slug, name, description")
      .order("sort_order", { ascending: true });
    return data ?? [];
  });

export const postToCommons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ roomSlug: z.string().min(1).max(40).default("main"), content: z.string().min(1).max(2000) }).parse(d)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const safety = checkSafety(data.content);
    if (safety.blocked || safety.harassment) throw new Error(safety.reason!);
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const { data: row, error } = await supabase
      .from("commons_messages")
      .insert({
        user_id: userId,
        display_name: profile?.display_name ?? "someone by the fire",
        content: data.content,
        room_slug: data.roomSlug,
      })
      .select("id, user_id, display_name, content, created_at, room_slug")
      .single();
    if (error) throw error;
    return { message: row, crisis: safety.crisis };
  });

export const reportCommonsMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ messageId: z.string().uuid(), reason: z.string().max(300).default("") }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("commons_reports")
      .insert({ message_id: data.messageId, reporter_id: userId, reason: data.reason });
    if (error) throw error;
    return { ok: true };
  });

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("commons_blocks")
      .select("blocked_user_id")
      .eq("user_id", context.userId);
    return (data ?? []).map((b: { blocked_user_id: string }) => b.blocked_user_id);
  });

export const toggleBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ blockedUserId: z.string().uuid(), blocked: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.blockedUserId === userId) throw new Error("You can't block yourself.");
    if (data.blocked) {
      const { error } = await supabase.from("commons_blocks").insert({ user_id: userId, blocked_user_id: data.blockedUserId });
      if (error && !error.message.includes("duplicate")) throw error;
    } else {
      const { error } = await supabase
        .from("commons_blocks")
        .delete()
        .eq("user_id", userId)
        .eq("blocked_user_id", data.blockedUserId);
      if (error) throw error;
    }
    return { ok: true };
  });

// ---------------- Admin: reports ----------------
export const adminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");
    const { data: reports } = await supabase
      .from("commons_reports")
      .select("id, message_id, reason, resolved, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const ids = (reports ?? []).map((r: { message_id: string }) => r.message_id);
    const { data: msgs } = ids.length
      ? await supabase.from("commons_messages").select("id, display_name, content, room_slug").in("id", ids)
      : { data: [] as { id: string; display_name: string; content: string; room_slug: string }[] };
    const byId = new Map((msgs ?? []).map((m) => [m.id, m]));
    return (reports ?? []).map((r) => ({ ...r, message: byId.get(r.message_id) ?? null }));
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");
    const { error } = await supabase.from("commons_reports").update({ resolved: true }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
