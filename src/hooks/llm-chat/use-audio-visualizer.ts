import { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, MotionValue } from 'framer-motion';

interface UseAudioVisualizerProps {
  isOpen: boolean;
  isMuted: boolean;
  isMobile: boolean;
  userSpeakingRef: React.MutableRefObject<boolean>;
}

export interface AudioVisualizerReturn {
  bassMV: MotionValue<number>;
  trebleMV: MotionValue<number>;
  userGlowScale: MotionValue<number>;
  userGlowOpacity: MotionValue<number>;
  userFlashOpacity: MotionValue<number>;
  analysisStreamRef: React.MutableRefObject<MediaStream | null>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
}

export function useAudioVisualizer({
  isOpen,
  isMuted,
  isMobile,
  userSpeakingRef
}: UseAudioVisualizerProps): AudioVisualizerReturn {
  const bassMV = useMotionValue(0);
  const trebleMV = useMotionValue(0);

  const userGlowScale = useTransform(bassMV, [0, 1], [1, 1.4]);
  const userGlowOpacity = useTransform(bassMV, [0, 1], [0.1, 0.4]);
  const userFlashOpacity = useTransform(trebleMV, [0, 1], [0, 1]);

  const analysisStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const isMutedRef = useRef(isMuted);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (analysisStreamRef.current) {
        analysisStreamRef.current.getTracks().forEach(track => track.stop());
        analysisStreamRef.current = null;
      }
      bassMV.set(0);
      trebleMV.set(0);
    };

    if (!isOpen || isMuted) {
      cleanup();
      return;
    }

    if (isMobile) {
      const updateProcedural = () => {
        if (!userSpeakingRef.current) {
          bassMV.set(0);
          trebleMV.set(0);
        } else {
          const time = Date.now();
          const bassBase = 0.4 + Math.sin(time * 0.004) * 0.2;
          const bassJitter = Math.random() * 0.05;
          bassMV.set(Math.min(0.9, bassBase + bassJitter));

          const trebleBase = 0.2 + Math.sin(time * 0.008) * 0.2;
          const trebleJitter = Math.random() * 0.1;
          trebleMV.set(Math.min(0.8, trebleBase + trebleJitter));
        }
        animationFrameRef.current = requestAnimationFrame(updateProcedural);
      };
      updateProcedural();
      return cleanup;
    }

    const startAnalysis = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        analysisStreamRef.current = stream;


        if (!isOpenRef.current || isMutedRef.current) {
          cleanup();
          return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 32;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const update = () => {
          if (!analyser) return;

          if (!userSpeakingRef.current) {
            bassMV.set(0);
            trebleMV.set(0);
            animationFrameRef.current = requestAnimationFrame(update);
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          const bassSum = dataArray.slice(0, 4).reduce((a, b) => a + b, 0);
          const trebleSum = dataArray.slice(8, 16).reduce((a, b) => a + b, 0);

          bassMV.set(Math.tanh((bassSum / 4) / 140));
          trebleMV.set(Math.tanh((trebleSum / 8) / 120));

          animationFrameRef.current = requestAnimationFrame(update);
        };
        update();
      } catch (err) {
        console.error("Audio Analysis failed:", err);
        cleanup();
      }
    };

    startAnalysis();

    return cleanup;
  }, [isOpen, isMuted, isMobile, userSpeakingRef, bassMV, trebleMV]);

  return {
    bassMV,
    trebleMV,
    userGlowScale,
    userGlowOpacity,
    userFlashOpacity,
    analysisStreamRef,
    audioContextRef
  };
}
