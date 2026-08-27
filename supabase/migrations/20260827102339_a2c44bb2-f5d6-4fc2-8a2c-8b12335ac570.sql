
ALTER TABLE public.experiment_run
  ADD COLUMN IF NOT EXISTS funding_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sol_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evm_balance numeric NOT NULL DEFAULT 0;

SELECT cron.unschedule('agent-claude-funding') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agent-claude-funding'
);

SELECT cron.schedule(
  'agent-claude-funding',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--cc40cadf-3a7b-4fe9-a133-baa748684084-dev.lovable.app/api/public/funding',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
