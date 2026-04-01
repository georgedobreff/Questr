import { corsHeaders } from '../_shared/cors.ts';
import { MODEL_TTS } from '../_shared/llm_config.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

function addWavHeader(pcmBase64: string): string {
  const pcmData = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const header = new Uint8Array(buffer);
  const wavFile = new Uint8Array(header.length + pcmData.length);
  wavFile.set(header);
  wavFile.set(pcmData, header.length);

  let binary = '';
  const len = wavFile.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(wavFile[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text }: { text: string } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration error (Missing GEMINI_API_KEY)' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TTS}:generateContent?key=${GEMINI_API_KEY}`;
      const cleanText = text.replace(/\*\*/g, '').replace(/\[.*?\]/g, '').trim();

      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanText }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Algieba" }
              }
            }
          }
        })
      });

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (audioBase64) {
          const wavBase64 = addWavHeader(audioBase64);

          return new Response(JSON.stringify({ audioContent: wavBase64, source: 'gemini', contentType: 'audio/wav' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.warn("Gemini response OK but no audio data found. Falling back.");
      } else {
        const errorBody = await geminiResponse.text();
        console.warn(`Gemini TTS failed: ${geminiResponse.status} ${geminiResponse.statusText}`);
        console.warn(`Gemini Error Details: ${errorBody}`);
      }

    } catch (e: unknown) {
      const error = e as Error;
      console.warn("Gemini TTS Exception:", error.message);
    }

    console.log("Falling back to Standard Google Cloud TTS (Chirp/Neural2)...");

    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GEMINI_API_KEY}`;

    const cleanedText = text.replace(/\*.*?\*/g, '').trim();

    const ttsResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: cleanedText },
        voice: { languageCode: "en-US", name: "en-US-Studio-M" },
        audioConfig: { audioEncoding: "MP3" }
      })
    });

    const ttsData = await ttsResponse.json();

    if (!ttsResponse.ok) {
      console.error("Standard TTS Error:", JSON.stringify(ttsData));
      throw new Error(ttsData.error?.message || 'Both Gemini and Standard TTS failed.');
    }

    return new Response(JSON.stringify({ audioContent: ttsData.audioContent, source: 'standard', contentType: 'audio/mp3' }), {

      headers: { ...corsHeaders, 'Content-Type': 'application/json' },

    });



  } catch (err: unknown) {

    const error = err as Error;

    return new Response(JSON.stringify({ error: error.message }), {

      status: 500,

      headers: { ...corsHeaders, 'Content-Type': 'application/json' },

    });

  }

});

