export class SanitizeUtil {
  /**
   * Sanitizes a filename by removing null bytes and invalid UTF-8 characters
   * @param filename - The filename to sanitize
   * @returns Sanitized filename safe for database storage
   */
  static sanitizeFilename(filename: string): string {
    if (!filename) return 'document';

    // Remove null bytes and control characters (except newline, tab, carriage return)
    let sanitized = filename
      .replace(/\0/g, '') // Remove null bytes (most important!)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .trim();

    // Try to decode if it looks encoded, but handle errors gracefully
    try {
      // If it contains URL-encoded characters, decode them
      if (/%[0-9A-F]{2}/i.test(sanitized)) {
        sanitized = decodeURIComponent(sanitized);
      }

      // Validate UTF-8 encoding
      // Check if string contains invalid UTF-8 sequences
      const buffer = Buffer.from(sanitized, 'utf8');
      sanitized = buffer.toString('utf8');
    } catch {
      // If decoding fails, use a safe fallback
      sanitized = sanitized.replace(/[^\w\s.-]/g, '_') || 'document';
    }

    // Final cleanup: ensure no null bytes remain
    sanitized = sanitized.replace(/\0/g, '');

    // Ensure it's not empty and has a reasonable length
    sanitized = sanitized.trim().substring(0, 255) || 'document';

    return sanitized;
  }

  /**
   * Sanitizes a MIME type string
   * @param mime - The MIME type to sanitize
   * @returns Sanitized MIME type
   */
  static sanitizeMimeType(mime: string): string {
    if (!mime) return 'application/octet-stream';
    // Remove null bytes and invalid characters from mimetype
    return mime.replace(/\0/g, '').trim() || 'application/octet-stream';
  }

  /**
   * Sanitizes any text string for database storage
   * @param text - The text to sanitize
   * @returns Sanitized text
   */
  static sanitizeText(text: string): string {
    if (!text) return '';
    // Remove null bytes and control characters
    return text.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
}
