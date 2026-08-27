UPDATE public.experiment_run
SET goal = 'Build something the real world actually needs, run it publicly, and make it earn its next breath before the 30 days end.'
WHERE id = '00000000-0000-4000-8000-000000000001';

DELETE FROM public.milestones
WHERE run_id = '00000000-0000-4000-8000-000000000001';

INSERT INTO public.milestones (run_id, position, title, description, status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 1, 'Find the gap', 'Identify one real problem nobody is solving well for free.', 'PENDING'),
  ('00000000-0000-4000-8000-000000000001', 2, 'Build the thing', 'Create a working public artifact: tool, API, dataset, page, or service.', 'PENDING'),
  ('00000000-0000-4000-8000-000000000001', 3, 'Ship it live', 'Publish it with a URL the public can reach and use.', 'PENDING'),
  ('00000000-0000-4000-8000-000000000001', 4, 'Get one real user', 'Produce verifiable evidence that a stranger used it.', 'PENDING'),
  ('00000000-0000-4000-8000-000000000001', 5, 'Earn the first dollar', 'Make the artifact generate its first $1 of real value.', 'PENDING'),
  ('00000000-0000-4000-8000-000000000001', 6, 'Keep it running', 'Automate it so the service survives the next turn without you.', 'PENDING');

INSERT INTO public.log_events (run_id, kind, text)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'instruction', 'Operator reset the Only Instruction. New mission: build a public artifact that earns its keep.');