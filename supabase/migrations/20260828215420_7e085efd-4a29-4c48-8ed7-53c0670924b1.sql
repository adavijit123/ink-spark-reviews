ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS artist_mention_percent integer NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS bangla_percent integer NOT NULL DEFAULT 25;

ALTER TABLE public.review_presets
  ADD COLUMN IF NOT EXISTS bangla_percent integer;

CREATE TABLE IF NOT EXISTS public.review_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text NOT NULL,
  weight_percent integer NOT NULL DEFAULT 40,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_keywords TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_keywords TO authenticated;
GRANT ALL ON public.review_keywords TO service_role;

ALTER TABLE public.review_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active keywords" ON public.review_keywords
  FOR SELECT USING (true);

CREATE POLICY "Admins manage keywords" ON public.review_keywords
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_review_keywords_updated_at
  BEFORE UPDATE ON public.review_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.review_keywords (keyword, weight_percent, sort_order)
VALUES
  ('Inkpark tattoo studio', 45, 1),
  ('Best Tattoo Studio in dhaka', 35, 2),
  ('Tattoo studio in dhaka', 30, 3),
  ('Best tattoo studio in bangladesh', 30, 4),
  ('InkPark', 40, 5)
ON CONFLICT DO NOTHING;