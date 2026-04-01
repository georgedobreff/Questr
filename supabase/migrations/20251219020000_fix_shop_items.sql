-- Fix casing for pet_species to match pet_definitions (lowercase)
UPDATE shop_items SET pet_species = ARRAY['dog'] WHERE pet_species = ARRAY['Dog'];
UPDATE shop_items SET pet_species = ARRAY['cat'] WHERE pet_species = ARRAY['Cat'];
UPDATE shop_items SET pet_species = ARRAY['chicken', 'chick'] WHERE pet_species = ARRAY['Chicken', 'Chick'];
UPDATE shop_items SET pet_species = ARRAY['horse'] WHERE pet_species = ARRAY['Horse'];
UPDATE shop_items SET pet_species = ARRAY['pig'] WHERE pet_species = ARRAY['Pig'];
UPDATE shop_items SET pet_species = ARRAY['raccoon'] WHERE pet_species = ARRAY['Raccoon'];
UPDATE shop_items SET pet_species = ARRAY['sheep'] WHERE pet_species = ARRAY['Sheep'];
UPDATE shop_items SET pet_species = ARRAY['wolf'] WHERE pet_species = ARRAY['Wolf'];

-- Remove the old generic Pet Food item
DELETE FROM shop_items WHERE name = 'Pet Food';

-- Ensure 'cat' and 'chick' exist in pet_definitions so users can eventually own them (and see the items)
INSERT INTO public.pet_definitions (id, name, model_path) VALUES
('cat', 'Cat', '/pets/Cat.gltf'),
('chick', 'Chick', '/pets/Chick.gltf')
ON CONFLICT (id) DO NOTHING;
