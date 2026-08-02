-- ============ SECURITY FIXES ============
DROP POLICY IF EXISTS "authenticated can receive broadcast" ON public.messages;
DROP POLICY IF EXISTS "authenticated can send broadcast" ON public.messages;
DROP POLICY IF EXISTS "insert own msgs" ON public.messages;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_owner_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ============ PROFILE ADDITIONS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_id text NOT NULL DEFAULT 'XrExE9yKIg1WjnnlVkGX',
  ADD COLUMN IF NOT EXISTS memory_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reflection_optin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- ============ JOURNAL ============
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL DEFAULT '',
  content text NOT NULL,
  mood smallint,
  reflection text,
  entry_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own journal" ON public.journal_entries FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER journal_touch BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MEMORY ============
CREATE TABLE IF NOT EXISTS public.memory_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_facts TO authenticated;
GRANT ALL ON public.memory_facts TO service_role;
ALTER TABLE public.memory_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.memory_facts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER memory_touch BEFORE UPDATE ON public.memory_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VOICE SESSIONS ============
CREATE TABLE IF NOT EXISTS public.voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  seconds integer NOT NULL DEFAULT 0,
  turns integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.voice_sessions TO authenticated;
GRANT ALL ON public.voice_sessions TO service_role;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own voice sessions" ON public.voice_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- messages get a channel label so voice turns are marked in history
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS via text NOT NULL DEFAULT 'text';

-- ============ COMMONS ROOMS ============
CREATE TABLE IF NOT EXISTS public.commons_rooms (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commons_rooms TO authenticated;
GRANT ALL ON public.commons_rooms TO service_role;
ALTER TABLE public.commons_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rooms" ON public.commons_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage rooms" ON public.commons_rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.commons_rooms (slug, name, description, sort_order) VALUES
  ('main', 'The Commons', 'One shared fire. Anything, gently.', 0),
  ('gratitude', 'Gratitude', 'Small good things, said out loud.', 1),
  ('grief', 'Grief', 'For what is missing. No fixing here.', 2),
  ('late-night', 'Late Night', 'For the hours when sleep will not come.', 3)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.commons_messages
  ADD COLUMN IF NOT EXISTS room_slug text NOT NULL DEFAULT 'main';

-- ============ REPORTS & BLOCKS ============
CREATE TABLE IF NOT EXISTS public.commons_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.commons_reports TO authenticated;
GRANT ALL ON public.commons_reports TO service_role;
ALTER TABLE public.commons_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report create" ON public.commons_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "report read" ON public.commons_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "report resolve" ON public.commons_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.commons_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.commons_blocks TO authenticated;
GRANT ALL ON public.commons_blocks TO service_role;
ALTER TABLE public.commons_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own blocks" ON public.commons_blocks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subs_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DAILY USAGE: voice minutes ============
ALTER TABLE public.daily_usage ADD COLUMN IF NOT EXISTS voice_seconds integer NOT NULL DEFAULT 0;

-- ============ SITE SETTINGS: plan limits + safety ============
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS free_daily_messages integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS free_daily_voice_seconds integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS journal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS memory_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_rooms_enabled boolean NOT NULL DEFAULT true;