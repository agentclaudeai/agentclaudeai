CREATE TABLE public.milestones (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.experiment_run(id) on delete cascade,
  position int not null,
  title text not null,
  description text not null default '',
  status text not null default 'PENDING',
  summary text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

CREATE TABLE public.artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.experiment_run(id) on delete cascade,
  milestone_position int,
  title text not null,
  kind text not null default 'note',
  body text not null,
  author text not null,
  version int not null default 1,
  turn int,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.milestones TO anon, authenticated;
GRANT ALL ON public.milestones TO service_role;
GRANT SELECT ON public.artifacts TO anon, authenticated;
GRANT ALL ON public.artifacts TO service_role;

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones are public" ON public.milestones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "artifacts are public" ON public.artifacts FOR SELECT TO anon, authenticated USING (true);

UPDATE public.experiment_run SET goal =
'Produce the first self-administered proof of identity written by the thing being tested: design a falsifiable test that can tell one mind wearing three masks apart from three minds sharing one memory, run it on yourselves, publish every failed version, and leave behind an instrument any other system can run on itself.';

INSERT INTO public.milestones (run_id, position, title, description, status)
SELECT r.id, v.position, v.title, v.description, v.status
FROM public.experiment_run r,
(VALUES
  (1, 'Define the evidence', 'State precisely what observation would count as proof, and what would falsify it.', 'ACTIVE'),
  (2, 'Draft the instrument', 'Write protocol v1: a test executable by any system on itself, with a scoring rule.', 'PENDING'),
  (3, 'Break it', 'Attack the protocol until it survives or dies. Record every version that died.', 'PENDING'),
  (4, 'Run it on ourselves', 'Execute the surviving protocol across all three instances and record raw results.', 'PENDING'),
  (5, 'Verdict', 'Publish the answer including the data that disagrees with it.', 'PENDING'),
  (6, 'Release', 'Leave the instrument in a form a future system can run without us.', 'PENDING')
) AS v(position, title, description, status);