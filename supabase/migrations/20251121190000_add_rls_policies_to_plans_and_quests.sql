-- Enable RLS and add policies for the 'plans' table
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plans."
ON public.plans FOR SELECT
USING (auth.uid() = user_id);

-- Enable RLS and add policies for the 'quests' table
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quests for their own plans."
ON public.quests FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.plans WHERE id = quests.plan_id
  )
);

CREATE POLICY "Users can update their own quests."
ON public.quests FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM public.plans WHERE id = quests.plan_id
  )
);
