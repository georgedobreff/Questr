import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion, Variants } from "framer-motion";

export type OracleMode = 'idle' | 'thinking' | 'speaking';

interface OracleEyeProps {
    className?: string;
    size?: number | string;
    mode?: OracleMode;
    config?: {
        scaleEye?: number;
        scaleRing?: number;
        scaleSeals?: number;
        scaleRunes?: number;
    };
}

export function OracleEye({
    className,
    size = 500,
    mode = 'idle',
    config = {
        scaleEye: 0.51,
        scaleRing: 0.35,
        scaleSeals: 0.747,
        scaleRunes: 0.86,
    }
}: OracleEyeProps) {
    const commonClasses = "absolute inset-0 w-full h-full object-contain pointer-events-none";


    const softShadow = "drop-shadow(0 0 2px #404040ff)";

    const hardShadow = "drop-shadow(0 0 2px #2f2f2fff)";

    const softGlow = "drop-shadow(0 0 5px #f4ca68ff)";


    const baseScaleRing = config.scaleRing ?? 0.35;
    const baseScaleSeals = config.scaleSeals ?? 0.747;
    const baseScaleRunes = config.scaleRunes ?? 0.86;
    const baseScaleEye = config.scaleEye ?? 0.51;


    const ringVariants: Variants = {
        idle: {
            rotate: 360,
            scale: baseScaleRing,
            transition: {
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5, ease: "easeInOut" }
            }
        },
        thinking: {
            rotate: [0, 360],
            scale: baseScaleRing * 1.06,
            transition: {
                rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                scale: { duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
            }
        },
        speaking: {
            rotate: -360,
            scale: baseScaleRing * 1.06,
            transition: {
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5, ease: "easeInOut" }
            }
        }
    };

    const sealsVariants: Variants = {
        idle: {
            rotate: -360,
            scale: baseScaleSeals,
            transition: {
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5 }
            }
        },
        thinking: {
            rotate: [0, -360],
            scale: baseScaleSeals * 1.1,
            transition: {
                rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                scale: { duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
            }
        },
        speaking: {
            rotate: 360,
            scale: baseScaleSeals * 1.1,
            transition: {
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5 }
            }
        }
    };

    const runesVariants: Variants = {
        idle: {
            rotate: 360,
            scale: baseScaleRunes,
            transition: {
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5 }
            }
        },
        thinking: {
            rotate: [0, 360],
            scale: baseScaleRunes * 1.1,
            transition: {
                rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                scale: { duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
            }
        },
        speaking: {
            rotate: -360,
            scale: baseScaleRunes * 1.1,
            transition: {
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5 }
            }
        }
    };

    const eyeVariants: Variants = {
        idle: {
            scale: baseScaleEye,
            rotate: 0,
            transition: { duration: 0.5 }
        },
        thinking: {
            scale: baseScaleEye,
            rotate: -180,
            transition: { duration: 0.5 }
        },
        speaking: {
            scale: baseScaleEye,
            rotate: 90,
            transition: { duration: 0.5 }
        }
    };


    return (
        <div
            className={cn("relative flex items-center justify-center shrink-0", className)}
            style={{ width: size, height: size }}
        >
            {/* Layer 1: Eye */}
            <motion.div
                className={cn("z-40", commonClasses)}
                style={{
                    filter: hardShadow,
                }}
                animate={mode}
                variants={eyeVariants}
            >
                <div className="w-full h-full relative">
                    <Image
                        src="/assets/oracle/eye.png"
                        alt="Oracle Eye Center"
                        fill
                        priority
                        className="object-contain"
                    />
                </div>
            </motion.div>

            {/* Layer 2: Ring*/}
            <div
                className={cn("z-10", commonClasses)}
                style={{
                    filter: softGlow
                }}
            >
                <motion.div
                    className="w-full h-full relative"
                    animate={mode}
                    variants={ringVariants}
                >
                    <Image
                        src="/assets/oracle/ring.png"
                        alt="Oracle Eye Ring"
                        fill
                        priority
                        className="object-contain"
                    />
                </motion.div>
            </div>

            {/* Layer 3: Seals */}
            <div
                className={cn("z-30", commonClasses)}
                style={{
                    filter: softShadow
                }}
            >
                <motion.div
                    className="w-full h-full relative"
                    animate={mode}
                    variants={sealsVariants}
                >
                    <Image
                        src="/assets/oracle/seals.png"
                        alt="Oracle Eye Seals"
                        fill
                        priority
                        className="object-contain"
                    />
                </motion.div>
            </div>

            {/* Layer 4: Runes */}
            <div
                className={cn("z-20", commonClasses)}
                style={{
                    filter: hardShadow
                }}
            >
                <motion.div
                    className="w-full h-full relative"
                    animate={mode}
                    variants={runesVariants}
                >
                    <Image
                        src="/assets/oracle/runes.png"
                        alt="Oracle Eye Runes"
                        fill
                        priority
                        className="object-contain"
                    />
                </motion.div>
            </div>
        </div>
    );
}
