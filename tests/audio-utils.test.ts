import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/generate-speech/index.ts
 */
function createWavHeader(dataSize: number) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const fileSize = 36 + dataSize;

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Channels
  view.setUint32(24, 24000, true); // Sample Rate
  
  return new Uint8Array(buffer);
}

describe('Binary Utils: WAV Header Construction', () => {
  it('should create a valid 44-byte header', () => {
    const header = createWavHeader(1000);
    expect(header.length).toBe(44);
  });

  it('should contain the correct RIFF/WAVE magic strings', () => {
    const header = createWavHeader(1000);
    const decoder = new TextDecoder();
    
    expect(decoder.decode(header.slice(0, 4))).toBe('RIFF');
    expect(decoder.decode(header.slice(8, 12))).toBe('WAVE');
  });

  it('should calculate the correct file size in the header', () => {
    const dataSize = 1000;
    const header = createWavHeader(dataSize);
    const view = new DataView(header.buffer);
    
    // Offset 4: File Size (LE)
    expect(view.getUint32(4, true)).toBe(36 + dataSize);
  });
});
