CREATE TABLE public.token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.experiment_run(id) ON DELETE CASCADE,
  label text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  turn integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.token_usage TO anon;
GRANT SELECT ON public.token_usage TO authenticated;
GRANT ALL ON public.token_usage TO service_role;

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token usage is public" ON public.token_usage FOR SELECT USING (true);

CREATE INDEX token_usage_run_created_idx ON public.token_usage (run_id, created_at DESC);