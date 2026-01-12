/**
 * HTML to Text Converter
 * 
 * Converts HTML content to plain text, preserving line breaks from paragraphs
 * and removing all HTML tags while decoding HTML entities.
 */

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

/**
 * Decodes HTML entities to their corresponding characters
 */
function decodeHtmlEntities(text: string): string {
  // Decode named entities
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }
  
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
  
  // Remove script and style content entirely
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Convert block elements to line breaks
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  
  // Add line break before lists
  text = text.replace(/<ul[^>]*>/gi, '\n');
  text = text.replace(/<ol[^>]*>/gi, '\n');
  
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = decodeHtmlEntities(text);
  
  // Normalize whitespace within lines but preserve intentional line breaks
  text = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n');
  
  // Remove multiple consecutive line breaks (max 2)
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace
  text = text.trim();
  
  return text;
}
