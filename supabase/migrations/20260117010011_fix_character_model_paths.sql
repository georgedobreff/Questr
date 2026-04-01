UPDATE public.profiles
SET character_model_path = REPLACE(
  character_model_path,
  '/kenney_blocky-characters_20/Models/GLB format/',
  '/assets/3d-models/characters/'
)
WHERE character_model_path LIKE '/kenney_blocky-characters_20/Models/GLB format/%';