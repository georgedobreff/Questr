-- 1. Schema Updates
ALTER TABLE shop_items
ADD COLUMN IF NOT EXISTS pet_species text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS item_tier int DEFAULT 1,
ADD COLUMN IF NOT EXISTS effect_health int DEFAULT 0,
ADD COLUMN IF NOT EXISTS effect_happiness int DEFAULT 0;

-- 2. Update Backend Logic (Dynamic Item Usage)
CREATE OR REPLACE FUNCTION public.use_pet_item(p_user_item_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_item_name text;
    v_item_type text;
    v_effect_health int;
    v_effect_happiness int;
    v_pet_id uuid;
    v_pet_status text;
    v_current_health int;
    v_current_happiness int;
    v_pet_def_id text;
    v_allowed_species text[];
BEGIN
    -- Verify ownership and get item details
    SELECT 
        s.name, 
        s.type, 
        COALESCE(s.effect_health, 0), 
        COALESCE(s.effect_happiness, 0),
        s.pet_species
    INTO 
        v_item_name, 
        v_item_type, 
        v_effect_health, 
        v_effect_happiness,
        v_allowed_species
    FROM user_items ui
    JOIN shop_items s ON ui.item_id = s.id
    WHERE ui.id = p_user_item_id AND ui.user_id = v_user_id;

    IF v_item_name IS NULL THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    -- Allow 'pet_consumable' (old type) and potentially new types if any, 
    -- but mainly check if it has health/happiness effects or is specifically for pets.
    IF v_item_type != 'pet_consumable' THEN
        RAISE EXCEPTION 'This item is not for companions.';
    END IF;

    -- Check if user has a live pet
    SELECT id, status, health, happiness, pet_def_id 
    INTO v_pet_id, v_pet_status, v_current_health, v_current_happiness, v_pet_def_id
    FROM user_pets 
    WHERE user_id = v_user_id AND status = 'alive' 
    LIMIT 1;
    
    IF v_pet_id IS NULL THEN
        RAISE EXCEPTION 'You have no active companion to use this on.';
    END IF;

    -- Check species compatibility if specified
    IF v_allowed_species IS NOT NULL AND NOT (v_pet_def_id = ANY(v_allowed_species)) THEN
        RAISE EXCEPTION 'This item cannot be used on this type of companion.';
    END IF;

    -- Apply Effects
    UPDATE user_pets 
    SET 
        health = LEAST(100, GREATEST(0, health + v_effect_health)), 
        happiness = LEAST(100, GREATEST(0, happiness + v_effect_happiness)) 
    WHERE id = v_pet_id;

    -- Consume Item
    DELETE FROM user_items WHERE id = p_user_item_id;

    RETURN 'Used ' || v_item_name;
END;
$$;

-- 3. Seed Data
-- We use ON CONFLICT (name) DO UPDATE to ensure we don't duplicate items and we update existing ones.

-- Universal
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Dirty Water', 5, 'Desperate measures. +5 Health, -5 Happiness.', 'pet_consumable', 'pet_consumable', 'water-bolt.png', 1, 5, -5, NULL),
('Fresh Water', 15, 'Refreshing and clean. +10 Health, +10 Happiness.', 'pet_consumable', 'pet_consumable', 'water-splash.png', 1, 10, 10, NULL),
('Sparkling Spring Water', 50, 'Luxury hydration. +20 Health, +30 Happiness.', 'pet_consumable', 'pet_consumable', 'water-bottle.png', 2, 20, 30, NULL),
('Basic Bed', 100, 'A decent place to sleep. +50 Happiness.', 'pet_consumable', 'pet_consumable', 'bed.png', 2, 0, 50, NULL),
('Luxury Cushion', 500, 'The ultimate comfort. +100 Happiness.', 'pet_consumable', 'pet_consumable', 'pillow.png', 3, 0, 100, NULL)
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Dog Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Dry Kibble', 10, 'Standard dog food. +15 Health.', 'pet_consumable', 'pet_consumable', 'dog-bowl.png', 1, 15, 0, ARRAY['Dog']),
('Meaty Bone', 40, 'A tasty treat. +30 Health, +10 Happiness.', 'pet_consumable', 'pet_consumable', 'bone-gnawer.png', 2, 30, 10, ARRAY['Dog']),
('Premium Steak', 150, 'Top quality meat. +80 Health, +50 Happiness.', 'pet_consumable', 'pet_consumable', 'steak.png', 3, 80, 50, ARRAY['Dog']),
('Old Stick', 0, 'It is sticky. +5 Happiness.', 'pet_consumable', 'pet_consumable', 'wood-stick.png', 1, 0, 5, ARRAY['Dog']),
('Tennis Ball', 30, 'Bouncy fun. +20 Happiness.', 'pet_consumable', 'pet_consumable', 'tennis-ball.png', 2, 0, 20, ARRAY['Dog']),
('Squeaky Toy', 75, 'Very annoying, very fun. +50 Happiness.', 'pet_consumable', 'pet_consumable', 'plastic-duck.png', 2, 0, 50, ARRAY['Dog'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Cat Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Fish Scraps', 10, 'Better than nothing. +15 Health.', 'pet_consumable', 'pet_consumable', 'fishbone.png', 1, 15, 0, ARRAY['Cat']),
('Tuna Can', 40, 'Delicious tuna. +35 Health.', 'pet_consumable', 'pet_consumable', 'canned-fish.png', 2, 35, 0, ARRAY['Cat']),
('Fresh Salmon', 150, 'Fresh from the stream. +80 Health, +60 Happiness.', 'pet_consumable', 'pet_consumable', 'salmon.png', 3, 80, 60, ARRAY['Cat']),
('Ball of Yarn', 25, 'Classic entertainment. +25 Happiness.', 'pet_consumable', 'pet_consumable', 'yarn.png', 2, 0, 25, ARRAY['Cat']),
('Catnip Mouse', 80, 'They go crazy for it. +60 Happiness.', 'pet_consumable', 'pet_consumable', 'mouse.png', 2, 0, 60, ARRAY['Cat'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Chicken Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Dried Corn', 5, 'Basic feed. +10 Health.', 'pet_consumable', 'pet_consumable', 'corn.png', 1, 10, 0, ARRAY['Chicken', 'Chick']),
('Grain Mix', 25, 'A healthy mix. +25 Health.', 'pet_consumable', 'pet_consumable', 'wheat.png', 2, 25, 0, ARRAY['Chicken', 'Chick']),
('Organic Seeds', 100, 'Premium seeds. +70 Health, +30 Happiness.', 'pet_consumable', 'pet_consumable', 'plant-seed.png', 3, 70, 30, ARRAY['Chicken', 'Chick']),
('Shiny Pebble', 20, 'Ooh, shiny! +15 Happiness.', 'pet_consumable', 'pet_consumable', 'minerals.png', 1, 0, 15, ARRAY['Chicken', 'Chick'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Horse Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Dry Hay', 15, 'Standard fodder. +20 Health.', 'pet_consumable', 'pet_consumable', 'round-straw-bale.png', 1, 20, 0, ARRAY['Horse']),
('Fresh Oats', 50, 'Energy boosting. +40 Health.', 'pet_consumable', 'pet_consumable', 'oat.png', 2, 40, 0, ARRAY['Horse']),
('Sweet Apple', 120, 'A sweet treat. +60 Health, +40 Happiness.', 'pet_consumable', 'pet_consumable', 'shiny-apple.png', 3, 60, 40, ARRAY['Horse']),
('Salt Lick', 60, 'Essential minerals. +30 Happiness.', 'pet_consumable', 'pet_consumable', 'crystal-cluster.png', 2, 0, 30, ARRAY['Horse'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Pig Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Slop Bucket', 10, 'It is food. +20 Health.', 'pet_consumable', 'pet_consumable', 'full-wood-bucket.png', 1, 20, 0, ARRAY['Pig']),
('Fresh Carrots', 40, 'Crunchy and sweet. +40 Health.', 'pet_consumable', 'pet_consumable', 'carrot.png', 2, 40, 0, ARRAY['Pig']),
('Giant Pumpkin', 130, 'A massive feast. +90 Health.', 'pet_consumable', 'pet_consumable', 'pumpkin.png', 3, 90, 0, ARRAY['Pig']),
('Mud Bucket', 5, 'For wallowing. +50 Happiness.', 'pet_consumable', 'pet_consumable', 'full-metal-bucket.png', 1, 0, 50, ARRAY['Pig'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Raccoon Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Trash Bag', 5, 'One man''s trash... +15 Health.', 'pet_consumable', 'pet_consumable', 'trash-can.png', 1, 15, 0, ARRAY['Raccoon']),
('Pizza Slice', 45, 'The jackpot. +40 Health, +20 Happiness.', 'pet_consumable', 'pet_consumable', 'pizza-slice.png', 2, 40, 20, ARRAY['Raccoon']),
('Shiny Foil', 20, 'So reflective. +20 Happiness.', 'pet_consumable', 'pet_consumable', 'metal-disc.png', 1, 0, 20, ARRAY['Raccoon']),
('Gold Watch', 200, 'The ultimate shiny. +100 Happiness.', 'pet_consumable', 'pet_consumable', 'pocket-watch.png', 3, 0, 100, ARRAY['Raccoon'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Sheep Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Dry Grass', 10, 'Basic grazing. +15 Health.', 'pet_consumable', 'pet_consumable', 'grass.png', 1, 15, 0, ARRAY['Sheep']),
('Clover Patch', 40, 'Lucky finding. +35 Health.', 'pet_consumable', 'pet_consumable', 'clover.png', 2, 35, 0, ARRAY['Sheep']),
('Alfalfa Hay', 110, 'High quality feed. +75 Health.', 'pet_consumable', 'pet_consumable', 'grain-bundle.png', 3, 75, 0, ARRAY['Sheep']),
('Grooming Brush', 50, 'Keeps wool soft. +40 Happiness.', 'pet_consumable', 'pet_consumable', 'comb.png', 2, 0, 40, ARRAY['Sheep'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;

-- Wolf Items
INSERT INTO shop_items (name, cost, description, type, slot, asset_url, item_tier, effect_health, effect_happiness, pet_species) VALUES
('Raw Scraps', 15, 'Leftovers. +20 Health.', 'pet_consumable', 'pet_consumable', 'meat.png', 1, 20, 0, ARRAY['Wolf']),
('Rabbit Leg', 60, 'Fresh catch. +50 Health.', 'pet_consumable', 'pet_consumable', 'ham-shank.png', 2, 50, 0, ARRAY['Wolf']),
('Prime Rib', 180, 'The alpha''s cut. +100 Health.', 'pet_consumable', 'pet_consumable', 'steak.png', 3, 100, 0, ARRAY['Wolf']),
('Chew Log', 25, 'Good for teeth. +20 Happiness.', 'pet_consumable', 'pet_consumable', 'log.png', 1, 0, 20, ARRAY['Wolf'])
ON CONFLICT (name) DO UPDATE SET 
    cost = EXCLUDED.cost, description = EXCLUDED.description, type = EXCLUDED.type, slot = EXCLUDED.slot, asset_url = EXCLUDED.asset_url, 
    item_tier = EXCLUDED.item_tier, effect_health = EXCLUDED.effect_health, effect_happiness = EXCLUDED.effect_happiness, pet_species = EXCLUDED.pet_species;
