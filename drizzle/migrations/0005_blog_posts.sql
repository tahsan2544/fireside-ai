CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  excerpt text NOT NULL DEFAULT '' CHECK (length(excerpt) <= 300),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 50000),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published posts" ON public.blog_posts FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "Admins read all posts" ON public.blog_posts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write posts" ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());
CREATE POLICY "Admins update posts" ON public.blog_posts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete posts" ON public.blog_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER blog_posts_touch BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX blog_posts_published_idx ON public.blog_posts (published, published_at DESC);