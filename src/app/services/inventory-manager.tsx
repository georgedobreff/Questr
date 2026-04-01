"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import type { UserItem, EquippedItem } from "@/lib/types";

export default function InventoryManager({ userItems, equippedItems }: { userItems: UserItem[], equippedItems: EquippedItem[] }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const iconFolder = mounted && resolvedTheme === 'dark' ? 'white' : 'black';

  const isEquipped = (itemId: number) => {
    return equippedItems.some((equipped: EquippedItem) => equipped.item_id === itemId);
  };

  const filteredItems = userItems.filter(item => item.shop_items.name !== "Magic Mirror");

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {filteredItems.map((item: UserItem) => {
        const equipped = isEquipped(item.item_id);
        const iconPath = item.shop_items.asset_url
          ? `/assets/items/${iconFolder}/${item.shop_items.asset_url}`
          : `/assets/items/${iconFolder}/token.png`;

        return (
          <div key={item.id} className="p-2 border rounded-lg flex flex-col items-center justify-center text-center relative h-full">
            <div className="w-16 h-16 mb-2 flex items-center justify-center relative">
              {iconFolder === "black" ? (
                <div
                  className="absolute inset-0 bg-primary"
                  style={{
                    maskImage: `url(${iconPath})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: `url(${iconPath})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                  }}
                />
              ) : (
                <Image
                  key={iconFolder}
                  src={iconPath}
                  alt={item.shop_items.name}
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <p className="font-bold text-sm">{item.shop_items.name}</p>
            <p className="text-xs text-muted-foreground mb-2">{item.shop_items.description}</p>
          </div>
        );
      })}
    </div>
  );
}
