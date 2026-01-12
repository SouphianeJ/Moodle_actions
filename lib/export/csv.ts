/**
 * CSV Generator
 * 
 * Generates RFC 4180 compliant CSV content with semicolon delimiter
 * and proper escaping for Excel compatibility.
 */

export interface CsvOptions {
  delimiter?: string;
  includeUtf8Bom?: boolean;
}

const DEFAULT_OPTIONS: CsvOptions = {
  delimiter: ';',
  includeUtf8Bom: true, // Helps Excel recognize UTF-8 encoding
};

/**
 * Escapes a value for CSV format
 * - If value contains delimiter, quotes, or newlines, wrap in quotes
 * - Double any internal quotes
 */
function escapeValue(value: string | number | null | undefined, delimiter: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if we need to quote the value
  const needsQuotes = 
    stringValue.includes(delimiter) ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r');
  
  if (!needsQuotes) {
    return stringValue;
  }
  
  // Double internal quotes and wrap in quotes
  const escaped = stringValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates CSV content from headers and rows
 * 
 * @param headers - Array of column header names
 * @param rows - Array of row data (each row is an array of values)
 * @param options - CSV generation options
 * @returns CSV string content
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options: CsvOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const delimiter = opts.delimiter!;
  
  const lines: string[] = [];
  
  // Add UTF-8 BOM if requested (helps Excel recognize encoding)
  const bom = opts.includeUtf8Bom ? '\uFEFF' : '';
  
  // Add header row
  const headerLine = headers
    .map(h => escapeValue(h, delimiter))
    .join(delimiter);
  lines.push(headerLine);
  
  // Add data rows
  for (const row of rows) {
    const rowLine = row
      .map(cell => escapeValue(cell, delimiter))
      .join(delimiter);
    lines.push(rowLine);
  }
  
  return bom + lines.join('\r\n');
}

/**
 * Creates a Response object for file download
 * 
 * @param csvContent - The CSV content string
 * @param filename - The filename for the download
 * @returns Response object with appropriate headers
 */
export function createCsvResponse(csvContent: string, filename: string): Response {
  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
