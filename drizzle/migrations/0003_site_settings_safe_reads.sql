DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Admins read site settings" ON public.site_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
ALTER TABLE public.site_settings ALTER COLUMN ai_model SET DEFAULT 'openai/gpt-5.6-sol';

CREATE OR REPLACE FUNCTION public.get_public_site_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(s) - 'system_prompt' - 'ai_model' FROM public.site_settings s WHERE s.id = true
$$;
REVOKE ALL ON FUNCTION public.get_public_site_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_settings() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_runtime_site_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE to_jsonb(s) END FROM public.site_settings s WHERE s.id = true
$$;
REVOKE ALL ON FUNCTION public.get_runtime_site_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_runtime_site_settings() TO authenticated, service_role;