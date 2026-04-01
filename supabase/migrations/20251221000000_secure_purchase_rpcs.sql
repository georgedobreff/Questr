-- Secure the purchase functions by revoking public access
-- They should only be called by the Edge Functions (Service Role)

-- 1. Secure purchase_item (Gear Shop)
REVOKE ALL ON FUNCTION public.purchase_item(uuid, bigint) FROM public;
REVOKE ALL ON FUNCTION public.purchase_item(uuid, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.purchase_item(uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(uuid, bigint) TO service_role;

-- 2. Secure purchase_pet_item (Pet Shop)
-- Note: Depending on the exact signature in the DB, we ensure we target the right one.
-- The latest definition uses (uuid, bigint).
REVOKE ALL ON FUNCTION public.purchase_pet_item(uuid, bigint) FROM public;
REVOKE ALL ON FUNCTION public.purchase_pet_item(uuid, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.purchase_pet_item(uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_pet_item(uuid, bigint) TO service_role;

-- 3. Just in case the old signature (bigint only) still exists/lingers, revoke it too
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purchase_pet_item' AND pronargs = 1) THEN
        REVOKE ALL ON FUNCTION public.purchase_pet_item(bigint) FROM public, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.purchase_pet_item(bigint) TO service_role;
    END IF;
END $$;
