"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Lock, Skull, MapPin, X, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan, Quest, Task } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import BossFeedbackCard from "@/components/quiz/boss-feedback-card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface ChapterData {
    module_number: number;
    theme: string;
    objectives?: string;
    story?: string;
}

interface BossData {
    module_number: number;
}

interface SelectedBoss {
    id: string;
    explanation: string;
}

interface MapNode {
    id: string;
    type: "chapter" | "boss";
    x: number;
    y: number;
    status: "locked" | "active" | "completed";
    data: ChapterData | BossData;
    icon: string;
}



interface ProceduralMapProps {
    plan: Plan;
    completedModules: number[];
    activeModuleNumber: number;
}

const CHAPTER_ICONS = [
    "castle.png", "castleTall.png", "church.png", "house.png",
    "houseTall.png", "houseViking.png", "mill.png", "mine.png",
    "pyramid.png", "ruins.png", "stable.png", "tent.png",
    "tower.png", "towerWatch.png", "waterWheel.png"
];

const BOSS_ICONS = ["skull.png", "graveyard.png", "watchtower.png"];




function createRandom(seed: number) {
    let s = seed;
    return function () {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };
}


function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const l2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
}

export default function ProceduralMap({ plan, completedModules, activeModuleNumber }: ProceduralMapProps) {


    const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
    const [selectedBossExplanation, setSelectedBossExplanation] = useState<SelectedBoss | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const hasMoved = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });


    const baseLayout = useMemo(() => {
        if (!plan) return { nodes: [], width: 0, height: 0 };

        const random = createRandom(plan.id);
        const newNodes: Omit<MapNode, 'status'>[] = [];
        let currentX = 0;
        let currentY = 0;


        const stepMin = 180;
        const stepMax = 280;
        const angleVariance = 60; // +/- degrees

        const modules = (plan.plan_details as { modules: ChapterData[] })?.modules || [];
        const sortedModules = [...modules].sort((a: ChapterData, b: ChapterData) => a.module_number - b.module_number);

        sortedModules.forEach((module: ChapterData) => {

            const seed = module.module_number * 17;
            const iconIndex = seed % CHAPTER_ICONS.length;

            newNodes.push({
                id: `chapter-${module.module_number}`,
                type: "chapter",
                x: currentX,
                y: currentY,
                data: module,
                icon: CHAPTER_ICONS[iconIndex]
            });


            let angle = (random() * (angleVariance * 2) - angleVariance) * (Math.PI / 180);
            let distance = stepMin + random() * (stepMax - stepMin);

            const nextX = currentX + Math.cos(angle) * distance;
            const nextY = currentY + Math.sin(angle) * distance;

            currentX = nextX;
            currentY = nextY;


            const bossSeed = (module.module_number + 99) * 13;
            const bossIconIndex = bossSeed % BOSS_ICONS.length;

            newNodes.push({
                id: `boss-${module.module_number}`,
                type: "boss",
                x: currentX,
                y: currentY,
                data: { module_number: module.module_number },
                icon: BOSS_ICONS[bossIconIndex]
            });


            angle = (random() * (angleVariance * 2) - angleVariance) * (Math.PI / 180);
            distance = stepMin + random() * (stepMax - stepMin);

            const nextX2 = currentX + Math.cos(angle) * distance;
            const nextY2 = currentY + Math.sin(angle) * distance;

            currentX = nextX2;
            currentY = nextY2;
        });


        const allX = [...newNodes.map(n => n.x)];
        const allY = [...newNodes.map(n => n.y)];

        const minX = Math.min(...allX);
        const minY = Math.min(...allY);
        const maxX = Math.max(...allX);
        const maxY = Math.max(...allY);

        const padding = 300;
        const offsetX = Math.abs(minX) + padding;
        const offsetY = Math.abs(minY) + padding;

        const normalizedNodes = newNodes.map(n => ({
            ...n,
            x: n.x + offsetX,
            y: n.y + offsetY
        }));

        return {
            nodes: normalizedNodes,
            width: (maxX - minX) + (padding * 2),
            height: (maxY - minY) + (padding * 2)
        };

    }, [plan.id, plan.plan_details]);

    const mapSize = { width: baseLayout.width, height: baseLayout.height };


    const nodes = useMemo(() => {
        return baseLayout.nodes.map(node => {
            let status: "locked" | "active" | "completed" = "locked";
            const modNum = node.data.module_number;
            const isCompleted = completedModules.includes(modNum);

            if (node.type === 'chapter') {
                const isActive = modNum === activeModuleNumber;
                status = isCompleted ? "completed" : isActive ? "active" : "locked";
            } else {
                status = isCompleted ? "completed" : "locked";
            }
            return { ...node, status } as MapNode;
        });
    }, [baseLayout, completedModules, activeModuleNumber]);
    const [isOverlayExpanded, setIsOverlayExpanded] = useState(false);
    const [isProgressOpen, setIsProgressOpen] = useState(false);


    const [viewRect, setViewRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

    const updateViewRect = useCallback(() => {
        if (containerRef.current) {

            const { scrollLeft, scrollTop, clientWidth, clientHeight } = containerRef.current;

            setViewRect(prev => {

                if (Math.abs(prev.x - scrollLeft) < 50 && Math.abs(prev.y - scrollTop) < 50 && prev.width === clientWidth && prev.height === clientHeight) {
                    return prev;
                }
                return {
                    x: scrollLeft,
                    y: scrollTop,
                    width: clientWidth,
                    height: clientHeight
                };
            });
        }
    }, []);


    useEffect(() => {

        const timer = setTimeout(updateViewRect, 100);
        window.addEventListener('resize', updateViewRect);
        return () => {
            window.removeEventListener('resize', updateViewRect);
            clearTimeout(timer);
        };
    }, [updateViewRect]);

    const BUFFER = 250;


    const effectiveViewRect = useMemo(() => {
        if (viewRect.width > 0) return viewRect;

        const activeNode = nodes.find(n => n.status === 'active') || nodes[0];
        if (!activeNode) return { x: 0, y: 0, width: 0, height: 0 };


        const estWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const estHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

        return {
            x: activeNode.x - (estWidth / 2),
            y: activeNode.y - (estHeight / 2),
            width: estWidth,
            height: estHeight
        };
    }, [viewRect, nodes]);

    const visibleNodes = useMemo(() => {
        return nodes.filter(node =>
            node.x >= effectiveViewRect.x - BUFFER &&
            node.x <= effectiveViewRect.x + effectiveViewRect.width + BUFFER &&
            node.y >= effectiveViewRect.y - BUFFER &&
            node.y <= effectiveViewRect.y + effectiveViewRect.height + BUFFER
        );
    }, [nodes, effectiveViewRect]);






    useEffect(() => {
        if (nodes.length > 0 && containerRef.current) {
            const activeNode = nodes.find(n => n.status === 'active') || nodes[0];
            if (activeNode) {
                const containerWidth = containerRef.current.clientWidth;
                const containerHeight = containerRef.current.clientHeight;

                if (containerWidth === 0 || containerHeight === 0) return;


                const scrollX = activeNode.x - (containerWidth / 2);
                const scrollY = activeNode.y - (containerHeight / 2);


                containerRef.current.scrollTo({
                    left: scrollX,
                    top: scrollY,
                    behavior: 'instant'
                });


                const finalX = containerRef.current.scrollLeft;
                const finalY = containerRef.current.scrollTop;

                setViewRect({
                    x: finalX,
                    y: finalY,
                    width: containerWidth,
                    height: containerHeight
                });
            }
        }
    }, [nodes]);


    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        hasMoved.current = false;
        if (containerRef.current) {
            setStartPos({ x: e.pageX, y: e.pageY });
            setScrollPos({
                x: containerRef.current.scrollLeft,
                y: containerRef.current.scrollTop
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !containerRef.current) return;
        e.preventDefault();
        const dx = e.pageX - startPos.x;
        const dy = e.pageY - startPos.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved.current = true;
        }

        containerRef.current.scrollLeft = scrollPos.x - dx;
        containerRef.current.scrollTop = scrollPos.y - dy;
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (containerRef.current) {
            const touch = e.touches[0];
            setIsDragging(true);
            hasMoved.current = false;
            setStartPos({ x: touch.pageX, y: touch.pageY });
            setScrollPos({
                x: containerRef.current.scrollLeft,
                y: containerRef.current.scrollTop,
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || !containerRef.current) return;
        const touch = e.touches[0];
        const dx = touch.pageX - startPos.x;
        const dy = touch.pageY - startPos.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved.current = true;
        }

        containerRef.current.scrollLeft = scrollPos.x - dx;
        containerRef.current.scrollTop = scrollPos.y - dy;
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };


    const visiblePath = useMemo(() => {
        if (nodes.length < 2) return "";
        let path = "";
        let isPenDown = false;
        let lastPoint = null;

        for (let i = 0; i < nodes.length - 1; i++) {
            const p1 = nodes[i];
            const p2 = nodes[i + 1];


            const midX = (p1.x + p2.x) / 2;

            const minX = Math.min(p1.x, p2.x, midX);
            const maxX = Math.max(p1.x, p2.x, midX);
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);


            if (maxX >= effectiveViewRect.x && minX <= effectiveViewRect.x + effectiveViewRect.width &&
                maxY >= effectiveViewRect.y && minY <= effectiveViewRect.y + effectiveViewRect.height) {

                if (!isPenDown || lastPoint !== p1) {
                    path += `M ${p1.x} ${p1.y} `;
                }
                path += `C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y} `;
                isPenDown = true;
                lastPoint = p2;
            } else {
                isPenDown = false;
            }
        }
        return path;
    }, [nodes, effectiveViewRect]);


    const visibleBg = useMemo(() => {
        const x = Math.max(0, effectiveViewRect.x - BUFFER);
        const y = Math.max(0, effectiveViewRect.y - BUFFER);
        const endX = Math.min(mapSize.width, effectiveViewRect.x + effectiveViewRect.width + BUFFER);
        const endY = Math.min(mapSize.height, effectiveViewRect.y + effectiveViewRect.height + BUFFER);

        return {
            x,
            y,
            width: Math.max(0, endX - x),
            height: Math.max(0, endY - y)
        };
    }, [effectiveViewRect, mapSize]);

    return (
        <div className="relative w-full h-full overflow-hidden bg-background">

            <div id="map-journey-overlay" className="absolute top-20 left-4 z-30 pointer-events-none">
                <motion.div
                    layout
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setIsOverlayExpanded(!isOverlayExpanded);
                    }}
                    className="bg-background p-2 rounded-2xl border shadow-xl pointer-events-auto border-amber-900/20 cursor-pointer overflow-hidden min-w-[48px] min-h-[48px]"
                    initial={false}
                    animate={{ width: isOverlayExpanded ? 300 : 48 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {!isOverlayExpanded ? (
                        <div className="flex items-center justify-center w-8 h-8">
                            <MapPin className="text-amber-700 dark:text-amber-500 w-6 h-6" />
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-2 space-y-2"
                        >
                            <div className="flex justify-between items-center">
                                <h2 className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-500">Journey</h2>
                                <MapPin className="text-amber-700/50 dark:text-amber-500/50 w-3 h-3" />
                            </div>
                            <h1 className="text-base font-bold leading-tight">
                                {plan.goal_text.replace("The Main Quest: ", "").replace("Main Path: ", "")}
                            </h1>
                            {plan.plot && (
                                <p className="text-sm text-muted-foreground italic leading-relaxed border-t pt-3 border-amber-900/10">
                                    {plan.plot}
                                </p>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            </div>


            <div id="map-progress-button" className="absolute top-20 right-4 z-30 pointer-events-none">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsProgressOpen(true)}
                    className="bg-background px-4 py-2 rounded-full border shadow-lg pointer-events-auto border-amber-900/20 flex items-center gap-2"
                >
                    <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-tighter text-foreground">
                        Progress: {completedModules.length} / {plan.total_estimated_modules}
                    </span>
                </motion.button>
            </div>


            <AnimatePresence>
                {isProgressOpen && (
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="absolute top-16 bottom-20 lg:bottom-0 right-0 z-40 w-full sm:w-96 bg-background border-l shadow-2xl flex flex-col pointer-events-auto"
                    >

                        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-background border-b border-amber-900/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-lg">
                                    <Trophy className="w-5 h-5 text-amber-600" />
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tight">Completed Chapters</h2>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsProgressOpen(false)}
                                className="rounded-full hover:bg-amber-500/10"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>


                        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
                            {completedModules.length === 0 ? (
                                <div className="text-center py-12 space-y-4">
                                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                                    <p className="text-muted-foreground font-medium">No chapters completed yet. Start your journey!</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {[...completedModules].sort((a, b) => b - a).map((moduleNum) => {
                                        const moduleQuests = (plan.quests || []).filter(q => q.module_number === moduleNum);
                                        return (
                                            <div key={moduleNum} className="space-y-3">
                                                <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-500 flex items-center gap-2">
                                                    <Check className="w-4 h-4" /> Chapter {moduleNum}
                                                </h3>
                                                <div className="border rounded-xl bg-card/50 overflow-hidden">
                                                    <Accordion type="single" collapsible className="w-full">
                                                        {moduleQuests.sort((a, b) => a.day_number - b.day_number).map((quest) => (
                                                            <AccordionItem key={quest.id} value={`item-${quest.id}`} className="border-b last:border-0 border-amber-900/5">
                                                                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                                                                    <span className="text-sm font-bold text-left text-foreground">Quest {quest.day_number}: {quest.title}</span>
                                                                </AccordionTrigger>
                                                                <AccordionContent className="px-4 pb-4">
                                                                    <div className="space-y-3 text-foreground">
                                                                        {quest.story && <p className="text-xs text-muted-foreground italic">"{quest.story}"</p>}
                                                                        <ul className="space-y-2">
                                                                            {quest.tasks.map((task) => (
                                                                                <li key={task.id} className="flex items-start gap-2 text-xs">
                                                                                    <Check className="w-3 h-3 text-orange-500 shrink-0 mt-0.5" />
                                                                                    <span className="line-through opacity-70 font-medium">{task.title}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        ))}
                                                    </Accordion>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


            <div
                ref={containerRef}
                className="w-full h-full bg-[#e8dcb9] dark:bg-[#1a1a1a] overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner touch-none"
                onScroll={updateViewRect} 
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseUp}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => {
                    if (!hasMoved.current) {
                        if (isOverlayExpanded) setIsOverlayExpanded(false);
                        if (isProgressOpen) setIsProgressOpen(false);
                    }
                }}
            >
                <div
                    ref={contentRef}
                    className="relative"
                    style={{ width: mapSize.width, height: mapSize.height }}
                >

                    <div
                        className="absolute bg-[url('/assets/textures/map_texture.png')] bg-repeat opacity-80 mix-blend-multiply dark:mix-blend-overlay pointer-events-none"
                        style={{
                            left: visibleBg.x,
                            top: visibleBg.y,
                            width: visibleBg.width,
                            height: visibleBg.height,
                            backgroundPosition: `${-visibleBg.x}px ${-visibleBg.y}px`,
                            backgroundSize: '512px 512px'
                        }}
                    />


                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-10">

                        <path
                            d={visiblePath}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="14"
                            strokeLinecap="round"
                            className="text-[#3f2e22] dark:text-[#a1a1aa] opacity-40 dark:opacity-60"
                        />


                        <path
                            d={visiblePath}
                            fill="none"
                            stroke="#e8dcb9"
                            strokeWidth="10"
                            strokeLinecap="round"
                            className="dark:stroke-[#1a1a1a]"
                        />


                        <path
                            d={visiblePath}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray="8 6"
                            strokeLinecap="round"
                            className="text-amber-900/60 dark:text-amber-700/80 drop-shadow-sm"
                        />
                    </svg>





                    {visibleNodes.map((node) => (
                        <div
                            key={node.id}
                            id={node.status === 'active' ? 'map-active-node' : undefined}
                            className="absolute flex flex-col items-center justify-center group z-20"
                            style={{
                                left: node.x,
                                top: node.y,
                                transform: 'translate(-50%, -50%)'
                            }}
                            onClick={async (e) => {
                                if (!isDragging) {
                                    if (node.type === 'boss' && node.status === 'completed') {
                                        const supabase = createClient();
                                        const { data } = await supabase
                                            .from('boss_fights')
                                            .select('explanation')
                                            .eq('plan_id', plan.id)
                                            .eq('module_number', (node.data as BossData).module_number)
                                            .single();

                                        if (data?.explanation) {
                                            setSelectedBossExplanation({
                                                id: node.id,
                                                explanation: data.explanation
                                            });
                                            return;
                                        }
                                    }
                                    setSelectedNode(node);
                                }
                            }}
                        >
                            <div className="flex flex-col items-center transition-transform duration-300 scale-100 hover:scale-110">

                                <div className={`relative p-3 rounded-full transition-all duration-300 ${node.status === 'locked'
                                    ? 'bg-[#f4e4bc] dark:bg-zinc-800'
                                    : node.status === 'active'
                                        ? 'bg-[#5c3d2e] border-2 border-none shadow-2xl'
                                        : 'bg-[#f4e4bc] dark:bg-zinc-800 shadow-md hover:shadow-xl hover:scale-105'
                                    }`}>
                                    <div className="relative w-16 h-16">
                                        <Image
                                            src={`/assets/3d-models/kenney_cartography-pack/PNG/Retina/${node.icon}`}
                                            alt={node.type}
                                            fill
                                            className={`object-contain transition-all duration-300 ${node.status === 'active'
                                                ? 'brightness-0 invert opacity-90'
                                                : 'grayscale sepia brightness-[0.7] contrast-[1.2] hue-rotate-[-10deg] dark:sepia-0 dark:hue-rotate-0 dark:contrast-100 dark:brightness-0 dark:invert dark:opacity-80'
                                                }`}
                                            sizes="64px"
                                        />
                                    </div>

    
                                    {node.status === 'completed' && (
                                        <div className="absolute -top-1 -right-1 bg-[#4F6B43] rounded-full p-1 text-white shadow-lg ring-2 ring-[#e8dcb9] dark:ring-zinc-900 z-10">
                                            <Check size={14} strokeWidth={4} />
                                        </div>
                                    )}
                                    {node.status === 'locked' && (
                                        <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1 text-white shadow-lg ring-2 ring-[#e8dcb9] dark:ring-zinc-900 z-10">
                                            <Lock size={14} />
                                        </div>
                                    )}
                                    {node.status === 'active' && (
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-bounce z-10 filter drop-shadow-md">
                                            <MapPin size={38} fill="#4F6B43" strokeWidth={0} />
                                        </div>
                                    )}
                                </div>


                                <div className={`mt-1 px-3 py-1.5 rounded-full text-[11px] font-serif font-bold whitespace-nowrap shadow-md border-2 transition-colors ${node.status === 'active'
                                    ? 'bg-primary text-primary-foreground border-transparent'
                                    : 'bg-[#f4e4bc] dark:bg-zinc-800 text-amber-950 dark:text-amber-100 border-amber-900/20 dark:border-zinc-600'
                                    }`}>
                                    {node.type === 'chapter' ? `Chapter ${(node.data as ChapterData).module_number}` : `Boss Fight`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedBossExplanation && (
                <BossFeedbackCard
                    explanation={selectedBossExplanation.explanation}
                    onClose={() => setSelectedBossExplanation(null)}
                />
            )}


            <Dialog open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
                <DialogContent className="sm:max-w-md border-amber-900/20">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
                            {selectedNode?.type === 'chapter' ? (
                                <>
                                    <span className="text-3xl">📜</span>
                                    <span>Chapter {(selectedNode.data as ChapterData).module_number}</span>
                                </>
                            ) : (
                                <>
                                    <Skull className="text-red-500 w-8 h-8" />
                                    <span>Boss Challenge</span>
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="pt-4" asChild>
                            <div>
                                {selectedNode?.type === 'chapter' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-base text-foreground leading-relaxed italic">
                                                {(() => {
                                                    const data = selectedNode.data as ChapterData;
                                                    const moduleNum = data.module_number;


                                                    const questWithStory = (plan.quests || [])
                                                        .filter(q => q.module_number === moduleNum)
                                                        .sort((a, b) => a.day_number - b.day_number)
                                                        .find(q => q.story);

                                                    if (questWithStory?.story) {
                                                        return (
                                                            <div className="space-y-2">
                                                                <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">Current Quest</span>
                                                                <p className="text-base text-foreground leading-relaxed italic">
                                                                    "{questWithStory.story}"
                                                                </p>
                                                            </div>
                                                        );
                                                    }


                                                    return (
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">Objective</span>
                                                            <p className="text-base text-foreground leading-relaxed">
                                                                {data.objectives}
                                                            </p>
                                                        </div>
                                                    );
                                                })()}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-amber-900/10">
                                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter",
                                                selectedNode.status === 'completed' ? "bg-green-500/20 text-green-600" :
                                                    selectedNode.status === 'active' ? "bg-amber-500/20 text-amber-600 animate-pulse" :
                                                        "bg-muted text-muted-foreground"
                                            )}>
                                                {selectedNode.status}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 text-center py-4">
                                        <p className="text-lg font-medium text-foreground italic">
                                            "A powerful guardian blocks the path to the next chapter. You must prove your mastery to proceed."
                                        </p>
                                        <div className="flex items-center justify-center gap-2 pt-4">
                                            <span className={cn(
                                                "px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest",
                                                selectedNode?.status === 'completed' ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"
                                            )}>
                                                {selectedNode?.status === 'completed' ? 'Defeated' : 'Waiting...'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    );
}