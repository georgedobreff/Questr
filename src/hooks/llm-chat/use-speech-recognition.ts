import { useEffect, useRef, useCallback } from 'react';

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface UseSpeechRecognitionProps {
  isOpen: boolean;
  isMuted: boolean;
  isMobile: boolean;
  onSpeechEnd: (transcript: string) => void;
  onError?: (error: string) => void;
  setSttStatus: (status: 'idle' | 'listening' | 'processing') => void;
}

export function useSpeechRecognition({
  isOpen,
  isMuted,
  isMobile,
  onSpeechEnd,
  onError,
  setSttStatus
}: UseSpeechRecognitionProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedIndexRef = useRef(-1);


  const isMutedRef = useRef(isMuted);
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const startListening = useCallback(() => {
    if (isMutedRef.current) return;
    if (startTimerRef.current) clearTimeout(startTimerRef.current);

    startTimerRef.current = setTimeout(() => {
      if (isMutedRef.current) return;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Failed to start recognition:", e);
        }
      }
    }, 10);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== 'undefined') {
      const windowWithSR = window as WindowWithSpeechRecognition;
      const SpeechRecognitionConstructor = windowWithSR.SpeechRecognition ||
        windowWithSR.webkitSpeechRecognition;

      if (SpeechRecognitionConstructor) {
        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          if (isMutedRef.current) {
            recognition.abort();
            return;
          }
          setSttStatus('listening');
        };

        recognition.onspeechstart = () => {};

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          if (isMutedRef.current) return;

          if (isMobile) {
            if (event.resultIndex <= lastProcessedIndexRef.current && lastProcessedIndexRef.current !== -1) {
              return;
            }
            lastProcessedIndexRef.current = event.resultIndex;
          }

          let currentTranscript = '';
          const startIndex = isMobile ? event.resultIndex : 0;

          for (let i = startIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }

          transcriptRef.current = currentTranscript;

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            recognition.stop();
          }, 600);
        };

        recognition.onend = () => {
          lastProcessedIndexRef.current = -1;
          const finalTranscript = transcriptRef.current;

          if (finalTranscript.trim()) {
            onSpeechEnd(finalTranscript);
            transcriptRef.current = '';
          }

          if (!isMutedRef.current && isOpenRef.current) {
            startListening();
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
          }
          console.error("STT Error", event.error);
          setSttStatus('idle');
          if (onError) onError(event.error);
        };

        recognitionRef.current = recognition;

        if (isOpen && !isMuted) {
          startListening();
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [isOpen, isMuted, isMobile, onSpeechEnd, onError, setSttStatus, startListening]);

  return {
    startListening,
    stopListening,
    abortListening,
    recognitionRef,
    startTimerRef
  };
}
