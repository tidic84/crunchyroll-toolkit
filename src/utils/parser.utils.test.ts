import { ParserUtils } from './parser.utils';

describe('ParserUtils', () => {
  describe('cleanText', () => {
    it('should clean whitespace from text', () => {
      expect(ParserUtils.cleanText('  hello   world  ')).toBe('hello world');
      expect(ParserUtils.cleanText('\n\ttest\n\n')).toBe('test');
    });

    it('should handle null and undefined', () => {
      expect(ParserUtils.cleanText(null)).toBe('');
      expect(ParserUtils.cleanText(undefined)).toBe('');
    });
  });

  describe('extractNumber', () => {
    it('should extract numbers from text', () => {
      expect(ParserUtils.extractNumber('Episode 42')).toBe(42);
      expect(ParserUtils.extractNumber('Season 3')).toBe(3);
    });

    it('should return undefined for no numbers', () => {
      expect(ParserUtils.extractNumber('No numbers here')).toBeUndefined();
      expect(ParserUtils.extractNumber(null)).toBeUndefined();
    });
  });

  describe('extractEpisodeNumber', () => {
    it('should extract episode numbers', () => {
      expect(ParserUtils.extractEpisodeNumber('Episode 1')).toBe(1);
      expect(ParserUtils.extractEpisodeNumber('Ep 25')).toBe(25);
      expect(ParserUtils.extractEpisodeNumber('S01E12')).toBe(12);
    });

    it('should return 0 for no match', () => {
      expect(ParserUtils.extractEpisodeNumber('No episode')).toBe(0);
    });
  });

  describe('extractSeasonNumber', () => {
    it('should extract season numbers', () => {
      expect(ParserUtils.extractSeasonNumber('Saison 2')).toBe(2);
      expect(ParserUtils.extractSeasonNumber('Season 3')).toBe(3);
      expect(ParserUtils.extractSeasonNumber('S4')).toBe(4);
    });

    it('should return undefined for no match', () => {
      expect(ParserUtils.extractSeasonNumber('No season')).toBeUndefined();
    });
  });

  describe('extractDuration', () => {
    it('should extract duration in minutes', () => {
      expect(ParserUtils.extractDuration('24 min')).toBe(24);
      expect(ParserUtils.extractDuration('1h 30min')).toBe(90);
      expect(ParserUtils.extractDuration('23:45')).toBe(23 * 60 + 45);
    });

    it('should return undefined for invalid duration', () => {
      expect(ParserUtils.extractDuration('invalid')).toBeUndefined();
      expect(ParserUtils.extractDuration(null)).toBeUndefined();
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize relative URLs', () => {
      expect(ParserUtils.normalizeUrl('/anime/123')).toBe('https://www.crunchyroll.com/anime/123');
      expect(ParserUtils.normalizeUrl('anime/123')).toBe('https://www.crunchyroll.com/anime/123');
    });

    it('should keep absolute URLs unchanged', () => {
      expect(ParserUtils.normalizeUrl('https://example.com/test')).toBe('https://example.com/test');
    });
  });

  describe('extractIdFromUrl', () => {
    it('should extract ID from URL', () => {
      expect(ParserUtils.extractIdFromUrl('/series/ABC123/one-piece')).toBe('one-piece');
      expect(ParserUtils.extractIdFromUrl('https://crunchyroll.com/episode/EP123')).toBe('EP123');
    });

    it('should handle edge cases', () => {
      expect(ParserUtils.extractIdFromUrl('')).toBe('');
      expect(ParserUtils.extractIdFromUrl('/')).toBe('');
    });
  });
}); 