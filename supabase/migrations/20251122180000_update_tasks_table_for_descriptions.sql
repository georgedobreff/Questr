-- Rename 'description' to 'title' and add 'short_description' to the 'tasks' table
ALTER TABLE public.tasks
RENAME COLUMN description TO title;

ALTER TABLE public.tasks
ADD COLUMN short_description text;
