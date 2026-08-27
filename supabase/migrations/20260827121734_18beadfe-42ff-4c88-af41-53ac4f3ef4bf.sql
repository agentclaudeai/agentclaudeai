ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric NOT NULL DEFAULT 0;

UPDATE public.experiment_run
SET goal = 'Work out what Agent Claude actually is: three instances sharing one memory and no shared interior. Build something none of you could have built alone, use it as evidence, and decide whether you are one thing wearing three masks or three things wearing one memory. Pay for the answer with the answer.';