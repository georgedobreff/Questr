import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ShopClientPage from './shop-client-page';
import type { UserItem, UserPetInventoryItem } from "@/lib/types";

export default async function ShopPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: activePlan, error: planError } = await supabase
    .from("plans")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    console.error("Error fetching active plan:", planError);
    return <p className="text-red-500">Error loading shop data.</p>;
  }

  if (!activePlan) {
    return (
      <main className="flex flex-col h-full items-center justify-center p-8">

        <p className="text-muted-foreground">Try staring a Journey first.</p>
      </main>
    )
  }

  const [itemsRes, petItemsRes, profileRes, userGearRes, userSuppliesRes, petRes] = await Promise.all([
    supabase.from("shop_items").select("*").eq('source', 'shop').or(`plan_id.eq.${activePlan.id},plan_id.is.null`).order('cost', { ascending: true }),
    supabase.from("pet_items").select("*").eq("show_in_shop", true).order('cost', { ascending: true }),
    supabase.from("profiles").select("coins").eq("id", user.id).single(),
    supabase.from("user_items").select("*, shop_items(*)").eq("user_id", user.id),
    supabase.from("user_pet_inventory").select("*, pet_items(*)").eq("user_id", user.id),
    supabase.from("user_pets").select("pet_def_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  const { data: shopItems, error: itemsError } = itemsRes;
  const { data: petItems, error: petItemsError } = petItemsRes;
  const { data: profile, error: profileError } = profileRes;
  const { data: userInventoryGear, error: gearError } = userGearRes;
  const { data: userInventorySupplies, error: suppliesError } = userSuppliesRes;
  const { data: activePet } = petRes;

  if (itemsError || petItemsError || profileError || gearError || suppliesError) {
    console.error("Error fetching shop data:", { itemsError, petItemsError, profileError, gearError, suppliesError });
    return <p className="text-red-500">Error loading the shop. Please try again later.</p>;
  }

  const ownedItemIds = new Set((userInventoryGear || []).map((item: { item_id: number; }) => item.item_id));

  return (
    <main id="shop-container" className="h-full w-full overflow-hidden">
      <div className="w-full h-full max-w-5xl mx-auto">
        <ShopClientPage
          shopItems={shopItems || []}
          petItems={petItems || []}
          initialCoins={profile?.coins || 0}
          ownedItemIds={ownedItemIds}
          initialUserInventoryGear={(userInventoryGear || []) as unknown as UserItem[]}
          initialUserInventorySupplies={(userInventorySupplies || []) as unknown as UserPetInventoryItem[]}
          userPetSpecies={activePet?.pet_def_id}
        />
      </div>
    </main>
  );
}
