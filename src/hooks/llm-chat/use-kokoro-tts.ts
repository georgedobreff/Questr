import { useState, useEffect, useRef, useCallback } from 'react';
import { KOKORO_CONFIG, KokoroVoice } from '@/config/tts';

export type TTSStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'speaking' | 'error';

interface UseKokoroTTSOptions {
    voice?: KokoroVoice;
}

interface AudioChunk {
    text: string;
    phonemes: string;
    audio: {
        play: () => Promise<void>;
        toBlob: () => Blob;
    };
}

interface TextSplitterStreamInstance {
    push: (text: string) => void;
    close: () => void;
}

export function useKokoroTTS(options: UseKokoroTTSOptions = {}) {
    const { voice = KOKORO_CONFIG.oracleVoice } = options;

    const [status, setStatus] = useState<TTSStatus>('loading');
    const [loadingProgress, setLoadingProgress] = useState<string>('');
    const [numericProgress, setNumericProgress] = useState(0);
    const [playbackVolume, setPlaybackVolume] = useState(0);

    const ttsRef = useRef<InstanceType<typeof import('kokoro-js').KokoroTTS> | null>(null);
    const splitterRef = useRef<TextSplitterStreamInstance | null>(null);
    const streamAbortRef = useRef<AbortController | null>(null);
    const speakIdRef = useRef(0);
    const isStreamingRef = useRef(false);
    const pendingTextRef = useRef<string>('');

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const audioQueueRef = useRef<HTMLAudioElement[]>([]);
    const isPlayingRef = useRef(false);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                setStatus('loading');
                setLoadingProgress('Loading Kokoro TTS...');
                setNumericProgress(10);

                const { KokoroTTS } = await import('kokoro-js');

                setLoadingProgress('Loading model...');
                setNumericProgress(30);

                const model_id = 'onnx-community/Kokoro-82M-v1.0-ONNX';

                // Try WebGPU first, fallback to WASM
                let tts: InstanceType<typeof KokoroTTS>;
                try {
                    tts = await KokoroTTS.from_pretrained(model_id, {
                        dtype: KOKORO_CONFIG.dtype,
                        device: 'webgpu',
                    });
                } catch {
                    setLoadingProgress('WebGPU unavailable, using WASM...');
                    tts = await KokoroTTS.from_pretrained(model_id, {
                        dtype: KOKORO_CONFIG.dtype,
                        device: 'wasm',
                    });
                }

                if (mounted) {
                    ttsRef.current = tts;
                    setStatus('ready');
                    setLoadingProgress('');
                    setNumericProgress(100);
                }
            } catch (err) {
                console.error('Kokoro TTS Init Error:', err);
                if (mounted) {
                    setStatus('error');
                    setLoadingProgress(err instanceof Error ? err.message : 'Failed to initialize TTS');
                    setNumericProgress(0);
                }
            }
        };

        init();

        return () => {
            mounted = false;
        };
    }, []);

    const ensureAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 128;
            analyserRef.current.smoothingTimeConstant = 0.4;
        }
    }, []);

    const playNextInQueue = useCallback(async () => {
        if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

        const audioElement = audioQueueRef.current.shift();
        if (!audioElement) return;

        isPlayingRef.current = true;
        setStatus('speaking');

        ensureAudioContext();

        try {
            const source = audioContextRef.current!.createMediaElementSource(audioElement);
            source.connect(analyserRef.current!);
            analyserRef.current!.connect(audioContextRef.current!.destination);
        } catch {
        }

        const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
        const updateVolume = () => {
            if (!analyserRef.current || !isPlayingRef.current) {
                setPlaybackVolume(0);
                return;
            }

            analyserRef.current.getByteFrequencyData(dataArray);

            let weightedSum = 0;
            let weightTotal = 0;
            for (let i = 2; i < dataArray.length; i++) {
                const weight = i < 20 ? 1.5 : 0.5;
                weightedSum += dataArray[i] * weight;
                weightTotal += weight;
            }

            const avg = weightedSum / weightTotal;
            const normalized = Math.pow(avg / 60, 1.5);
            setPlaybackVolume(Math.min(1.8, normalized));

            animationFrameRef.current = requestAnimationFrame(updateVolume);
        };

        audioElement.onplay = () => updateVolume();

        audioElement.onended = () => {
            isPlayingRef.current = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            setPlaybackVolume(0);

            if (audioQueueRef.current.length > 0) {
                playNextInQueue();
            } else if (!isStreamingRef.current) {
                setStatus('ready');
            }
        };

        audioElement.onerror = () => {
            isPlayingRef.current = false;
            console.error('Audio playback error');
            if (audioQueueRef.current.length > 0) {
                playNextInQueue();
            } else {
                setStatus('ready');
            }
        };

        try {
            await audioElement.play();
        } catch (err) {
            console.error('Failed to play audio:', err);
            isPlayingRef.current = false;
        }
    }, [ensureAudioContext]);

    const startStream = useCallback(async () => {
        if (!ttsRef.current) return;

        if (streamAbortRef.current) {
            streamAbortRef.current.abort();
        }

        const currentId = ++speakIdRef.current;
        streamAbortRef.current = new AbortController();
        isStreamingRef.current = true;
        audioQueueRef.current = [];
        isPlayingRef.current = false;

        setStatus('generating');

        try {
            const { TextSplitterStream } = await import('kokoro-js');
            const splitter = new TextSplitterStream();
            splitterRef.current = splitter as TextSplitterStreamInstance;

            if (pendingTextRef.current) {
                splitter.push(pendingTextRef.current);
                pendingTextRef.current = '';
            }

            const stream = ttsRef.current.stream(splitter, { voice });

            // Process stream in background
            (async () => {
                try {
                    for await (const chunk of stream as AsyncIterable<AudioChunk>) {
                        if (currentId !== speakIdRef.current) break;

                        const blob = chunk.audio.toBlob();
                        const url = URL.createObjectURL(blob);
                        const audioElement = new Audio(url);

                        audioQueueRef.current.push(audioElement);

                        if (!isPlayingRef.current) {
                            playNextInQueue();
                        }
                    }
                } catch (err) {
                    if (currentId === speakIdRef.current) {
                        console.error('Stream processing error:', err);
                    }
                } finally {
                    if (currentId === speakIdRef.current) {
                        isStreamingRef.current = false;
                        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
                            setStatus('ready');
                        }
                    }
                }
            })();

        } catch (err) {
            console.error('Failed to start stream:', err);
            isStreamingRef.current = false;
            setStatus('ready');
        }
    }, [voice, playNextInQueue]);

    const pushText = useCallback((text: string) => {
        const cleanText = text.replace(/[^\p{L}\p{N}\s.,!?''']/gu, '');
        if (!cleanText) return;

        if (splitterRef.current) {
            splitterRef.current.push(cleanText);
        } else {
            pendingTextRef.current += cleanText;
        }
    }, []);

    const closeStream = useCallback(() => {
        if (splitterRef.current) {
            splitterRef.current.close();
            splitterRef.current = null;
        }
    }, []);

    const speak = useCallback(async (text: string) => {
        if (!ttsRef.current) return;

        const currentId = ++speakIdRef.current;
        isStreamingRef.current = false;

        try {
            setStatus('generating');

            audioQueueRef.current = [];
            isPlayingRef.current = false;

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            const cleanText = text.replace(/[^\p{L}\p{N}\s.,!?''']/gu, '');
            const audio = await ttsRef.current.generate(cleanText, { voice });

            if (currentId !== speakIdRef.current) return;

            const audioData = audio.toBlob();
            const url = URL.createObjectURL(audioData);
            const audioElement = new Audio(url);

            audioQueueRef.current.push(audioElement);
            playNextInQueue();

        } catch (err) {
            console.error('Speech Error:', err);
            if (currentId === speakIdRef.current) {
                setStatus('ready');
                setPlaybackVolume(0);
            }
        }
    }, [voice, playNextInQueue]);

    const stop = useCallback(() => {
        speakIdRef.current++;
        isStreamingRef.current = false;
        isPlayingRef.current = false;


        audioQueueRef.current.forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        audioQueueRef.current = [];

        if (splitterRef.current) {
            splitterRef.current.close();
            splitterRef.current = null;
        }

        if (streamAbortRef.current) {
            streamAbortRef.current.abort();
            streamAbortRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        setPlaybackVolume(0);
        setStatus('ready');
    }, []);

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    return {
        status,
        loadingProgress,
        numericProgress,
        speak,
        stop,
        playbackVolume,
        startStream,
        pushText,
        closeStream,
    };
}
