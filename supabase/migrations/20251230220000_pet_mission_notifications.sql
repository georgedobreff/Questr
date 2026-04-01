-- Migration to add notifications for Pet Mission completion

CREATE OR REPLACE FUNCTION public.notify_pet_mission_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pet_nickname text;
BEGIN
    -- Only notify when transitioning from 'ongoing' to 'completed' or 'failed'
    IF (OLD.status = 'ongoing' AND (NEW.status = 'completed' OR NEW.status = 'failed')) THEN
        SELECT nickname INTO v_pet_nickname FROM public.user_pets WHERE id = NEW.pet_id;
        
        INSERT INTO public.notifications (user_id, title, message, type, action_link)
        VALUES (
            NEW.user_id, 
            CASE WHEN NEW.status = 'completed' THEN 'Mission Successful!' ELSE 'Mission Failed' END,
            CASE WHEN NEW.status = 'completed' 
                 THEN COALESCE(v_pet_nickname, 'Your companion') || ' has returned with rewards!' 
                 ELSE COALESCE(v_pet_nickname, 'Your companion') || ' has returned empty-handed.' 
            END,
            CASE WHEN NEW.status = 'completed' THEN 'success' ELSE 'warning' END,
            '/pet'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pet_mission_notifications ON public.pet_missions;
CREATE TRIGGER tr_pet_mission_notifications
AFTER UPDATE ON public.pet_missions
FOR EACH ROW EXECUTE FUNCTION public.notify_pet_mission_completion();
