const MODELS = {
    LLAMA_1B: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    LLAMA_3B: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    QWEN_05B: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', //vram_required_MB: 944.62
    QWEN_1_5B: 'Qwen2-1.5B-Instruct-q4f16_1-MLC',
    QWEN_3B: 'Qwen2.5-3B-Instruct-q4f32_1-MLC', // vram_required_MB: 2893.64
} as const;

export const BASE_DESKTOP = MODELS.LLAMA_3B;
export const BASE_MOBILE = MODELS.LLAMA_1B;

export type ModelId = typeof BASE_DESKTOP | typeof BASE_MOBILE;

export const LOCAL_MODELS = {
    oracle: { desktop: BASE_DESKTOP, mobile: BASE_MOBILE },
    dungeon: { desktop: BASE_DESKTOP, mobile: BASE_MOBILE },
    dungeonGeneration: { desktop: BASE_DESKTOP, mobile: BASE_MOBILE },
    petMission: { desktop: BASE_DESKTOP, mobile: BASE_MOBILE },
    quizExplanation: { desktop: BASE_DESKTOP, mobile: BASE_MOBILE },
    bossQuiz: { desktop: BASE_DESKTOP, mobile: BASE_MOBILE },
} as const;

export const TTS_VOICES = {
    oracle: 'F1',   // Calm with a slightly low tone; steady and composed
    dungeon: 'M5',  // Soft spoken, calm and soothing with a natural storytelling quality
} as const;

export const ENGINE_LOG_LEVEL = "WARN" as const;

const BASE_ENGINE_CONFIG = {
    temperature: 0.5,
    max_tokens: 800,
    seed: 48,
} as const;

export const ENGINE_CONFIG = {
    default: {
        ...BASE_ENGINE_CONFIG,
    },
    oracle: {
        ...BASE_ENGINE_CONFIG,
        temperature: 0.5,
        max_tokens: 300,
        repetition_penalty: 1.1,
    },
    dungeon: {
        ...BASE_ENGINE_CONFIG,
        temperature: 0.6,
        max_tokens: 500,
    },
    dungeonGeneration: {
        ...BASE_ENGINE_CONFIG,
        temperature: 0.6,
        max_tokens: 1500,
    },
} as const;