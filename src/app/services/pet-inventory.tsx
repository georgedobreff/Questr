"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Heart, Smile } from "lucide-react";
import { UserPetInventoryItem } from "@/lib/types";

export default function PetInventory({
  items,
  petAlive = true,
  onUseSuccess
}: {
  items: UserPetInventoryItem[],
  petAlive?: boolean,
  onUseSuccess?: () => void
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const iconFolder = mounted && resolvedTheme === 'dark' ? 'white' : 'black';

  const handleUse = async (item: UserPetInventoryItem) => {
    setLoading(item.id);
    try {
      const { data, error } = await supabase.rpc('use_pet_item', {
        p_pet_item_id: item.pet_item_id
      });

      if (error) throw error;

      toast.success(data as string);
      if (onUseSuccess) onUseSuccess();
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong. Try again.";
      const isTech = errorMessage.includes("Functions") || errorMessage.includes("Edge Function") || errorMessage.includes("fetch");
      toast.error(isTech ? "Something went wrong. Try again." : errorMessage);
    } finally {
      setLoading(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-4">
        You have no treats for your companion. Send them on a mission!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col items-center text-center p-2 border rounded-lg titled-cards relative h-full">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="relative w-12 h-12 mb-2">
              {item.quantity > 1 && (
                <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow-sm border border-white/20">
                  x{item.quantity}
                </div>
              )}
              {iconFolder === "black" ? (
                <div
                  className="absolute inset-0 bg-primary"
                  style={{
                    maskImage: `url(/assets/items/${iconFolder}/${item.pet_items.asset_url})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: `url(/assets/items/${iconFolder}/${item.pet_items.asset_url})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                  }}
                />
              ) : (
                <Image
                  key={iconFolder}
                  src={`/assets/items/${iconFolder}/${item.pet_items.asset_url}`}
                  alt={item.pet_items.name}
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <span className="text-xs font-bold mb-1">{item.pet_items.name}</span>
            <div className="flex gap-1.5 justify-center mb-2 text-[10px] font-semibold flex-wrap">
              {item.pet_items.effect_health ? (
                <span className="flex items-center gap-0.5 text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                  <Heart size={10} fill="currentColor" /> +{item.pet_items.effect_health}
                </span>
              ) : null}
              {item.pet_items.effect_happiness ? (
                <span className="flex items-center gap-0.5 text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">
                  <Smile size={10} fill="currentColor" /> +{item.pet_items.effect_happiness}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs w-auto px-4 mt-auto hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={() => handleUse(item)}
            disabled={loading === item.id || !petAlive}
          >
            {loading === item.id ? "..." : "Use"}
          </Button>
        </div>
      ))}
    </div>
  );
}