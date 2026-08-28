-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Bootstrap: first signed-in user may claim admin while no admin exists
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN public.has_role(uid, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

-- TIMESTAMP HELPER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- STUDIO SETTINGS (singleton)
CREATE TABLE public.studio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_name text NOT NULL DEFAULT 'InkPark Tattoo Studio',
  tagline text NOT NULL DEFAULT 'Custom tattoos. Clean lines. Zero rush.',
  google_review_url text NOT NULL DEFAULT 'https://g.page/r/Cf-vHSmJ-os4EB0/review',
  studio_info text NOT NULL DEFAULT '',
  services text NOT NULL DEFAULT '',
  artists text NOT NULL DEFAULT '',
  experience_keywords text NOT NULL DEFAULT '',
  ai_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.studio_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_settings TO authenticated;
GRANT ALL ON public.studio_settings TO service_role;
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read studio settings"
  ON public.studio_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage studio settings"
  ON public.studio_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER studio_settings_updated_at
  BEFORE UPDATE ON public.studio_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CATEGORIES
CREATE TABLE public.review_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_categories TO authenticated;
GRANT ALL ON public.review_categories TO service_role;
ALTER TABLE public.review_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active categories"
  ON public.review_categories FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage categories"
  ON public.review_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER review_categories_updated_at
  BEFORE UPDATE ON public.review_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRESETS
CREATE TABLE public.review_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.review_categories(id) ON DELETE SET NULL,
  content text NOT NULL,
  tone text NOT NULL DEFAULT 'friendly',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_presets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_presets TO authenticated;
GRANT ALL ON public.review_presets TO service_role;
ALTER TABLE public.review_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active presets"
  ON public.review_presets FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage presets"
  ON public.review_presets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER review_presets_updated_at
  BEFORE UPDATE ON public.review_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED
INSERT INTO public.studio_settings (studio_info, services, artists, experience_keywords, ai_instructions) VALUES (
  'InkPark Tattoo Studio is a modern black-and-grey focused tattoo studio known for its spotless hygiene, calm private booths, and custom design consultations. Walk-ins welcome, appointments preferred.',
  'Custom tattoo design, fine-line tattoos, black and grey realism, cover-ups, script and lettering, small minimal tattoos, touch-ups, piercing, aftercare guidance',
  'Rafi (black & grey realism), Nabil (fine-line and minimal), Sadia (colour and floral work)',
  'clean and sterile, friendly staff, painless, patient artist, great line work, healed perfectly, fair pricing, relaxed atmosphere, on-time appointment, great consultation, aftercare advice',
  'Write a short, natural-sounding Google review from a happy customer of the studio. Use simple everyday language, 2 to 4 sentences, first person. Vary sentence structure and vocabulary every time. Never sound like an ad or use hashtags, emojis, quotes, or headings. Do not invent prices or specific dates. Mention at most one artist name and one or two experience details.'
);

INSERT INTO public.review_categories (name, description, sort_order) VALUES
  ('First Tattoo', 'Nervous first-timer had a great experience', 1),
  ('Custom Design', 'Praise for the custom design process', 2),
  ('Hygiene & Studio', 'Clean studio, professional setup', 3),
  ('Artist Skill', 'Focus on the artist''s line work and detail', 4),
  ('Cover-Up', 'Old tattoo covered or fixed', 5);

INSERT INTO public.review_presets (category_id, content, tone, sort_order)
SELECT c.id, v.content, v.tone, v.sort_order
FROM (VALUES
  ('First Tattoo', 'Got my first tattoo here and the team made me feel completely at ease from start to finish.', 'warm', 1),
  ('First Tattoo', 'I was really nervous walking in, but they explained every step and it hurt far less than I expected.', 'reassuring', 2),
  ('Custom Design', 'They took my rough idea and turned it into a design that was better than anything I had in mind.', 'enthusiastic', 1),
  ('Custom Design', 'The consultation was proper and unrushed, and the final custom piece fits my arm perfectly.', 'detailed', 2),
  ('Hygiene & Studio', 'Spotlessly clean studio, fresh needles opened in front of me, and a really calm private booth.', 'factual', 1),
  ('Artist Skill', 'The line work is razor sharp and the shading healed beautifully with no touch-up needed.', 'detailed', 1),
  ('Cover-Up', 'They covered an old tattoo I hated and you honestly cannot tell there was anything there before.', 'grateful', 1)
) AS v(cat, content, tone, sort_order)
JOIN public.review_categories c ON c.name = v.cat;