export interface Anime {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  genres?: string[];
  releaseYear?: number;
  rating?: number;
  episodeCount?: number;
}

export interface Episode {
  id: string;
  animeId: string;
  title: string;
  episodeNumber: number;
  seasonNumber?: number;
  thumbnail?: string;
  duration?: string;
  url: string;
}

export interface ScraperOptions {
  headless?: boolean;
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
  locale?: string;
}

export interface ScraperResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnimeSeries extends Anime {
  episodes: Episode[];
} 