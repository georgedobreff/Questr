"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { ShopItem as ShopItemType, PetItem as PetItemType, UserItem, UserPetInventoryItem } from '@/lib/types';
import { Heart, Smile, Coins, Package, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ShopItemCardProps {
    item: ShopItemType | PetItemType;
    userCoins: number;
    owned: boolean;
    isPetItem: boolean;
    mode: 'buy' | 'sell';
    quantity?: number;
    onAction: (item: ShopItemType | PetItemType) => Promise<void>;
}

function ShopItemCard({ item, userCoins, owned, isPetItem, mode, quantity, onAction }: ShopItemCardProps) {
    const [loading, setLoading] = useState(false);
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const canAfford = userCoins >= item.cost;
    const sellPrice = Math.floor(item.cost / 2);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleAction = async () => {
        setLoading(true);
        await onAction(item);
        setLoading(false);
    };

    const themeFolder = mounted && resolvedTheme === 'dark' ? 'white' : 'black';
    const iconSrc = item.asset_url ? `/assets/items/${themeFolder}/${item.asset_url}` : null;

    const petItem = isPetItem ? (item as PetItemType) : null;

    return (
        <div className="titled-cards flex flex-col items-center text-center h-full justify-between transition-all relative group p-6">
            {mode === 'sell' && isPetItem && quantity !== undefined && quantity > 1 && (
                <div className="absolute top-2 right-2 z-10">
                    <Badge variant="secondary" className="flex items-center gap-1 font-bold">
                        <Package size={10} /> x{quantity}
                    </Badge>
                </div>
            )}
            <div className="flex-1 flex flex-col items-center justify-center w-full">
                {iconSrc && (
                    <div className="w-16 h-16 relative mb-4">
                        {themeFolder === 'black' ? (
                            <div
                                className="absolute inset-0 bg-primary transition-all duration-300"
                                style={{
                                    maskImage: `url(${iconSrc})`,
                                    maskSize: 'contain',
                                    maskRepeat: 'no-repeat',
                                    maskPosition: 'center',
                                    WebkitMaskImage: `url(${iconSrc})`,
                                    WebkitMaskSize: 'contain',
                                    WebkitMaskRepeat: 'no-repeat',
                                    WebkitMaskPosition: 'center',
                                }}
                            />
                        ) : (
                            <Image
                                key={themeFolder}
                                src={iconSrc}
                                alt={item.name}
                                fill
                                className="object-contain transition-all duration-300"
                            />
                        )}
                    </div>
                )}
                <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                <p className="text-xs text-muted-foreground mb-3 mt-1">
                    {item.description}
                </p>
                {isPetItem && petItem && (
                    <div className="flex gap-2 justify-center mb-3 text-[10px] font-bold uppercase tracking-wide">
                        {petItem.effect_health ? (
                            <span className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                                <Heart size={10} fill="currentColor" /> +{petItem.effect_health}
                            </span>
                        ) : null}
                        {petItem.effect_happiness ? (
                            <span className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                                <Smile size={10} fill="currentColor" /> +{petItem.effect_happiness}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>
            <div className="w-full mt-2">
                <Button
                    className={cn(
                        "w-full font-bold gap-2 transition-all rounded-lg",
                        mode === 'buy' && !(owned && !isPetItem) ? "hover:bg-primary hover:text-primary-foreground hover:border-primary" : ""
                    )}
                    onClick={handleAction}
                    disabled={loading || (mode === 'buy' && !canAfford)}
                    variant={mode === 'buy' && owned && !isPetItem ? "secondary" : (mode === 'buy' ? "outline" : "destructive")}
                >
                    {loading ? (mode === 'buy' ? 'Buying...' : 'Selling...') : (
                        <>
                            {mode === 'buy' ? (
                                owned && !isPetItem ? 'Owned' : (
                                    <>
                                        <Coins size={16} className="text-amber-500 fill-amber-500" /> {item.cost}
                                    </>
                                )
                            ) : (
                                <>
                                    <Coins size={16} className="text-amber-500 fill-amber-500" /> {sellPrice}
                                </>
                            )}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

export default function ShopClientPage({
    shopItems,
    petItems,
    initialCoins,
    ownedItemIds,
    initialUserInventoryGear,
    initialUserInventorySupplies,
    userPetSpecies
}: {
    shopItems: ShopItemType[],
    petItems: PetItemType[],
    initialCoins: number,
    ownedItemIds: Set<number>,
    initialUserInventoryGear: UserItem[],
    initialUserInventorySupplies: UserPetInventoryItem[],
    userPetSpecies?: string | null
}) {
    const router = useRouter();
    const supabase = createClient();
    const [userCoins, setUserCoins] = useState(initialCoins);
    const [localOwnedItemIds, setLocalOwnedItemIds] = useState(ownedItemIds);
    const [userInventoryGear, setUserInventoryGear] = useState<UserItem[]>(initialUserInventoryGear);
    const [userInventorySupplies, setUserInventorySupplies] = useState<UserPetInventoryItem[]>(initialUserInventorySupplies);
    const [mode, setMode] = useState<'buy' | 'sell'>('buy');

    const handlePurchase = async (item: ShopItemType | PetItemType, isPetItem: boolean) => {
        const { error } = await supabase.functions.invoke('purchase-item', {
            body: { item_id: item.id, is_pet_item: isPetItem }
        });

        if (error) {
            const isTech = error.message.includes("Functions") || error.message.includes("Edge Function") || error.message.includes("fetch");
            toast.error(isTech ? "Something went wrong. Try again." : error.message);
        } else {
            setUserCoins(prev => prev - item.cost);
            if (!isPetItem) {
                setLocalOwnedItemIds(prev => new Set(prev).add(item.id));
                const newGearItem: UserItem = {
                    id: Math.random(),
                    user_id: "",
                    item_id: item.id,
                    shop_items: item as ShopItemType
                };
                setUserInventoryGear(prev => [...prev, newGearItem]);
            } else {
                setUserInventorySupplies(prev => {
                    const existing = prev.find(i => i.pet_item_id === item.id);
                    if (existing) {
                        return prev.map(i => i.pet_item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
                    } else {
                        return [...prev, { id: Math.random(), user_id: "", pet_item_id: item.id, quantity: 1, pet_items: item as PetItemType }];
                    }
                });
            }
            toast.success(`Bought ${item.name}`);
            router.refresh();
        }
    };

    const handleSell = async (item: ShopItemType | PetItemType, isPetItem: boolean) => {
        const { data, error } = await supabase.rpc(isPetItem ? 'sell_pet_item' : 'sell_item', {
            [isPetItem ? 'p_pet_item_id' : 'p_item_id']: item.id
        });

        if (error) {
            const isTech = error.message.includes("Functions") || error.message.includes("Edge Function") || error.message.includes("fetch");
            toast.error(isTech ? "Something went wrong. Try again." : error.message);
        } else {
            const earned = data as number;
            setUserCoins(prev => prev + earned);
            if (!isPetItem) {
                const newSet = new Set(localOwnedItemIds);
                newSet.delete(item.id);
                setLocalOwnedItemIds(newSet);
                setUserInventoryGear(prev => prev.filter(i => i.item_id !== item.id));
            } else {
                setUserInventorySupplies(prev => {
                    const itemInInv = prev.find(i => i.pet_item_id === item.id);
                    if (itemInInv && itemInInv.quantity > 1) {
                        return prev.map(i => i.pet_item_id === item.id ? { ...i, quantity: i.quantity - 1 } : i);
                    } else {
                        return prev.filter(i => i.pet_item_id !== item.id);
                    }
                });
            }
            toast.success(`Sold ${item.name}`);
            router.refresh();
        }
    };

    const buyGear = shopItems.filter(item => !localOwnedItemIds.has(item.id));
    const sellGear = userInventoryGear.map(ui => ui.shop_items);

    const buyPetItems = petItems.filter((i: PetItemType) => {
        if (!userPetSpecies) return false;
        if (i.pet_species && i.pet_species.length > 0) {
            return i.pet_species.includes(userPetSpecies);
        }
        // Universal items (no species restriction) are shown for any pet
        return true;
    }).sort((a, b) => (a.item_tier || 1) - (b.item_tier || 1));

    const sellPetItems = userInventorySupplies.map(ui => ({
        ...ui.pet_items,
        quantity: ui.quantity
    }));

    return (
        <div className="w-full h-full flex flex-col pt-20 lg:pt-8 landscape:pt-8 pb-24 lg:pb-8 px-4 overflow-hidden">
            <div className="w-full max-w-5xl mx-auto flex flex-col h-full gap-4">
                <div className="titled-cards shrink-0 overflow-hidden py-2">
                    <div className="flex items-center justify-between px-1 sm:px-8 gap-1 sm:gap-4">
                        <div className="flex-1 flex justify-center min-w-0">
                            <Button
                                variant={mode === 'buy' ? "default" : "outline"}
                                onClick={() => setMode('buy')}
                                className={cn("w-full max-w-30 font-bold transition-all text-xs sm:text-sm h-9 sm:h-10 px-1 sm:px-4", mode === 'buy' ? "bg-primary text-primary-foreground shadow-md sm:scale-105" : "text-muted-foreground")}
                            >
                                Buy
                            </Button>
                        </div>
                        <div className="flex-none flex justify-center">
                            <div className="flex items-center gap-1 sm:gap-2 ">
                                <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-500" />
                                <span className="text-sm sm:text-lg font-bold tracking-tight">{userCoins}</span>
                            </div>
                        </div>
                        <div className="flex-1 flex justify-center min-w-0">
                            <Button
                                variant={mode === 'sell' ? "destructive" : "outline"}
                                onClick={() => setMode('sell')}
                                className={cn("w-full max-w-30 font-bold transition-all text-xs sm:text-sm h-9 sm:h-10 px-1 sm:px-4", mode === 'sell' ? "shadow-md sm:scale-105" : "text-muted-foreground hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 hover:border-red-200")}
                            >
                                Sell
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="titled-cards flex-1 flex flex-col overflow-hidden relative">
                    <Tabs defaultValue="gear" className="flex flex-col h-full relative">
                        <div className="titled-card-header absolute top-0 left-0 right-0 z-20 border-b border-white/10 flex items-center px-4 text-center py-2">
                            <TabsList className="grid w-full grid-cols-2 bg-transparent gap-2">
                                <TabsTrigger
                                    value="gear"
                                    className="text-base font-bold rounded-lg transition-all border border-black/10 dark:border-white/10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:border-white/20 data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                >
                                    Gear
                                </TabsTrigger>
                                <TabsTrigger
                                    value="companion"
                                    className="text-base font-bold rounded-lg transition-all border border-black/10 dark:border-white/10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:border-white/20 data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                >
                                    Supplies
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 pt-4 custom-scrollbar">
                            <TabsContent value="gear" className="mt-0 pb-10 outline-none">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {(mode === 'buy' ? buyGear : sellGear).map((item) => (
                                        <ShopItemCard
                                            key={item.id}
                                            item={item}
                                            userCoins={userCoins}
                                            owned={mode === 'sell'}
                                            isPetItem={false}
                                            mode={mode}
                                            onAction={(i) => mode === 'buy' ? handlePurchase(i, false) : handleSell(i, false)}
                                        />
                                    ))}
                                    {(mode === 'buy' ? buyGear : sellGear).length === 0 && (mode === 'buy' || mode === 'sell') && (
                                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                            <Coins className="w-16 h-16 mb-4" />
                                            <p className="text-lg font-medium">
                                                {mode === 'buy' ? "You own all available gear!" : "You have no gear to sell."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="companion" className="mt-0 pb-10 outline-none">
                                {mode === 'buy' && !userPetSpecies && buyPetItems.length === 0 ? (
                                    <div className="text-center py-20 text-muted-foreground">
                                        You need a companion to shop for these items!
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {(mode === 'buy' ? buyPetItems : sellPetItems).map((item) => (
                                            <ShopItemCard
                                                key={item.id}
                                                item={item}
                                                userCoins={userCoins}
                                                owned={false}
                                                isPetItem={true}
                                                mode={mode}
                                                quantity={'quantity' in item ? (item.quantity as number) : undefined}
                                                onAction={(i) => mode === 'buy' ? handlePurchase(i, true) : handleSell(i, true)}
                                            />
                                        ))}
                                        {mode === 'sell' && sellPetItems.length === 0 && (
                                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                                <Package className="w-16 h-16 mb-4" />
                                                <p className="text-lg font-medium">You have no supplies to sell.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
