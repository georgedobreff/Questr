
export function sanitizeInput(input: string): string {
  if (!input) return "";

  const forbiddenPatterns = [
    /`[SYSTEM]`/gi,
    /`[INSTRUCTIONS]`/gi,
    /System:/gi,
    /Instructions:/gi,
    /---/g,
    /Ignore all previous/gi,
    /Ignore instructions/gi,
    /Ignore everything/gi,
    /You are now/gi,
    /Developer Mode/gi
  ];

  let sanitized = input;
  for (const pattern of forbiddenPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized.trim();
}
