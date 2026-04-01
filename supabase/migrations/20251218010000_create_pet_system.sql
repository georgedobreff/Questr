-- Create Pet Definitions
CREATE TABLE public.pet_definitions (
    id text primary key, -- 'dog', 'wolf'
    name text not null,
    model_path text not null
);

-- Create User Pets
CREATE TABLE public.user_pets (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    pet_def_id text references public.pet_definitions(id) on delete cascade not null,
    nickname text,
    health integer default 100,
    happiness integer default 100,
    status text default 'alive', -- 'alive', 'dead'
    unlocked_at timestamp with time zone default now(),
    last_fed_at timestamp with time zone default now(),
    revival_progress integer default 0
);

-- Enable RLS
ALTER TABLE public.pet_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read pet definitions" ON public.pet_definitions FOR SELECT USING (true);
CREATE POLICY "Users can view their own pets" ON public.user_pets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own pets" ON public.user_pets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own pets" ON public.user_pets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed Pet Definitions
INSERT INTO public.pet_definitions (id, name, model_path) VALUES
('chicken', 'Chicken', '/pets/Chicken.gltf'),
('dog', 'Dog', '/pets/Dog.gltf'),
('horse', 'Horse', '/pets/Horse.gltf'),
('pig', 'Pig', '/pets/Pig.gltf'),
('raccoon', 'Raccoon', '/pets/Raccoon.gltf'),
('sheep', 'Sheep', '/pets/Sheep.gltf'),
('wolf', 'Wolf', '/pets/Wolf.gltf')
ON CONFLICT (id) DO NOTHING;

-- Seed Pet Consumables in Shop
INSERT INTO public.shop_items (name, description, cost, type, slot, source, asset_url) VALUES
('Pet Food', 'Restores 20 Health to your companion.', 15, 'pet_consumable', 'none', 'shop', 'food-bag.png'),
('Fresh Water', 'Restores 10 Health and 10 Happiness.', 5, 'pet_consumable', 'none', 'shop', 'water-bottle.png'),
('Squeaky Toy', 'Restores 30 Happiness.', 25, 'pet_consumable', 'none', 'shop', 'toy.png')
ON CONFLICT (name) DO NOTHING;

-- Function to adopt a pet
CREATE OR REPLACE FUNCTION public.adopt_pet(p_pet_def_id text, p_nickname text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_module_count integer;
BEGIN
    -- Check if user already has a pet
    IF EXISTS (SELECT 1 FROM public.user_pets WHERE user_id = v_user_id) THEN
        RAISE EXCEPTION 'You already have a companion.';
    END IF;

    -- Check if user unlocked 1st module (Reusing logic from check_achievements approx)
    -- Simplified: Count completed quests (Modules)
    -- We assume the "All tasks completed" logic or just trust the frontend triggering this?
    -- No, strictly check DB.
    
    SELECT count(*) INTO v_module_count 
    FROM quests q 
    JOIN plans p ON q.plan_id = p.id 
    WHERE p.user_id = v_user_id 
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id) > 0
    AND (SELECT count(*) FROM tasks t WHERE t.quest_id = q.id AND t.is_completed = false) = 0;

    IF v_module_count < 1 THEN
        RAISE EXCEPTION 'You must complete at least one module to unlock a companion.';
    END IF;

    INSERT INTO public.user_pets (user_id, pet_def_id, nickname)
    VALUES (v_user_id, p_pet_def_id, p_nickname);
END;
$$;
