ALTER TABLE public.experiment_run
  ADD COLUMN IF NOT EXISTS working_label text,
  ADD COLUMN IF NOT EXISTS working_since timestamptz,
  ADD COLUMN IF NOT EXISTS working_note text,
  ADD COLUMN IF NOT EXISTS last_shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_shipped text;

SELECT cron.unschedule('agent-claude-tick') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'agent-claude-tick'
);

SELECT cron.schedule(
  'agent-claude-tick',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--cc40cadf-3a7b-4fe9-a133-baa748684084-dev.lovable.app/api/public/tick',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);