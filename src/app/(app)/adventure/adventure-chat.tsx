"use client";

import { useState, FormEvent, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { TypingIndicator } from '@/components/typing-indicator';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Swords, Volume2, Loader2, DoorOpen, Square, Mic, AudioLines, Send, Coins, Key, Lock, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useGoPro } from '@/hooks/use-go-pro';
import { useKokoroTTS } from '@/hooks/llm-chat/use-kokoro-tts';
import { useResponseQueue } from '@/hooks/llm-chat/use-response-queue';
import { useSpeechRecognition } from '@/hooks/llm-chat/use-speech-recognition';
import { useMicVAD } from '@ricky0123/vad-react';
import { DungeonProvider, useDungeon } from '@/app/services/dungeon-provider';
import { KOKORO_CONFIG } from '@/config/tts';
import { Message } from '@/types/chat';

const DynamicMarkdown = dynamic(() => import('@/components/markdown-renderer'), { ssr: false });

interface Action {
  type: 'ROLL';
  stat: string;
  dc: number;
}

interface AdventureChatProps {
  initialMessages: Message[];
  userName?: string;
  initialActionPoints: number;
  initialDungeonKeys: number;
  isPro: boolean;
  hasHadTrial: boolean;
  initialDungeonActive: boolean;
  dungeonPending?: boolean;
}

interface AdventureResponse {
  message: string;
  error?: string;
  resumed?: boolean;
  status?: 'VICTORY' | 'DEFEAT' | 'PLAYING' | 'ENDED';
  action?: Action | null;
}

function AdventureChatInner({
  userName,
  isPro,
  hasHadTrial,
  dungeonPending,
  actionPoints,
  setActionPoints,
  dungeonKeys,
  setDungeonKeys,
  isDungeonActive,
  setIsDungeonActive,
  dungeonResult,
  setDungeonResult
}: {
  userName?: string;
  isPro: boolean;
  hasHadTrial: boolean;
  dungeonPending?: boolean;
  actionPoints: number;
  setActionPoints: React.Dispatch<React.SetStateAction<number>>;
  dungeonKeys: number;
  setDungeonKeys: React.Dispatch<React.SetStateAction<number>>;
  isDungeonActive: boolean;
  setIsDungeonActive: React.Dispatch<React.SetStateAction<boolean>>;
  dungeonResult: 'VICTORY' | 'DEFEAT' | null;
  setDungeonResult: React.Dispatch<React.SetStateAction<'VICTORY' | 'DEFEAT' | null>>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { handleGoPro } = useGoPro();

  const {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    isStreaming,
    sendMessage,
    input,
    setInput,
    stop,
    isOpen: isVoiceMode,
    setIsOpen: setIsVoiceMode,
    lastAssistantMessage,
    notifyVoiceActivity
  } = useDungeon();

  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isRetreating, setIsRetreating] = useState<boolean>(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [sttStatus, setSttStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);

  const [dungeonTitle, setDungeonTitle] = useState<string | null>(null);
  const tts = useKokoroTTS({ voice: KOKORO_CONFIG.dungeonVoice });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userSpeakingRef = useRef(false);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant') {
      if (lastAssistantMessageIdRef.current !== lastMsg.id) {
        lastAssistantMessageIdRef.current = lastMsg.id;
        tts.stop();
        setPlayingMessageId(null);
      }
    }
  }, [messages, tts]);

  const micVolume = useMotionValue(0);
  const micVolumeHeight = useTransform(micVolume, [0, 1], ['0%', '100%']);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  const isSpeaking = tts.status === 'speaking';

  useEffect(() => {
    if (isSpeaking) {
      setHasStartedPlayback(true);
    }
  }, [isSpeaking]);

  const clearQueueRef = useRef<() => void>(() => { });
  const handleSpeechStart = useCallback(() => {
    userSpeakingRef.current = true;
    tts.stop();
    stop();
    notifyVoiceActivity();
    clearQueueRef.current();
  }, [tts, stop, notifyVoiceActivity]);

  const handleSpeechEnd = useCallback((transcript: string) => {
    userSpeakingRef.current = false;
    setSttStatus('processing');
    sendMessage(transcript);
  }, [sendMessage]);

  const {
    startListening,
    stopListening,
  } = useSpeechRecognition({
    isOpen: isVoiceMode,
    isMuted,
    isMobile: false,
    onSpeechEnd: handleSpeechEnd,
    setSttStatus
  });

  const handleVadSpeechEnd = useCallback(() => {
    userSpeakingRef.current = false;
    stopListening();
  }, [stopListening]);

  const vadOptions = useMemo(() => ({
    startOnLoad: isVoiceMode && !isMuted,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    model: "v5" as const,
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    minSpeechMs: 100,
    redemptionMs: 300,
  }), [isVoiceMode, isMuted, handleSpeechStart, handleVadSpeechEnd]);

  const vad = useMicVAD(vadOptions);

  useEffect(() => {
    if (isVoiceMode && !isMuted) {
      vad.start();
    } else {
      vad.pause();
    }
  }, [isVoiceMode, isMuted, vad]);

  useEffect(() => {
    if (!isVoiceMode || isMuted) {
      micVolume.set(0);
      if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
      if (micContextRef.current) micContextRef.current.close();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      micContextRef.current = null;
      micStreamRef.current = null;
      return;
    }

    const startMicAnalysis = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const ctx = new AudioContext();
        micContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const update = () => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length;
          micVolume.set(Math.min(1, avg / 100));
          micAnimFrameRef.current = requestAnimationFrame(update);
        };
        update();
      } catch (err) {
        console.error('Mic analysis error:', err);
      }
    };

    startMicAnalysis();

    return () => {
      if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
      if (micContextRef.current) micContextRef.current.close();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [isVoiceMode, isMuted, micVolume]);

  const prevTTSStatus = useRef(tts.status);
  useEffect(() => {
    if (prevTTSStatus.current === 'speaking' && tts.status === 'ready' && isVoiceMode && !isMuted) {
      startListening();
    }
    prevTTSStatus.current = tts.status;
  }, [tts.status, isVoiceMode, isMuted, startListening]);

  const { clearQueue } = useResponseQueue({
    isOpen: isVoiceMode,
    lastAssistantMessage,
    isStreaming,
    ttsStatus: tts.status,
    startStream: tts.startStream,
    pushText: tts.pushText,
    closeStream: tts.closeStream,
    stop: tts.stop,
    setHasStartedPlayback
  });

  useEffect(() => {
    clearQueueRef.current = clearQueue;
  }, [clearQueue]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, isLoading, isDungeonActive, isStreaming]);

  const handleStopTTS = useCallback(() => {
    tts.stop();
    setPlayingMessageId(null);
  }, [tts]);

  const handlePlayTTS = useCallback(async (messageId: string, text: string) => {
    if (playingMessageId === messageId) {
      handleStopTTS();
      return;
    }
    handleStopTTS();
    setPlayingMessageId(messageId);
    tts.speak(text);
  }, [handleStopTTS, playingMessageId, tts]);

  useEffect(() => {
    if (tts.status === 'ready' || tts.status === 'idle') {
      setPlayingMessageId(null);
    }
  }, [tts.status]);

  const handleBuyKey = async () => {
    try {
      toast.loading("Preparing checkout...");
      const successUrl = `${window.location.origin}/adventure?success=true`;
      const cancelUrl = `${window.location.origin}/adventure?canceled=true`;
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { successUrl, cancelUrl, mode: 'payment', productType: 'dungeon_key' },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No URL returned");
    } catch (err) {
      toast.dismiss();
      console.error("Buy Key Error:", err);
      toast.error("Something went wrong. Try again.");
    }
  };

  const handleStartDungeon = async () => {
    if (actionPoints < 12) { toast.error("Not enough Action Points (12 Required)."); return; }
    if (dungeonKeys < 1) { toast.error("You need a Dungeon Key."); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/adventure', { method: 'POST', body: JSON.stringify({ action: 'start' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.resumed) {
        setActionPoints(p => p - 12);
        setDungeonKeys(k => k - 1);
      }
      setDungeonTitle(data.title || null);
      setIsDungeonActive(true);
      setMessages([{ id: Date.now().toString(), role: 'assistant', content: data.message }]);
    } catch (e: unknown) {
      const error = e as Error;
      toast.error("Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    tts.stop();
    clearQueueRef.current();
    stop(); // Ensure any active voice/TTS is stopped
    await sendMessage(input);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    tts.stop();
    clearQueueRef.current();
    stop();
  };

  const handleRoll = async () => {
    const result = Math.floor(Math.random() * 20) + 1;
    setRollResult(result);
    setTimeout(() => {
      sendMessage(`Rolled a ${result}`);
      setRollResult(null);
    }, 1500);
  };

  const handleRetreat = async () => {
    setIsRetreating(true);
    try {
      await fetch('/api/adventure', { method: 'POST', body: JSON.stringify({ action: 'retreat' }) });
      router.refresh();
      setIsDungeonActive(false);
      setDungeonResult(null);
      setMessages([]);
      toast.error("Coward!");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setIsRetreating(false);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const pendingAction = !isLoading && !isStreaming && lastMessage?.role === 'assistant' && lastMessage?.action ? lastMessage.action : null;

  if ((isLoading && !isDungeonActive) || dungeonPending) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
        <h2 className="text-2xl font-bold tracking-tight animate-pulse">Forging World...</h2>
        <p className="text-muted-foreground mt-2">The Dungeon Master is preparing your adventure.</p>
      </div>
    );
  }

  if (!isDungeonActive) {

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-full inline-block">
            <Swords className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Dungeon Gate</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            A new adventure awaits.
          </p>
        </div>
        <div className="titled-cards border p-6 rounded-xl w-full max-sm shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4 text-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Entry Cost</span>
              <div className="space-y-2 flex flex-col items-center">
                <div className="flex items-center gap-2 text-lg font-bold">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  <span>12 AP</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <Key className="w-5 h-5 text-amber-500" />
                  <span>1 Key</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 border-l pl-4 text-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Your Balance</span>
              <div className="space-y-2 flex flex-col items-center">
                <div className={`flex items-center gap-2 text-lg font-bold ${actionPoints < 12 ? "text-destructive" : "text-green-500"}`}>
                  <Coins className={`w-5 h-5 ${actionPoints < 12 ? "text-destructive/50" : "text-green-500/50"}`} />
                  <span>{actionPoints} AP</span>
                </div>
                <div className={`flex items-center gap-2 text-lg font-bold ${dungeonKeys < 1 ? "text-destructive" : "text-green-500"}`}>
                  <Key className={`w-5 h-5 ${dungeonKeys < 1 ? "text-destructive/50" : "text-green-500/50"}`} />
                  <span>{dungeonKeys} {dungeonKeys === 1 ? 'Key' : 'Keys'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full text-lg py-6"
              onClick={handleStartDungeon}
              disabled={isLoading || actionPoints < 12 || dungeonKeys < 1}
            >
              {isLoading ? "Forging World..." : "Enter Dungeon"}
            </Button>
            {dungeonKeys < 1 && (
              <Button variant="outline" onClick={handleBuyKey} className="w-full">
                Buy Dungeon Key
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleLeaveDungeon = () => {
    setIsDungeonActive(false);
    setDungeonResult(null);
    setMessages([]);
    router.refresh();
  };

  // Active Dungeon UI
  return (
    <div className="absolute inset-0 flex flex-col">
      {isRetreating && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background">
          <Loader2 className="w-12 h-12 text-destructive animate-spin mb-4" />
        </div>
      )}

      <div className="sticky top-0 left-0 right-0 z-20 text-center">
        <div className="max-w-4xl mx-auto w-full border-b py-2 px-4 flex items-center justify-between" style={{ borderBottomColor: 'var(--card-border-bottom)' }}>
          <span className="font-mono text-muted-foreground opacity-70 text-xs">{dungeonTitle || "Exploring the dungeon"}</span>
          {!dungeonResult && (
            <Button variant="destructive" size="sm" onClick={handleRetreat} disabled={isRetreating} className="h-7 text-xs px-3">
              ABANDON
            </Button>
          )}
        </div>
      </div>

      <div className={`flex-grow w-full overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
        <div className="max-w-4xl mx-auto space-y-4 w-full">
          {messages.map((m: any, idx: number) => (
            <div key={m.id || idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-md ${m.role === 'user' ? 'chat-bubble-card-user' : 'chat-bubble-card'}`}>
                <p className="font-semibold text-xs mb-1 opacity-70 uppercase">{m.role === 'user' ? userName : 'DM'}</p>
                <div className="prose dark:prose-invert whitespace-pre-wrap [&_p]:text-[15px] [&_p]:leading-relaxed"><DynamicMarkdown>{m.content}</DynamicMarkdown></div>
                {m.role === 'assistant' && (
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50" onClick={() => handlePlayTTS(m.id, m.content)}>
                      {playingMessageId === m.id ? <Square className="h-4 w-4 fill-current" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                {m.role === 'assistant' && m.action && m.action.stat && (
                  <div className="mt-3 p-2 bg-black/10 dark:bg-white/10 rounded text-sm font-mono border border-border/50">
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">CHECK:</span> {m.action.stat} (DC {m.action.dc})
                  </div>
                )}
              </div>
            </div>
          ))}
          {(isLoading || isStreaming) && <TypingIndicator />}

          <AnimatePresence>
            {pendingAction && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex justify-start w-full">
                <div className="titled-cards border p-4 rounded-lg shadow-lg max-w-md w-full text-center">
                  <h3 className="text-lg font-bold"><span className="text-primary">{pendingAction.stat} Check</span></h3>
                  <div className="text-sm text-muted-foreground mb-4">DC: <span className="font-bold">{pendingAction.dc}</span></div>
                  {rollResult ? (
                    <div className="text-4xl font-black">{rollResult}</div>
                  ) : (
                    <Button size="lg" onClick={handleRoll} className="w-full">ROLL D20</Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {dungeonResult ? (
        <div className="p-4 flex flex-col items-center gap-4 animate-in slide-in-from-bottom-5 w-full max-w-4xl mx-auto">
          <div className={`text-xl font-bold ${dungeonResult === 'VICTORY' ? 'text-green-500' : 'text-red-500'}`}>
            {dungeonResult === 'VICTORY' ? "VICTORY!" : "DEFEAT"}
          </div>
          <Button size="lg" onClick={handleLeaveDungeon} className="w-full max-w-sm gap-2"><DoorOpen className="w-5 h-5" /> Leave</Button>
        </div>
      ) : (
        <div className="w-full p-4 z-20">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <div className="relative flex-grow">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isVoiceMode ? "Listening..." : "What do you do?"}
                disabled={isLoading || isStreaming || !!pendingAction || isVoiceMode}
                className="h-12 shadow-sm bg-card"
              />

              {isVoiceMode && (
                <div className="absolute inset-0 z-10 flex items-end justify-center rounded-md border border-primary/50 overflow-hidden pointer-events-none bg-background">
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 bg-primary/30"
                    style={{ height: micVolumeHeight }}
                  />
                  <div className="flex items-center gap-2 text-primary font-bold z-10 mb-3">
                    <Mic className="w-5 h-5" />
                    <span className="animate-pulse">Listening...</span>
                  </div>
                </div>
              )}
            </div>

            {isPro && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                className="h-12 w-12 shrink-0 rounded-full text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
              >
                {isVoiceMode ? (
                  <X className="w-5 h-5" />
                ) : (
                  <AudioLines className="w-5 h-5" />
                )}
              </Button>
            )}

            {(isLoading || isStreaming) ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleStop}
                className="h-12 w-16 rounded-full border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                <Square className="h-4 w-4 text-red-500 fill-current" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading || isStreaming || !!pendingAction} className="h-12 w-16 rounded-full">
                <Send className="w-5 h-5" />
              </Button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export default function AdventureChat(props: AdventureChatProps) {
  const [actionPoints, setActionPoints] = useState(props.initialActionPoints);
  const [dungeonKeys, setDungeonKeys] = useState(props.initialDungeonKeys);
  const [isDungeonActive, setIsDungeonActive] = useState(props.initialDungeonActive);
  const [dungeonResult, setDungeonResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);

  useEffect(() => {
    setActionPoints(props.initialActionPoints);
    setDungeonKeys(props.initialDungeonKeys);
    setIsDungeonActive(props.initialDungeonActive);
  }, [props.initialActionPoints, props.initialDungeonKeys, props.initialDungeonActive]);

  const handleDungeonUpdate = (data: AdventureResponse) => {
    if (data.status === 'VICTORY' || data.status === 'DEFEAT') {
      setDungeonResult(data.status);
      if (data.status === 'VICTORY') toast.success("Victory!");
      else toast.error("Defeat!");
    }
  };

  return (
    <DungeonProvider
      initialMessages={props.initialMessages}
      onDungeonUpdate={handleDungeonUpdate}
    >
      <AdventureChatInner
        {...props}
        actionPoints={actionPoints}
        setActionPoints={setActionPoints}
        dungeonKeys={dungeonKeys}
        setDungeonKeys={setDungeonKeys}
        isDungeonActive={isDungeonActive}
        setIsDungeonActive={setIsDungeonActive}
        dungeonResult={dungeonResult}
        setDungeonResult={setDungeonResult}
      />
    </DungeonProvider>
  );
}