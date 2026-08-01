import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteSettings,
  adminUpdateSiteSettings,
  adminCommonsFeed,
  adminDeleteCommonsMessage,
  type SiteSettings,
} from "@/lib/hearth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

const TOGGLES: { key: keyof SiteSettings; label: string; hint: string }[] = [
  { key: "signups_enabled", label: "Open the door", hint: "Allow new people to sign up" },
  { key: "maintenance_mode", label: "Tend the fire", hint: "Pause AI replies for everyone" },
  { key: "commons_enabled", label: "The Commons", hint: "Shared human room is open" },
  { key: "voice_enabled", label: "Voice", hint: "Speaking aloud with the AI" },
  { key: "image_gen_enabled", label: "Image making", hint: "AI can create pictures" },
  { key: "doc_gen_enabled", label: "Document making", hint: "AI can write documents" },
];

export function AdminSiteSettings() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSiteSettings);
  const saveFn = useServerFn(adminUpdateSiteSettings);
  const settings = useQuery({ queryKey: ["site-settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<SiteSettings | null>(null);

  useEffect(() => {
    if (settings.data && !form) setForm(settings.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (v: SiteSettings) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Settings saved.");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });

  if (!form) return <Skeleton className="h-64 w-full rounded-xl" />;

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setForm({ ...form, [k]: v });

  return (
    <form
      className="space-y-6 rounded-xl bg-card warm-border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Site name</Label>
          <Input value={form.site_name} onChange={(e) => set("site_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Welcome note (dashboard)</Label>
        <Input value={form.welcome_note} onChange={(e) => set("welcome_note", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Announcement banner</Label>
        <Input
          value={form.announcement}
          placeholder="Leave empty to hide"
          onChange={(e) => set("announcement", e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOGGLES.map((t) => (
          <div key={String(t.key)} className="flex items-center justify-between gap-3 rounded-lg bg-accent/30 px-4 py-3">
            <div>
              <p className="text-sm">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
            </div>
            <Switch
              checked={form[t.key] as boolean}
              onCheckedChange={(v) => set(t.key, v as SiteSettings[typeof t.key])}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Daily messages per person (0 = unlimited)</Label>
          <Input
            type="number"
            min={0}
            value={form.max_daily_messages}
            onChange={(e) => set("max_daily_messages", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Rooms per person (0 = unlimited)</Label>
          <Input
            type="number"
            min={0}
            value={form.max_conversations}
            onChange={(e) => set("max_conversations", Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>AI model</Label>
        <Input value={form.ai_model} onChange={(e) => set("ai_model", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Extra guidance for the AI</Label>
        <Textarea
          rows={4}
          value={form.system_prompt}
          placeholder="Added on top of the fireside voice."
          onChange={(e) => set("system_prompt", e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </Button>
        <Button type="button" variant="ghost" onClick={() => settings.data && setForm(settings.data)}>
          Reset
        </Button>
      </div>
    </form>
  );
}

export function AdminCommonsFeed() {
  const qc = useQueryClient();
  const feedFn = useServerFn(adminCommonsFeed);
  const delFn = useServerFn(adminDeleteCommonsMessage);
  const feed = useQuery({ queryKey: ["admin-commons"], queryFn: () => feedFn() });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-commons"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove"),
  });

  return (
    <div className="rounded-xl bg-card warm-border">
      <div className="max-h-96 overflow-y-auto divide-y divide-border/40">
        {feed.isLoading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
        {feed.data?.length === 0 && (
          <p className="p-6 text-sm italic text-muted-foreground">The Commons is quiet.</p>
        )}
        {(feed.data ?? []).map((m) => (
          <div key={m.id} className="flex items-start gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                {m.display_name} · {new Date(m.created_at).toLocaleString()}
              </p>
              <p className="break-words">{m.content}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete message"
              onClick={() => remove.mutate(m.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
