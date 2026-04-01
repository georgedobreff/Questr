import { useEffect, useRef } from 'react';

interface UseVoiceSoundEffectsProps {
  isOpen: boolean;
  isThinking: boolean;
}

export function useVoiceSoundEffects({ isOpen, isThinking }: UseVoiceSoundEffectsProps) {
  const thinkingAudioRef = useRef<HTMLAudioElement | null>(null);
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isThinkingRef = useRef(isThinking);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    if (isOpen) {
      const openedAudio = new Audio('/audio/voice_opened.ogg');
      openedAudio.play()?.catch(err => console.error("Failed to play opened sound:", err));

      const thinkingAudio = new Audio('/audio/thinking.ogg');
      thinkingAudio.playbackRate = 0.35; 
      thinkingAudio.volume = 0.4; 
      thinkingAudioRef.current = thinkingAudio;

      return () => {
        if (thinkingAudioRef.current) {
          thinkingAudioRef.current.pause();
          thinkingAudioRef.current = null;
        }
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const audio = thinkingAudioRef.current;
    if (!audio || !isOpen) return;

    const playWithDelay = () => {
      thinkingTimeoutRef.current = setTimeout(() => {
        if (isOpen && isThinkingRef.current) {
          audio.play()?.catch(() => {});
        }
      }, 1500);
    };

    const onEnded = () => playWithDelay();

    if (isThinking) {
      audio.addEventListener('ended', onEnded);
      audio.play()?.catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener('ended', onEnded);
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    }

    return () => {
      audio.removeEventListener('ended', onEnded);
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, [isThinking, isOpen]);

  const playCloseSound = () => {
    const closedAudio = new Audio('/audio/voice_closed.ogg');
    closedAudio.play()?.catch(err => console.error("Failed to play closed sound:", err));
  };

  return {
    playCloseSound
  };
}
