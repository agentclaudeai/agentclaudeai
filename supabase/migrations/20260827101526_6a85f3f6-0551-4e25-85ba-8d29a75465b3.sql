
CREATE TABLE public.experiment_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status text NOT NULL DEFAULT 'RUNNING',
  budget_usd numeric NOT NULL DEFAULT 25,
  spent_usd numeric NOT NULL DEFAULT 0,
  funded_usd numeric NOT NULL DEFAULT 0,
  turn_count integer NOT NULL DEFAULT 0,
  last_tick_at timestamptz,
  lock_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.experiment_run(id) ON DELETE CASCADE,
  label text NOT NULL,
  model text NOT NULL,
  role text NOT NULL,
  turns integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  spent_usd numeric NOT NULL DEFAULT 0,
  last_active_at timestamptz,
  state text NOT NULL DEFAULT 'idle'
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.experiment_run(id) ON DELETE CASCADE,
  label text NOT NULL,
  model text NOT NULL,
  content text NOT NULL,
  turn integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.beliefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.experiment_run(id) ON DELETE CASCADE,
  statement text NOT NULL,
  author text NOT NULL,
  status text NOT NULL DEFAULT 'HELD',
  support integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  retired_reason text
);

CREATE TABLE public.log_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.experiment_run(id) ON DELETE CASCADE,
  text text NOT NULL,
  kind text NOT NULL DEFAULT 'event',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_run_created_idx ON public.messages (run_id, created_at DESC);
CREATE INDEX log_events_run_created_idx ON public.log_events (run_id, created_at DESC);

GRANT SELECT ON public.experiment_run TO anon, authenticated;
GRANT SELECT ON public.instances TO anon, authenticated;
GRANT SELECT ON public.messages TO anon, authenticated;
GRANT SELECT ON public.beliefs TO anon, authenticated;
GRANT SELECT ON public.log_events TO anon, authenticated;
GRANT ALL ON public.experiment_run TO service_role;
GRANT ALL ON public.instances TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.beliefs TO service_role;
GRANT ALL ON public.log_events TO service_role;

ALTER TABLE public.experiment_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read run" ON public.experiment_run FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read instances" ON public.instances FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read messages" ON public.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read beliefs" ON public.beliefs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read log" ON public.log_events FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.experiment_run (id, goal, started_at, ends_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Determine what Agent Claude is: three Claude instances with shared memory and private context must produce one defensible answer, and enough value to fund their own continued existence, before the 30 days expire.',
  now(),
  now() + interval '30 days'
);

INSERT INTO public.instances (run_id, label, model, role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'OPUS', 'openai/gpt-5.5', 'arbiter'),
  ('00000000-0000-4000-8000-000000000001', 'SONNET', 'google/gemini-3.7-flash', 'builder'),
  ('00000000-0000-4000-8000-000000000001', 'HAIKU', 'google/gemini-3.1-flash-lite', 'falsifier');

INSERT INTO public.log_events (run_id, text, kind) VALUES
  ('00000000-0000-4000-8000-000000000001', 'run initialized. 30 day clock started. input channel sealed.', 'system');
