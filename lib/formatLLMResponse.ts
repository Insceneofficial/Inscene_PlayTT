/**
 * Format LLM Response for UI Display
 * 
 * Removes markdown formatting, emojis, and formats lists properly
 * - Removes all emojis (no random emojis in output)
 * - Removes markdown bold/italic markers (*, **, _)
 * - Formats numbered lists (Step 1, Step 2, etc.) to separate lines
 * - Cleans up other markdown artifacts
 */

export const formatLLMResponse = (text: string): string => {
  if (!text) return text;

  let formatted = text;

  // Remove all emojis (Unicode emoji ranges)
  // This covers most emoji ranges including:
  // - Basic emojis: 😀-🙏
  // - Symbols & Pictographs: 🌀-🗿
  // - Transport & Map: 🚀-🛿
  // - Supplemental Symbols: 🛀-🛿
  // - And more
  formatted = formatted.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
  formatted = formatted.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols and Pictographs
  formatted = formatted.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and Map
  formatted = formatted.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Flags (two chars)
  formatted = formatted.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
  formatted = formatted.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats
  formatted = formatted.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental Symbols and Pictographs
  formatted = formatted.replace(/[\u{1FA00}-\u{1FA6F}]/gu, ''); // Chess Symbols
  formatted = formatted.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and Pictographs Extended-A
  formatted = formatted.replace(/[\u{FE00}-\u{FE0F}]/gu, ''); // Variation Selectors
  formatted = formatted.replace(/[\u{200D}]/gu, ''); // Zero Width Joiner
  formatted = formatted.replace(/[\u{200C}]/gu, ''); // Zero Width Non-Joiner
  formatted = formatted.replace(/[\u{FE0F}]/gu, ''); // Variation Selector-16

  // Remove markdown bold/italic markers
  // Remove **text** (bold)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1');
  // Remove *text* (italic or bold)
  formatted = formatted.replace(/\*(.+?)\*/g, '$1');
  // Remove _text_ (italic)
  formatted = formatted.replace(/_(.+?)_/g, '$1');
  // Remove `text` (inline code)
  formatted = formatted.replace(/`(.+?)`/g, '$1');
  // Remove # headers
  formatted = formatted.replace(/^#+\s+/gm, '');
  // Remove markdown links [text](url) -> text
  formatted = formatted.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Format numbered lists - ensure each step is on a new line
  // First, handle "Step 1", "Step 2", "Step 3" patterns (case insensitive)
  // Pattern: "Step 1: text Step 2: text" -> separate lines
  formatted = formatted.replace(/(Step\s+\d+[:\-])\s*/gi, '\n$1 ');
  // Pattern: "Step 1 text Step 2 text" (without colon) -> separate lines
  formatted = formatted.replace(/(Step\s+\d+)\s+/gi, (match, p1, offset, string) => {
    // Check if this is the start of a new step (not in the middle of a word)
    const before = string[offset - 1] || ' ';
    return (before === ' ' || before === '\n' || before === '.') ? '\n' + p1 + ' ' : match;
  });
  // Handle numbered lists like "1. text 2. text" -> separate lines
  formatted = formatted.replace(/(\d+\.\s+)/g, '\n$1');
  // Handle patterns like "1) text 2) text" -> separate lines
  formatted = formatted.replace(/(\d+\)\s+)/g, '\n$1');

  // Format bullet points - ensure each is on a new line
  // Pattern: "- item", "* item", "• item"
  formatted = formatted.replace(/([.!?])\s*([\-\*•])\s+/g, '$1\n$2 ');
  // Also handle cases where bullets are inline
  formatted = formatted.replace(/([\-\*•])\s+/g, '\n$1 ');

  // Clean up multiple newlines (more than 2 consecutive)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Clean up leading/trailing whitespace on each line
  formatted = formatted.split('\n').map(line => line.trim()).join('\n');

  // Remove leading/trailing newlines
  formatted = formatted.trim();

  // If the text contains numbered steps or lists, ensure proper line breaks
  // Check for patterns like "Step 1...Step 2" or "1...2." without line breaks
  const stepPattern = /(Step\s+\d+[:\-]|^\d+\.\s)/gi;
  if (stepPattern.test(formatted)) {
    // Ensure each step starts on a new line
    formatted = formatted.replace(/([.!?])\s*(Step\s+\d+[:\-]|\d+\.\s)/gi, '$1\n\n$2');
  }

  // Final cleanup: remove excessive spacing
  formatted = formatted.replace(/\s{3,}/g, ' '); // Multiple spaces -> single space
  formatted = formatted.replace(/\n{3,}/g, '\n\n'); // Multiple newlines -> double newline

  return formatted.trim();
};

