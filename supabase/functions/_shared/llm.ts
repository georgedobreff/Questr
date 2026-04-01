const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const PLANS_GENERATOR_KEY = Deno.env.get('PLANS_GENERATOR_KEY');

// Regular Function

export async function callGemini(prompt: string, json_mode: boolean = true, model: string = 'gemini-2.5-pro', signal?: AbortSignal): Promise<string | Record<string, unknown>> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: json_mode ? 'application/json' : 'text/plain' },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
      ]
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini API Error Body:", errorBody);
    throw new Error(`Gemini API error: ${response.statusText}`);
  }
  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    console.error("Gemini API returned no candidates. Full response:", JSON.stringify(data, null, 2));
    throw new Error(`Gemini API returned no content. Feedback: ${JSON.stringify(data.promptFeedback || "None")}`);
  }

  const response_content = data.candidates[0].content.parts[0].text;
  if (json_mode)
    return JSON.parse(response_content) as Record<string, unknown>;
  return response_content as string;
}


// Template Plans ONLY



export async function callGeminiTemplates(prompt: string, json_mode: boolean = true, model: string = 'gemini-2.5-pro', signal?: AbortSignal): Promise<string | Record<string, unknown>> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${PLANS_GENERATOR_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: json_mode ? 'application/json' : 'text/plain' },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
      ]
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini API Error Body:", errorBody);
    throw new Error(`Gemini API error: ${response.statusText}`);
  }
  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    console.error("Gemini API returned no candidates. Full response:", JSON.stringify(data, null, 2));
    throw new Error(`Gemini API returned no content. Feedback: ${JSON.stringify(data.promptFeedback || "None")}`);
  }

  const response_content = data.candidates[0].content.parts[0].text;
  if (json_mode)
    return JSON.parse(response_content) as Record<string, unknown>;
  return response_content as string;
}



// Streaming Function

export async function* streamGemini(prompt: string, model: string = 'gemini-2.5-pro', signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  if (!response.body) throw new Error("No response body from Gemini API");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    let startIndex = 0;
    while (true) {
      const openBrace = buffer.indexOf('{', startIndex);
      if (openBrace === -1) break;

      let balance = 0;
      let endIndex = -1;
      let inString = false;
      let escape = false;

      for (let i = openBrace; i < buffer.length; i++) {
        const char = buffer[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') balance++;
          else if (char === '}') {
            balance--;
            if (balance === 0) {
              endIndex = i;
              break;
            }
          }
        }
      }

      if (endIndex !== -1) {
        const jsonStr = buffer.substring(openBrace, endIndex + 1);
        try {
          interface GeminiCandidate {
            candidates?: { content: { parts: { text: string }[] } }[];
          }
          const data = JSON.parse(jsonStr) as GeminiCandidate;
          if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            yield data.candidates[0].content.parts[0].text;
          }
          buffer = buffer.substring(endIndex + 1);
          startIndex = 0;
        } catch {
          startIndex = openBrace + 1;
        }
      } else {
        break;
      }
    }
  }
}