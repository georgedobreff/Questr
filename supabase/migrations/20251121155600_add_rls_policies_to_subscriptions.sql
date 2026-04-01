-- Allow users to read their own subscription status
create policy "Allow users to read their own subscription"
on "public"."subscriptions"
as permissive
for select
to authenticated
using ((auth.uid() = user_id));

-- Allow users to update their own subscription
create policy "Allow users to update their own subscription"
on "public"."subscriptions"
as permissive
for update
to authenticated
using ((auth.uid() = user_id));
