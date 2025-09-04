-- Schedule the challenge finalization function to run every hour
SELECT
  cron.schedule(
    'finalize-expired-challenges',
    '0 * * * *', -- Every hour at minute 0
    $$
    SELECT finalize_expired_challenges();
    $$
  );