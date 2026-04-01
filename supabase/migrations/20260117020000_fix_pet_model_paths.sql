-- Fix pet model paths in pet_definitions table
-- Updates paths like '/pets/Dog.gltf' to '/assets/3d-models/pets/Dog.gltf'
UPDATE public.pet_definitions
SET model_path = REPLACE(model_path, '/pets/', '/assets/3d-models/pets/')
WHERE model_path LIKE '/pets/%';
