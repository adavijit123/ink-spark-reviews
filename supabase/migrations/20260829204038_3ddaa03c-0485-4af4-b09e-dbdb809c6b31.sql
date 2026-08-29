CREATE TABLE IF NOT EXISTS public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tattoo_style text not null default '',
  consultation text not null default '',
  attention_to_detail text not null default '',
  professionalism text not null default '',
  aftercare_guidance text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.artist_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artist_profiles TO authenticated;
GRANT ALL ON public.artist_profiles TO service_role;

ALTER TABLE public.artist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active artist profiles" ON public.artist_profiles FOR SELECT USING (is_active);
CREATE POLICY "Admins manage artist profiles" ON public.artist_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_artist_profiles_updated_at BEFORE UPDATE ON public.artist_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.artist_profiles (name, tattoo_style, consultation, attention_to_detail, professionalism, aftercare_guidance, sort_order)
VALUES
('Avijit Saha',
 'Known for realism, black & grey shading and fine line custom work',
 'Sits with the customer first, understands the idea and suggests placement and size before starting',
 'Very careful with line work, shading and small details, takes time to get it right',
 'Calm, polite and professional, keeps everything hygienic and uses fresh needles',
 'Explains aftercare clearly and follows up on how the healing is going',
 1),
('Sharif Uddin',
 'Custom lettering, fine line and clean black & grey designs',
 'Discusses the design idea patiently and adjusts it until the customer is happy',
 'Precise, neat line work and clean finishing',
 'Friendly and professional, maintains a clean and hygienic setup',
 'Gives clear aftercare instructions before the customer leaves',
 2)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.review_keywords (keyword, weight_percent, sort_order)
SELECT k.keyword, 35, k.ord FROM (VALUES
  ('Tattoo Studio', 10),
  ('Dhaka', 11),
  ('Mirpur', 12),
  ('Custom Tattoo', 13),
  ('Black & Grey', 14),
  ('Fine Line', 15),
  ('Professional Artist', 16),
  ('Hygiene', 17),
  ('Aftercare', 18)
) AS k(keyword, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.review_keywords rk WHERE lower(rk.keyword) = lower(k.keyword));