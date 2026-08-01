-- 1. Remove email-based admin grant from signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. One-time owner bootstrap: only for the verified owner address, only while no admin exists
CREATE OR REPLACE FUNCTION public.bootstrap_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'tarifulislam2544@gmail.com'
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_owner_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_bootstrap_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_bootstrap_admin
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_owner_admin();

-- grant to the owner account right now if it already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) IN ('tarifulislam2544@gmail.com','tarifulislam2544@gamil.com')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 3. Suspension helper
CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT suspended FROM public.profiles WHERE id = _user_id), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;

-- 4. Site settings singleton
CREATE TABLE IF NOT EXISTS public.site_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  site_name text NOT NULL DEFAULT 'Fireside AI',
  tagline text NOT NULL DEFAULT 'A quiet place. A warm voice.',
  welcome_note text NOT NULL DEFAULT 'Pull up a chair. The fire is already lit.',
  announcement text NOT NULL DEFAULT '',
  signups_enabled boolean NOT NULL DEFAULT true,
  maintenance_mode boolean NOT NULL DEFAULT false,
  commons_enabled boolean NOT NULL DEFAULT true,
  voice_enabled boolean NOT NULL DEFAULT true,
  image_gen_enabled boolean NOT NULL DEFAULT true,
  doc_gen_enabled boolean NOT NULL DEFAULT true,
  ai_model text NOT NULL DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b:free',
  system_prompt text NOT NULL DEFAULT '',
  max_daily_messages integer NOT NULL DEFAULT 0,
  max_conversations integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert site settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update site settings" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 5. Commons messages (replaces open broadcast channel)
CREATE TABLE IF NOT EXISTS public.commons_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commons_messages_created_at_idx ON public.commons_messages (created_at DESC);

GRANT SELECT, INSERT ON public.commons_messages TO authenticated;
GRANT ALL ON public.commons_messages TO service_role;
ALTER TABLE public.commons_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in people can read the commons" ON public.commons_messages
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Signed-in, unsuspended people can post" ON public.commons_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

CREATE POLICY "Admins can delete commons messages" ON public.commons_messages
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT DELETE ON public.commons_messages TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.commons_messages;

-- 6. Private realtime channels: only authenticated users may join
DROP POLICY IF EXISTS "authenticated can receive broadcast" ON realtime.messages;
CREATE POLICY "authenticated can receive broadcast" ON realtime.messages
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated can send broadcast" ON realtime.messages;
CREATE POLICY "authenticated can send broadcast" ON realtime.messages
FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Block suspended users from writing their own content
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  NOT public.is_suspended(auth.uid())
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);