"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useKokoroTTS } from '@/hooks/llm-chat/use-kokoro-tts';
import { KOKORO_CONFIG } from '@/config/tts';
import { useMobile } from '@/hooks/use-mobile';
import { Mic, MicOff, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useMicVAD } from '@ricky0123/vad-react';
import { OracleEye, OracleMode } from '@/components/ui/operational/oracle-eye';
import { useVoiceMode } from '@/app/services/chat-provider';
import { useAudioVisualizer } from '@/hooks/llm-chat/use-audio-visualizer';
import { useVoiceSoundEffects } from '@/hooks/llm-chat/use-voice-sound-effects';
import { useSpeechRecognition } from '@/hooks/llm-chat/use-speech-recognition';
import { useResponseQueue } from '@/hooks/llm-chat/use-response-queue';

export default function VoiceMode() {
  const {
    isOpen,
    isMinimized,
    minimizedPosition,
    setIsOpen,
    setIsMinimized,
    setMinimizedPosition,
    lastAssistantMessage,
    isStreaming,
    sendMessage,
    stop: stopOracle,
  } = useVoiceMode();

  const {
    status: ttsStatus,
    numericProgress,
    stop: stopTTS,
    playbackVolume,
    startStream,
    pushText,
    closeStream
  } = useKokoroTTS({ voice: KOKORO_CONFIG.oracleVoice });
  const isMobile = useMobile();
  const [sttStatus, setSttStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const isSpeaking = ttsStatus === 'speaking';

  useEffect(() => {
    if (isSpeaking) {
      setHasStartedPlayback(true);
      setIsThinking(false);
    }
  }, [isSpeaking, isThinking]);

  useEffect(() => {
    if ((sttStatus === 'processing' || ttsStatus === 'generating') && !hasStartedPlayback && !isSpeaking) {
      setIsThinking(true);
    }
  }, [sttStatus, ttsStatus, hasStartedPlayback, isSpeaking]);

  const userSpeakingRef = useRef(false);


  const { playCloseSound } = useVoiceSoundEffects({ isOpen, isThinking });


  const { clearQueue } = useResponseQueue({
    isOpen,
    lastAssistantMessage,
    isStreaming,
    ttsStatus,
    startStream,
    pushText,
    closeStream,
    stop: stopTTS,
    setHasStartedPlayback
  });


  const handleSpeechStart = useCallback(() => {
    userSpeakingRef.current = true;
    stopTTS();
    stopOracle();
    clearQueue();
  }, [stopTTS, stopOracle, clearQueue]);

  const handleSpeechEnd = useCallback((transcript: string) => {
    userSpeakingRef.current = false;
    setSttStatus('processing');
    sendMessage(transcript);
  }, [sendMessage]);


  const {
    startListening,
    stopListening,
    recognitionRef,
    startTimerRef
  } = useSpeechRecognition({
    isOpen,
    isMuted,
    isMobile,
    onSpeechEnd: handleSpeechEnd,
    setSttStatus
  });


  const handleVadSpeechEnd = useCallback((audio: Float32Array) => {
    userSpeakingRef.current = false;
    //Silence - Immediately stop recognition to finalize transcript and send.
    stopListening();
  }, [stopListening]);

  const isDraggingRef = useRef(false);


  const vadOptions = useMemo(() => ({
    startOnLoad: isOpen && !isMuted,
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleVadSpeechEnd,
    model: "v5" as const,
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    minSpeechMs: 100,
    redemptionMs: 300,
  }), [isOpen, isMuted, handleSpeechStart, handleVadSpeechEnd]);

  const vad = useMicVAD(vadOptions);

  useEffect(() => {
    if (isOpen && !isMuted) {
      vad.start();
    } else {
      vad.pause();
    }
  }, [isOpen, isMuted, vad]);

  const animationMode: OracleMode = useMemo(() => {
    if (isThinking) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  }, [isThinking, isSpeaking]);


  const toggleMute = useCallback(() => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (newMuteState) {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
      vad.pause();
      setSttStatus('idle');
    }
  }, [isMuted, vad, recognitionRef, startTimerRef]);

  const stopAll = useCallback(() => {
    setIsMuted(true);
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.abort();

    vad.pause();

    stopTTS();
    stopOracle();
    setSttStatus('idle');
    clearQueue();
  }, [stopTTS, stopOracle, vad, recognitionRef, startTimerRef, clearQueue]);


  useEffect(() => {
    if (isOpen) {
      setIsMuted(false);
    }
  }, [isOpen]);

  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (!isOpen && wasOpenRef.current) {
      stopAll();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, stopAll]);

  const prevTTSStatus = useRef(ttsStatus);
  useEffect(() => {
    if (prevTTSStatus.current === 'speaking' && ttsStatus === 'ready' && isOpen && !isMuted) {
      startListening();
    }
    prevTTSStatus.current = ttsStatus;
  }, [ttsStatus, isOpen, isMuted, startListening]);

  const handleClose = () => {
    stopAll();
    playCloseSound();
    setTimeout(() => {
      setIsOpen(false);
      setIsMinimized(false);
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {!isMinimized ? (
        <motion.div
          key="full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/96 flex flex-col items-center justify-center overflow-hidden touch-none"
        >
          <div className="flex-1 flex items-center justify-center w-full relative">
            <div className="pointer-events-none w-[min(80vw,400px)] aspect-square relative -translate-y-12 md:-translate-y-0 flex items-center justify-center">

              {/* Oracle Thinking/Speaking Glow */}
              <motion.div
                animate={
                  animationMode === 'thinking'
                    ? {
                      opacity: [0.2, 0.4, 0.2],
                      scale: [1.05, 1.2, 1.05],
                    }
                    : animationMode === 'speaking'
                      ? {
                        opacity: 0.2 + (playbackVolume * 0.6),
                        scale: 0.5 + (playbackVolume * 0.5),
                      }
                      : {
                        opacity: 0.15,
                        scale: 1.02,
                      }
                }
                transition={animationMode === 'thinking' ? {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : { duration: 0.05, ease: "easeOut" }}
                className="absolute w-[100%] h-[100%] rounded-full"
                style={{
                  background: `radial-gradient(circle, hsla(48, 94%, 79%, 0.52) 0%, hsla(40, 90%, 60%, 0.00) 45%)`,
                  filter: 'blur(25px)',
                  zIndex: 50
                }}
              />

              <OracleEye size="120%" className="opacity-100 relative z-10" mode={animationMode} />
            </div>
          </div>

          <AnimatePresence>
            {numericProgress > 0 && numericProgress < 100 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-32 flex flex-col items-center gap-2 z-50 w-64"
              >
                <div className="text-white/60 text-xs font-mono uppercase tracking-widest">Loading..</div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white/50 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${numericProgress}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-12 flex items-center gap-6 z-50">
            <Button
              variant="outline"
              size="icon"
              className="w-12 h-12 rounded-full bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="w-5 h-5" />
            </Button>

            {!isMuted ? (
              <Button
                variant="outline"
                size="icon"
                className="w-16 h-16 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                <Mic className="w-8 h-8" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="w-16 h-16 rounded-full bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30"
                onClick={toggleMute}
              >
                <MicOff className="w-8 h-8" />
              </Button>
            )}

            <Button
              variant="destructive"
              size="icon"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 border-none shadow-lg shadow-red-900/20"
              onClick={handleClose}
            >
              <X className="w-8 h-8" />
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="minimized"
          initial={false}
          animate={{ x: minimizedPosition.x, y: minimizedPosition.y }}
          drag
          dragConstraints={false}
          dragMomentum={false}
          onDragStart={() => { isDraggingRef.current = true; }}
          onDragEnd={(e, info) => {
            setMinimizedPosition({
              x: minimizedPosition.x + info.offset.x,
              y: minimizedPosition.y + info.offset.y
            });
            setTimeout(() => { isDraggingRef.current = false; }, 150);
          }}
          onTap={() => {
            if (!isDraggingRef.current) setIsMinimized(false);
          }}
          className="fixed bottom-8 right-8 w-[100px] h-[100px] z-50 cursor-grab active:cursor-grabbing touch-none flex items-center justify-center">
          <div className="pointer-events-none w-full h-full relative flex items-center justify-center">

            <motion.div
              animate={
                animationMode === 'thinking'
                  ? {
                    opacity: [0.2, 0.4, 0.2],
                    scale: [1.05, 1.2, 1.05],
                  }
                  : animationMode === 'speaking'
                    ? {
                      opacity: 0.2 + (playbackVolume * 0.6),
                      scale: 0.5 + (playbackVolume * 0.5),
                    }
                    : {
                      opacity: 0.15,
                      scale: 1.02,
                    }
              }
              transition={animationMode === 'thinking' ? {
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut"
              } : { duration: 0.05, ease: "easeOut" }}
              className="absolute w-[100%] h-[100%] rounded-full"
              style={{
                background: `radial-gradient(circle, hsla(40, 82%, 70%, 0.50) 0%, hsla(40, 90%, 60%, 0.00) 55%)`,
                filter: 'blur(25px)',
                zIndex: 50
              }}
            />
            <OracleEye size="150%" className="opacity-100 relative z-10" mode={animationMode} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
