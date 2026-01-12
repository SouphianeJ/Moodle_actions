/**
 * HTML to Text Converter
 * 
 * Converts HTML content to plain text, preserving line breaks from paragraphs
 * and removing all HTML tags while decoding HTML entities.
 */

// Maximum consecutive newlines allowed in output
const MAX_CONSECUTIVE_NEWLINES = 2;

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&copy;': '©',
  '&reg;': '®',
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&cent;': '¢',
  '&hellip;': '...',
  '&mdash;': '-',
  '&ndash;': '-',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&bull;': '*',
  '&middot;': '*',
  '&deg;': '°',
  '&plusmn;': '±',
  '&times;': 'x',
  '&divide;': '/',
  '&frac12;': '1/2',
  '&frac14;': '1/4',
  '&frac34;': '3/4',
};

// Pre-compiled regex for named HTML entities (case-insensitive)
const ENTITY_PATTERN = new RegExp(
  Object.keys(HTML_ENTITIES).join('|'),
  'gi'
);

/**
 * Decodes HTML entities to their corresponding characters
 */
function decodeHtmlEntities(text: string): string {
  // Decode named entities using pre-compiled pattern
  let result = text.replace(ENTITY_PATTERN, (match) => {
    return HTML_ENTITIES[match.toLowerCase()] || match;
  });
  
  // Decode numeric entities (decimal)
  result = result.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  
  // Decode numeric entities (hex)
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  
  return result;
}

/**
 * Converts HTML content to plain text
 * 
 * @param html - HTML string to convert
 * @returns Plain text with preserved line breaks from paragraphs/breaks
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) {
    return '';
  }
  
  let text = html;
  
  // First pass: Convert block elements to line breaks before removing tags
  // This preserves document structure in the text output
  text = text.replace(/<\/p[\s>]/gi, '\n');
  text = text.replace(/<\/div[\s>]/gi, '\n');
  text = text.replace(/<br[\s/>]/gi, '\n');
  text = text.replace(/<\/li[\s>]/gi, '\n');
  text = text.replace(/<\/h[1-6][\s>]/gi, '\n');
  text = text.replace(/<\/tr[\s>]/gi, '\n');
  text = text.replace(/<ul[\s>]/gi, '\n');
  text = text.replace(/<ol[\s>]/gi, '\n');
  
  // Remove all HTML tags by iteratively removing angle-bracketed content
  // This is for text extraction from Moodle feedback, output goes to CSV (not HTML)
  // Using a loop ensures complete removal even with malformed/nested markup
  const MAX_ITERATIONS = 10;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const newText = text.replace(/<[^<>]*>/g, '');
    if (newText === text) break;
    text = newText;
  }
  
  // Remove any remaining angle brackets that might be malformed tags
  text = text.replace(/</g, '').replace(/>/g, '');
  
  // Decode HTML entities
  text = decodeHtmlEntities(text);
  
  // Normalize whitespace within lines but preserve intentional line breaks
  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n');
  
  // Remove excessive consecutive line breaks
  const newlinePattern = new RegExp(`\n{${MAX_CONSECUTIVE_NEWLINES + 1},}`, 'g');
  text = text.replace(newlinePattern, '\n'.repeat(MAX_CONSECUTIVE_NEWLINES));
  
  // Trim leading/trailing whitespace
  text = text.trim();
  
  return text;
}
