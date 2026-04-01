alter table "public"."subscriptions" 
add column "lemon_squeezy_customer_id" text,
add column "lemon_squeezy_subscription_id" text,
add column "variant_id" text,
add column "renews_at" timestamp with time zone;

create index subscriptions_ls_cust_id_idx on public.subscriptions (lemon_squeezy_customer_id);
create index subscriptions_ls_sub_id_idx on public.subscriptions (lemon_squeezy_subscription_id);
