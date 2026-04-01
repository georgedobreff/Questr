ALTER TABLE public.plans
DROP CONSTRAINT IF EXISTS plans_user_id_fkey;

ALTER TABLE public.plans
ADD CONSTRAINT plans_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
