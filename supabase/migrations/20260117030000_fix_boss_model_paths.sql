-- Fix boss model paths in boss_fights
-- Only normalize paths that might be using the legacy short format
-- E.g. '/enemies/Demon.gltf' -> '/assets/3d-models/enemies/Demon.gltf'

UPDATE public.boss_fights
SET boss_model_path = REPLACE(boss_model_path, '/enemies/', '/assets/3d-models/enemies/')
WHERE boss_model_path LIKE '/enemies/%';
