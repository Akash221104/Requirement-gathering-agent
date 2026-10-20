/**
 * Utility to clean and repair common LLM JSON formatting quirks
 * such as markdown wrapping, unquoted enum tokens, trailing commas,
 * and text surrounding the JSON object.
 */
export function cleanAndRepairJson(raw: string): string {
  let cleaned = raw.trim();

  // Strip markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // Extract content between first '{' and last '}' if extra preamble or postamble exists
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Strip single-line and multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

  // Quote unquoted identifier values (e.g. "issueType": CONFLICT, -> "issueType": "CONFLICT",)
  // Ignores standard JSON literals: true, false, null, and numbers
  cleaned = cleaned.replace(
    /:\s*([A-Za-z_][A-Za-z0-9_]*)\s*([,\}\]])/g,
    (match, word, suffix) => {
      if (['true', 'false', 'null'].includes(word.toLowerCase())) {
        return `: ${word.toLowerCase()}${suffix}`;
      }
      return `: "${word}"${suffix}`;
    }
  );

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([\}\]])/g, '$1');

  return cleaned;
}
