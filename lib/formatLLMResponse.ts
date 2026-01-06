/**
 * Format LLM Response for UI Display
 * 
 * Removes markdown formatting, emojis, and formats lists properly
 * - Removes all emojis (no random emojis in output)
 * - Removes markdown bold/italic markers (*, **, _)
 * - Formats numbered lists (Step 1, Step 2, etc.) to separate lines
 * - Cleans up other markdown artifacts
 */

/**
 * Check if text is a structured TYPE 1 message (goal updates, status reports, etc.)
 */
const isStructuredMessage = (text: string): boolean => {
  const structuredPatterns = [
    /Here's your (goal|current|status)/i,
    /Goal:/i,
    /Current Status:/i,
    /Progress:/i,
    /Next Step:/i,
    /Milestone:/i,
    /Key blocker:/i,
    /Progress Summary:/i
  ];
  
  return structuredPatterns.some(pattern => pattern.test(text));
};

export const formatLLMResponse = (text: string): string => {
  if (!text) return text;

  // Check if this is a structured TYPE 1 message
  const isStructured = isStructuredMessage(text);
  
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

  // For structured TYPE 1 messages, preserve line breaks and structure
  if (isStructured) {
    // CRITICAL FIX: Handle the exact pattern from the image
    // "Here's your goal status: Goal: X Current Status: Progress: Y Current Milestone: Z Key Blocker: W Next Step: V"
    
    // Step 1: Fix "Here's your goal status:" prefix
    formatted = formatted.replace(/Here's your goal status:\s*/gi, 'Here\'s your goal status\n\n');
    
    // Step 2: Break up "Goal:" section (everything until "Current Status:")
    formatted = formatted.replace(/Goal:\s*([^\n]+?)(?=\s*Current Status:|$)/gi, (match, content) => {
      const trimmed = content.trim().replace(/\.\s*$/, '');
      // Stop at "Current Status:" if present
      const statusIndex = trimmed.indexOf('Current Status:');
      const goalText = statusIndex > 0 ? trimmed.substring(0, statusIndex).trim() : trimmed;
      return `Goal:\n${goalText}`;
    });
    
    // Step 3: Handle "Current Status:" with nested items
    // Pattern: "Current Status: Progress: In Progress. Current Milestone: X Key Blocker: Y"
    formatted = formatted.replace(/Current Status:\s*([^\n]+?)(?=\s*Next Step:|$)/gi, (match, content) => {
      if (!content.includes('\n')) {
        // Split by "Progress:", "Current Milestone:", "Key blocker:", "Progress Summary:"
        const items: Array<{label: string, value: string}> = [];
        
        // Extract Progress
        const progressMatch = content.match(/Progress:\s*([^\.]+?)(?=\s*(?:Current Milestone|Key blocker|Progress Summary|Next Step)|\.|$)/i);
        if (progressMatch) {
          items.push({ label: 'Progress', value: progressMatch[1].trim().replace(/\.\s*$/, '') });
        }
        
        // Extract Current Milestone
        const milestoneMatch = content.match(/Current Milestone:\s*([^\.]+?)(?=\s*(?:Key blocker|Progress Summary|Next Step)|\.|$)/i);
        if (milestoneMatch) {
          items.push({ label: 'Current Milestone', value: milestoneMatch[1].trim().replace(/\.\s*$/, '') });
        }
        
        // Extract Key blocker
        const blockerMatch = content.match(/Key Blocker:\s*([^\.]+?)(?=\s*(?:Progress Summary|Next Step)|\.|$)/i);
        if (blockerMatch) {
          items.push({ label: 'Key blocker', value: blockerMatch[1].trim().replace(/\.\s*$/, '') });
        }
        
        // Extract Progress Summary if present
        const summaryMatch = content.match(/Progress Summary:\s*([^\.]+?)(?=\s*Next Step:|\.|$)/i);
        if (summaryMatch) {
          items.push({ label: 'Progress Summary', value: summaryMatch[1].trim().replace(/\.\s*$/, '') });
        }
        
        if (items.length > 0) {
          return `Current Status:\n${items.map(item => `• ${item.label}: ${item.value}`).join('\n')}`;
        }
      }
      return `Current Status:\n${content}`;
    });
    
    // Step 4: Break up "Next Step:" section
    formatted = formatted.replace(/Next Step:\s*([^\n]+?)(?=\s*What would you like|$)/gi, (match, content) => {
      const trimmed = content.trim().replace(/\.\s*$/, '');
      const questionIndex = trimmed.indexOf('What would you like');
      const nextStepText = questionIndex > 0 ? trimmed.substring(0, questionIndex).trim() : trimmed;
      return `Next Step:\n${nextStepText}`;
    });
    
    // Step 5: Ensure "What would you like" is on new line
    formatted = formatted.replace(/([^\n])(What would you like)/gi, '$1\n\n$2');
    
    // Step 6: Ensure major sections are separated by blank lines
    formatted = formatted.replace(/([^\n])\n(Goal|Current Status|Next Step)/gi, '$1\n\n$2');
    
    // Step 7: Clean up excessive newlines but preserve structure
    formatted = formatted.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines
    
    // Step 8: Clean up whitespace on each line (preserve line breaks)
    formatted = formatted.split('\n').map(line => {
      if (line.trim() === '') return ''; // Preserve blank lines
      return line.trim(); // Trim both ends for clean display
    }).join('\n');
    
    // Step 9: Final trim
    formatted = formatted.trim();
    
    return formatted;
  }

  // For TYPE 2 conversational messages, apply normal formatting
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

