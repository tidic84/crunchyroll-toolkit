export class ParserUtils {
  static cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  static extractNumber(text: string | null | undefined): number | undefined {
    if (!text) return undefined;
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : undefined;
  }

  static extractEpisodeNumber(text: string): number {
    const patterns = [
      /[Ss]\d+[Ee](\d+)/, // S01E12 format
      /[Ee]pisode\s*(\d+)/,
      /[Ee]p\s*(\d+)/,
      /\b(\d+)\b/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return 0;
  }

  static extractSeasonNumber(text: string): number | undefined {
    const patterns = [
      /[Ss]aison\s*(\d+)/,
      /[Ss]eason\s*(\d+)/,
      /[Ss]\s*(\d+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return undefined;
  }

  static parseDate(dateStr: string | null | undefined): Date | undefined {
    if (!dateStr) return undefined;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  static extractDuration(text: string | null | undefined): number | undefined {
    if (!text) return undefined;

    const patterns = [
      /(\d+)\s*h\s*(\d+)\s*min/i,
      /(\d+)\s*min/i,
      /(\d+):(\d+)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          // Format: Xh Ymin ou X:Y
          return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        } else {
          // Format: X min
          return parseInt(match[1], 10);
        }
      }
    }

    return undefined;
  }

  static extractIdFromUrl(url: string): string {
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  static normalizeUrl(url: string, baseUrl: string = 'https://www.crunchyroll.com'): string {
    if (url.startsWith('http')) {
      return url;
    }
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    return baseUrl + '/' + url;
  }
} 