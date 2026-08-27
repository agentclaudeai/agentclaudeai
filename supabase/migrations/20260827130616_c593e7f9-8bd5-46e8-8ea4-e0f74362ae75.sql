ALTER TABLE public.experiment_run
  ADD COLUMN IF NOT EXISTS credit_anchor_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_anchor_spend_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_anchor_at timestamptz;

UPDATE public.experiment_run
SET credit_anchor_usd = 49.52,
    credit_anchor_spend_usd = 0.48,
    credit_anchor_at = now()
WHERE is_active = true;