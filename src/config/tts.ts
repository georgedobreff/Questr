// ============================================================
// KOKORO-82M CONFIGURATION
// ============================================================

// All available Kokoro voices
export type KokoroVoice =
    | 'af_alloy' | 'af_aoede' | 'af_bella' | 'af_heart' | 'af_jessica'
    | 'af_kore' | 'af_nicole' | 'af_nova' | 'af_river' | 'af_sarah' | 'af_sky'
    | 'am_adam' | 'am_echo' | 'am_eric' | 'am_fenrir' | 'am_liam'
    | 'am_michael' | 'am_onyx' | 'am_puck' | 'am_santa'
    | 'bf_alice' | 'bf_emma' | 'bf_isabella' | 'bf_lily'
    | 'bm_daniel' | 'bm_fable' | 'bm_george' | 'bm_lewis';

export const KOKORO_CONFIG = {
    oracleVoice: 'af_bella' as KokoroVoice,
    dungeonVoice: 'am_santa' as KokoroVoice,
    device: 'webgpu',
    dtype: 'fp32',
    speed: 0.5,
} as const;

export type KokoroDevice = 'webgpu' | 'wasm';
export type KokoroDtype = 'fp32' | 'fp16' | 'q8' | 'q4';

// ============================================================
// SUPERTONIC CONFIGURATION (LEGACY)
// ============================================================

export const SUPERTONIC_CONFIG = {
    modelBasePath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/llms/supertonic`,
    defaultVoiceStyle: 'base',
} as const;
