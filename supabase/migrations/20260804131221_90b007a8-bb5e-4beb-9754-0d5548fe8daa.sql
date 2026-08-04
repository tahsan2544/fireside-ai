DROP POLICY IF EXISTS "authenticated can receive broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can send broadcast" ON realtime.messages;

CREATE POLICY "commons rooms receive" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'commons:%'
    AND EXISTS (
      SELECT 1 FROM public.commons_rooms r
      WHERE r.slug = substring(realtime.topic() from 9)
    )
  );

CREATE POLICY "commons rooms send" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'commons:%'
    AND NOT public.is_suspended(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.commons_rooms r
      WHERE r.slug = substring(realtime.topic() from 9)
    )
  );