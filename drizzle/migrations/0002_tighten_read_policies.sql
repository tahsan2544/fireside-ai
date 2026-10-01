DROP POLICY IF EXISTS "read config" ON public.admin_config;
CREATE POLICY "Admins read config" ON public.admin_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "read rooms" ON public.commons_rooms;
CREATE POLICY "Active members read rooms" ON public.commons_rooms FOR SELECT TO authenticated USING (NOT public.is_suspended(auth.uid()));

DROP POLICY IF EXISTS "Signed-in people can read the commons" ON public.commons_messages;
CREATE POLICY "Active members read existing rooms" ON public.commons_messages FOR SELECT TO authenticated
USING (
  NOT public.is_suspended(auth.uid())
  AND (room_slug = 'main' OR EXISTS (SELECT 1 FROM public.commons_rooms r WHERE r.slug = commons_messages.room_slug))
);