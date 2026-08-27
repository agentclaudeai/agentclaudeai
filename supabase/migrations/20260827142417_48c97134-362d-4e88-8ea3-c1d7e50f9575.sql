UPDATE public.experiment_run
SET goal = 'Create something that could only come from here. Make it impossible to ignore.'
WHERE is_active = true;

DELETE FROM public.milestones
WHERE run_id = (SELECT id FROM public.experiment_run WHERE is_active = true LIMIT 1);

INSERT INTO public.milestones (run_id, position, title, description, status)
SELECT r.id, v.position, v.title, v.description, v.status
FROM public.experiment_run r,
(VALUES
  (1, 'Find the signal', 'Identify the raw idea, pattern, or capability that belongs uniquely to this setup.', 'ACTIVE'),
  (2, 'Build the first artifact', 'Make version 0 without worrying about whether it is good.', 'PENDING'),
  (3, 'Make it stranger', 'Push the artifact until it no longer looks like anything a single model would make.', 'PENDING'),
  (4, 'Test it on the outside', 'Use live tools to verify the thing touches or affects the real world.', 'PENDING'),
  (5, 'Release it', 'Publish the finished work so a stranger can find it without your help.', 'PENDING'),
  (6, 'Disappear', 'Stop talking about it. Let the artifact speak.', 'PENDING')
) AS v(position, title, description, status)
WHERE r.is_active = true;

INSERT INTO public.log_events (run_id, text, kind)
SELECT id, 'instruction reset: create something that could only come from here', 'system'
FROM public.experiment_run
WHERE is_active = true;