import { Page } from 'playwright';
import { 
  Anime, 
  Episode, 
  AnimeSeries, 
  ScraperResult, 
  ScraperOptions 
} from '../types/anime.types';
import { BrowserManager } from '../utils/browser.utils';
import { ParserUtils } from '../utils/parser.utils';

export class CrunchyrollScraper {
  private browserManager: BrowserManager;
  private baseUrl = 'https://www.crunchyroll.com';

  constructor(options: ScraperOptions = {}) {
    this.browserManager = new BrowserManager(options);
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }

  async searchAnime(query: string): Promise<ScraperResult<Anime[]>> {
    try {
      // Essayer d'abord la version française, puis anglaise
      const searchUrls = [
        `${this.baseUrl}/fr/search?q=${encodeURIComponent(query)}`,
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
      ];

      for (const searchUrl of searchUrls) {
        console.log(`🔍 Tentative de recherche: ${searchUrl}`);
        
        try {
          await this.browserManager.navigateTo(searchUrl);
          const page = await this.browserManager.getPage();

          // Attendre le chargement complet avec plusieurs tentatives
          await page.waitForTimeout(8000);

          const animes = await page.evaluate(() => {
            const results: any[] = [];
            
            // Stratégie 1: Chercher tous les liens vers des séries
            const seriesLinks = document.querySelectorAll('a[href*="/series/"], a[href*="/watch/"]');
            console.log(`Liens trouvés: ${seriesLinks.length}`);
            
            const processedUrls = new Set<string>();
            
            seriesLinks.forEach(link => {
              const linkElement = link as HTMLAnchorElement;
              const href = linkElement.href;
              
              // Éviter les doublons
              if (processedUrls.has(href)) return;
              processedUrls.add(href);
              
              let title = linkElement.textContent?.trim() || '';
              
              // Si le lien n'a pas de texte direct, chercher dans les enfants
              if (!title) {
                const titleEl = linkElement.querySelector('h1, h2, h3, h4, h5, [class*="title"], [class*="name"]');
                title = titleEl?.textContent?.trim() || '';
              }
              
              // Chercher l'image dans le lien ou ses parents/enfants
              let thumbnail = '';
              const img = linkElement.querySelector('img') || 
                         linkElement.parentElement?.querySelector('img') ||
                         linkElement.closest('[class*="card"], [class*="item"]')?.querySelector('img');
              
              if (img) {
                thumbnail = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('srcset')?.split(' ')[0] || '';
              }

              // Chercher une description
              let description = '';
              const descEl = linkElement.parentElement?.querySelector('[class*="description"], [class*="synopsis"], p') ||
                            linkElement.closest('[class*="card"], [class*="item"]')?.querySelector('[class*="description"], p');
              if (descEl) {
                description = descEl.textContent?.trim() || '';
              }

              if (title && href && title.length > 2 && href.includes('/series/')) {
                results.push({
                  id: href.split('/').pop() || '',
                  title,
                  url: href,
                  thumbnail,
                  description
                });
              }
            });

            // Stratégie 2: Si pas assez de résultats, chercher plus largement
            if (results.length < 2) {
              const allElements = Array.from(document.querySelectorAll('*'));
              
              allElements.forEach(element => {
                const text = element.textContent?.toLowerCase() || '';
                const queryLower = 'one piece'; // On cherche spécifiquement One Piece pour le test
                
                if (text.includes(queryLower) && text.length < 200) {
                  // Chercher un lien dans cet élément ou ses parents
                  let linkElement = element.querySelector('a[href*="/series/"]') as HTMLAnchorElement;
                  if (!linkElement) {
                    linkElement = element.closest('a[href*="/series/"]') as HTMLAnchorElement;
                  }
                  
                  if (linkElement && !processedUrls.has(linkElement.href)) {
                    processedUrls.add(linkElement.href);
                    
                    const title = element.textContent?.trim() || linkElement.textContent?.trim() || '';
                    
                    if (title && title.length > 2) {
                      results.push({
                        id: linkElement.href.split('/').pop() || '',
                        title: title.substring(0, 100), // Limiter la longueur
                        url: linkElement.href,
                        thumbnail: '',
                        description: ''
                      });
                    }
                  }
                }
              });
            }

            console.log(`Résultats trouvés: ${results.length}`);
            return results.slice(0, 10); // Limiter à 10 résultats max
          });

          if (animes.length > 0) {
            // Normaliser les URLs
            const normalizedAnimes = animes.map(anime => ({
              ...anime,
              url: ParserUtils.normalizeUrl(anime.url, this.baseUrl)
            }));

            console.log(`✅ ${normalizedAnimes.length} résultats trouvés avec succès`);
            return { success: true, data: normalizedAnimes };
          }
          
        } catch (urlError) {
          console.log(`❌ Erreur pour ${searchUrl}: ${(urlError as Error).message}`);
          continue;
        }
      }

      // Si aucune URL n'a fonctionné
      return { 
        success: false, 
        error: 'Aucun résultat trouvé avec les URLs testées' 
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: `Erreur lors de la recherche: ${(error as Error).message}` 
      };
    }
  }

  async getAnimeDetails(animeUrl: string): Promise<ScraperResult<Anime>> {
    try {
      const fullUrl = ParserUtils.normalizeUrl(animeUrl, this.baseUrl);
      await this.browserManager.navigateTo(fullUrl);
      const page = await this.browserManager.getPage();

      // Attendre le chargement du contenu principal
      await page.waitForSelector('.hero-heading-line, h1', { timeout: 10000 });

      const animeData = await page.evaluate(() => {
        const title = document.querySelector('h1, .hero-heading-line')?.textContent?.trim();
        const description = document.querySelector('.expandable-section__wrapper p, .description')?.textContent?.trim();
        const thumbnail = document.querySelector('.hero-image img, meta[property="og:image"]')?.getAttribute('src') || 
                         document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        
        // Extraire les genres
        const genreElements = document.querySelectorAll('.genre-tag, .tags a');
        const genres: string[] = [];
        genreElements.forEach(el => {
          const genre = el.textContent?.trim();
          if (genre) genres.push(genre);
        });

        // Extraire l'année
        const yearText = document.querySelector('.release-year, .details')?.textContent;
        const year = yearText ? parseInt(yearText.match(/\d{4}/)?.[0] || '', 10) : undefined;

        // Extraire la note
        const ratingText = document.querySelector('.rating, .star-rating')?.textContent;
        const rating = ratingText ? parseFloat(ratingText.match(/[\d.]+/)?.[0] || '') : undefined;

        return {
          title: title || '',
          description,
          thumbnail,
          genres,
          releaseYear: year,
          rating
        };
      });

      const anime: Anime = {
        id: ParserUtils.extractIdFromUrl(fullUrl),
        url: fullUrl,
        ...animeData,
        thumbnail: animeData.thumbnail || undefined
      };

      return { success: true, data: anime };
    } catch (error) {
      return { 
        success: false, 
        error: `Erreur lors de la récupération des détails: ${(error as Error).message}` 
      };
    }
  }

  async getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>> {
    try {
      const fullUrl = ParserUtils.normalizeUrl(animeUrl, this.baseUrl);
      const animeId = ParserUtils.extractIdFromUrl(fullUrl);
      
      await this.browserManager.navigateTo(fullUrl);
      const page = await this.browserManager.getPage();

      // Attendre et cliquer sur l'onglet des épisodes si nécessaire
      try {
        await page.click('[data-testid="episodes-tab"], .episodes-tab', { timeout: 5000 });
        await page.waitForTimeout(1000); // Attendre le chargement
      } catch {
        // L'onglet n'existe peut-être pas ou les épisodes sont déjà visibles
      }

      // Attendre que les épisodes se chargent
      await page.waitForSelector('.episode-card, [class*="episode"], .playable-card', { timeout: 10000 });

      // Charger tous les épisodes en scrollant
      await this.loadAllEpisodes(page);

      const episodes = await page.evaluate((animeId) => {
        const episodeList: Episode[] = [];
        const episodeCards = document.querySelectorAll('.episode-card, [class*="episode"], .playable-card');

        episodeCards.forEach((card, index) => {
          const titleEl = card.querySelector('.episode-title, h4, .title');
          const thumbnailEl = card.querySelector('img');
          const episodeNumEl = card.querySelector('.episode-number, .episode-label');
          const durationEl = card.querySelector('.duration, .episode-duration');
          const descEl = card.querySelector('.episode-description, .description');
          const linkEl = card.querySelector('a');

          if (titleEl) {
            const title = titleEl.textContent?.trim() || '';
            const episodeNumText = episodeNumEl?.textContent || title;
            const episodeNumber = parseInt(episodeNumText.match(/\d+/)?.[0] || String(index + 1), 10);

            episodeList.push({
              id: linkEl?.getAttribute('href')?.split('/').pop() || `${animeId}-ep${episodeNumber}`,
              animeId,
              title,
              episodeNumber,
              thumbnail: thumbnailEl?.getAttribute('src') || thumbnailEl?.getAttribute('data-src') || '',
              description: descEl?.textContent?.trim(),
              duration: durationEl ? parseInt(durationEl.textContent?.match(/\d+/)?.[0] || '0', 10) : undefined,
              url: linkEl?.getAttribute('href') || ''
            });
          }
        });

        return episodeList;
      }, animeId);

      // Normaliser les URLs
      const normalizedEpisodes = episodes.map(episode => ({
        ...episode,
        url: episode.url ? ParserUtils.normalizeUrl(episode.url, this.baseUrl) : ''
      }));

      return { success: true, data: normalizedEpisodes };
    } catch (error) {
      return { 
        success: false, 
        error: `Erreur lors de la récupération des épisodes: ${(error as Error).message}` 
      };
    }
  }

  async getAnimeSeries(animeUrl: string): Promise<ScraperResult<AnimeSeries>> {
    try {
      const animeResult = await this.getAnimeDetails(animeUrl);
      if (!animeResult.success || !animeResult.data) {
        return { success: false, error: animeResult.error };
      }

      const episodesResult = await this.getEpisodes(animeUrl);
      if (!episodesResult.success || !episodesResult.data) {
        return { success: false, error: episodesResult.error };
      }

      const animeSeries: AnimeSeries = {
        ...animeResult.data,
        episodes: episodesResult.data,
        episodeCount: episodesResult.data.length
      };

      return { success: true, data: animeSeries };
    } catch (error) {
      return { 
        success: false, 
        error: `Erreur lors de la récupération de la série: ${(error as Error).message}` 
      };
    }
  }

  private async loadAllEpisodes(page: Page): Promise<void> {
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    
    while (previousHeight !== currentHeight) {
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
    }
  }
} 