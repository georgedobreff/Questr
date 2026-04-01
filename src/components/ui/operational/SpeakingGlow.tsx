import React from 'react';
import { cn } from '@/lib/utils';

interface SpeakingGlowProps {
  volume: number; // 0 to 1
  isPulsing: boolean;
  className?: string;
}

const SpeakingGlow: React.FC<SpeakingGlowProps> = ({ volume, isPulsing, className }) => {
  const style = {
    '--glow-scale': 1 + volume * 1.5,
    '--glow-opacity': 0.2 + volume * 0.5,
  } as React.CSSProperties;

  return (
    <div className={cn('relative w-full h-full flex items-center justify-center', className)} style={style}>
      <div
        className={cn(
          'absolute w-1/2 h-1/2 rounded-full transition-transform duration-100',
          isPulsing && 'animate-pulse-glow'
        )}
        style={{
          transform: 'scale(var(--glow-scale))',
          opacity: 'var(--glow-opacity)',
          boxShadow: `
            0 0 120px 60px hsla(265, 100%, 80%, 0.7),
            0 0 200px 100px hsla(250, 100%, 80%, 0.5),
            0 0 280px 140px hsla(275, 100%, 80%, 0.3)
          `,
          backgroundImage: `radial-gradient(circle, hsla(265, 100%, 85%, 0.8) 0%, hsla(265, 100%, 70%, 0) 80%)`,
        }}
      />
    </div>
  );
};

export default SpeakingGlow;
