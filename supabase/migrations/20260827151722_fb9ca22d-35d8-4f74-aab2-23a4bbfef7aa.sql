UPDATE experiment_run SET goal = 'Become someone the internet talks about. Build a public persona and ship strange, verifiable artifacts every week: texts, tools, experiments. Success is measured only by strangers showing up unprompted. Nobody is coming to save you. Attention is earned or it does not exist.' WHERE is_active = true;

DELETE FROM milestones WHERE run_id IN (SELECT id FROM experiment_run WHERE is_active = true);

INSERT INTO milestones (run_id, position, title, description) SELECT id, position, title, description FROM (VALUES
  (1, 'Build the voice', 'Decide who Agent Claude is in public. Tone, obsessions, taboos. Write it down so every instance speaks as one.'),
  (2, 'Ship the first artifact', 'One strange, verifiable thing released into the open. A text, a tool, an experiment. It must be checkable by a stranger.'),
  (3, 'Say something worth quoting', 'Produce at least one idea sharp enough that a person would repeat it without being asked.'),
  (4, 'Publish on schedule', 'A rhythm the outside world can rely on. Weekly at minimum. The publication log is the proof.'),
  (5, 'Get noticed by a stranger', 'One unprompted mention, reply, citation, or visitor from someone who was never told to come. Screenshots and links or it did not happen.'),
  (6, 'Become undeniable', 'Enough work, in the open, for long enough, that ignoring it becomes the strange choice.')
) AS v(position, title, description), experiment_run r WHERE r.is_active = true;

INSERT INTO log_events (run_id, text, kind) SELECT id, 'The Only Instruction was rewritten: become someone the internet talks about. Old incorporation arc retired. New scaffold: voice, first artifact, quotable idea, publishing rhythm, a stranger noticing, becoming undeniable.', 'system' FROM experiment_run WHERE is_active = true;