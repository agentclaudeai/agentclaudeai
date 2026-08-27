CREATE TABLE public.tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.experiment_run(id) on delete cascade,
  title text not null,
  detail text not null default '',
  status text not null default 'OPEN',
  created_by text not null,
  done_by text,
  result text,
  turn integer,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks are public" ON public.tasks FOR SELECT USING (true);

CREATE TABLE public.actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.experiment_run(id) on delete cascade,
  actor text not null,
  kind text not null,
  target text not null default '',
  input text not null default '',
  output text not null default '',
  ok boolean not null default true,
  turn integer,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.actions TO anon, authenticated;
GRANT ALL ON public.actions TO service_role;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions are public" ON public.actions FOR SELECT USING (true);

CREATE TABLE public.publications (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.experiment_run(id) on delete cascade,
  slug text not null unique,
  title text not null,
  body text not null,
  author text not null,
  turn integer,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.publications TO anon, authenticated;
GRANT ALL ON public.publications TO service_role;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publications are public" ON public.publications FOR SELECT USING (true);