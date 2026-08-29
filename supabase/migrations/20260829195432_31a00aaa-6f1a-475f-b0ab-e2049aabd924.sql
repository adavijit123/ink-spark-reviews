CREATE TABLE public.review_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view','generate','copy_open','confirm')),
  session_id text,
  rating int check (rating between 1 and 5),
  email text,
  language text,
  artist text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);
CREATE INDEX review_events_created_idx ON public.review_events (created_at DESC);
CREATE INDEX review_events_type_idx ON public.review_events (event_type);

GRANT INSERT ON public.review_events TO anon;
GRANT INSERT, SELECT ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;

ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log an event" ON public.review_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can read events" ON public.review_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));