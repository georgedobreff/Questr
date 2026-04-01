CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

select
  cron.schedule(
    'check-trial-expiration',
    '0 * * * *', -- Run every hour
    $$
    select
      net.http_post(
          url:='https://knkvjvcsqvsuilyndtct.supabase.co/functions/v1/check-trial-expiration',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );
