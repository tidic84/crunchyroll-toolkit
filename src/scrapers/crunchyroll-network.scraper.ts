import { Page, BrowserContext } from 'playwright';
import { BrowserManager } from '../utils/browser.utils';
import { ParserUtils } from '../utils/parser.utils';
import { ScraperOptions, ScraperResult, Anime, Episode, AnimeSeries } from '../types/anime.types';

/**
 * Scraper Crunchyroll avec interception réseau
 * Intercepte les requêtes API pour récupérer les vraies données de recherche
 */
export class CrunchyrollNetworkScraper {
  private browserManager: BrowserManager;
  private baseUrl = 'https://www.crunchyroll.com';
  private context?: BrowserContext;

  constructor(options: ScraperOptions = {}) {
    this.browserManager = new BrowserManager({
      headless: options.headless || false,
      timeout: options.timeout || 60000,
      locale: options.locale || 'fr-FR'
    });
  }

  async initialize(): Promise<void> {
    console.log('🌐 Initialisation du scraper réseau Crunchyroll...');
    await this.browserManager.initialize();
    console.log('✅ Scraper réseau initialisé avec interception API');
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }

  private async humanDelay(min: number = 1500, max: number = 4000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async searchAnime(query: string): Promise<ScraperResult<Anime[]>> {
    try {
      const page = await this.browserManager.getPage();
      
      // Configuration de l'interception réseau
      const apiResponses: any[] = [];
      const searchData: any[] = [];
      
      // Intercepter toutes les requêtes et réponses
      page.on('response', async (response) => {
        const url = response.url();
        
        // Cibler les API de recherche Crunchyroll
        if (url.includes('/content/') || 
            url.includes('/search') || 
            url.includes('/browse') ||
            url.includes('/discovery') ||
            url.includes('search') ||
            url.includes('api')) {
          
          console.log(`📡 API détectée: ${url.substring(0, 100)}...`);
          
          try {
            const contentType = response.headers()['content-type'] || '';
            
            if (contentType.includes('application/json')) {
              const responseData = await response.json();
              
              console.log(`📊 Réponse JSON reçue de: ${new URL(url).pathname}`);
              
              // Analyser la structure de la réponse
              if (this.containsAnimeData(responseData)) {
                console.log('✅ Données d\'animé détectées dans la réponse API');
                apiResponses.push({
                  url,
                  data: responseData,
                  timestamp: Date.now()
                });
                
                // Extraire les données d'animé
                const extractedAnimes = this.extractAnimesFromApiResponse(responseData);
                searchData.push(...extractedAnimes);
              }
            }
          } catch (error) {
            // Ignore les erreurs de parsing JSON
          }
        }
      });

      // Navigation vers la page de recherche
      const searchUrl = `${this.baseUrl}/fr/search?q=${encodeURIComponent(query)}`;
      console.log(`🔍 Recherche réseau pour "${query}" sur: ${searchUrl}`);
      
      await page.goto(searchUrl);
      await page.waitForLoadState('networkidle');
      
      // Attendre que les requêtes API se terminent
      console.log('⏳ Attente des réponses API...');
      await this.humanDelay(5000, 8000);
      
      // Essayer de déclencher plus de requêtes en scrollant
      console.log('📜 Scroll pour déclencher plus de requêtes API...');
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.humanDelay(2000, 3000);
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.humanDelay(2000, 3000);

      // Analyser les données collectées
      console.log(`📊 ${apiResponses.length} réponse(s) API collectée(s)`);
      console.log(`📺 ${searchData.length} animé(s) extrait(s) des API`);

      if (searchData.length > 0) {
        // Filtrer et nettoyer les résultats
        const relevantAnimes = this.filterRelevantResults(searchData, query);
        
        console.log(`✅ ${relevantAnimes.length} résultat(s) pertinent(s) trouvé(s)`);
        return { success: true, data: relevantAnimes };
      }

      // Fallback: Si pas de données API, essayer le DOM
      console.log('⚠️ Pas de données API - Fallback vers extraction DOM...');
      return await this.fallbackDomExtraction(page, query);

    } catch (error) {
      console.error('❌ Erreur scraper réseau:', error);
      return { 
        success: false, 
        error: `Erreur lors de la recherche réseau: ${(error as Error).message}` 
      };
    }
  }

  private containsAnimeData(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    
    // Patterns typiques des données d'animé dans les API Crunchyroll
    const animePatterns = [
      'series', 'title', 'description', 'images', 'poster',
      'seasons', 'episodes', 'metadata', 'content',
      'items', 'results', 'data', 'shows'
    ];
    
    const dataStr = JSON.stringify(data).toLowerCase();
    return animePatterns.some(pattern => dataStr.includes(pattern));
  }

  private extractAnimesFromApiResponse(data: any): Anime[] {
    const animes: Anime[] = [];
    
    try {
      // Stratégies d'extraction selon la structure API Crunchyroll
      this.extractFromStructure(data, animes);
      
      // Parcourir récursivement pour trouver les données
      this.extractRecursively(data, animes);
      
    } catch (error) {
      console.log('⚠️ Erreur extraction API:', (error as Error).message);
    }
    
    return animes;
  }

  private extractFromStructure(data: any, animes: Anime[]): void {
    // Structure 1: { data: { items: [...] } }
    if (data.data?.items && Array.isArray(data.data.items)) {
      data.data.items.forEach((item: any) => this.extractAnimeFromItem(item, animes));
    }
    
    // Structure 2: { items: [...] }
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item: any) => this.extractAnimeFromItem(item, animes));
    }
    
    // Structure 3: { results: [...] }
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((item: any) => this.extractAnimeFromItem(item, animes));
    }
    
    // Structure 4: array direct
    if (Array.isArray(data)) {
      data.forEach((item: any) => this.extractAnimeFromItem(item, animes));
    }
  }

  private extractRecursively(data: any, animes: Anime[], depth: number = 0): void {
    if (depth > 5 || !data || typeof data !== 'object') return;
    
    Object.values(data).forEach(value => {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (this.looksLikeAnime(item)) {
            this.extractAnimeFromItem(item, animes);
          } else {
            this.extractRecursively(item, animes, depth + 1);
          }
        });
      } else if (typeof value === 'object') {
        this.extractRecursively(value, animes, depth + 1);
      }
    });
  }

  private looksLikeAnime(item: any): boolean {
    if (!item || typeof item !== 'object') return false;
    
    const hasTitle = item.title || item.name || item.series_metadata?.title;
    const hasId = item.id || item.series_id || item.slug;
    const hasUrl = item.url || item.slug || (hasId && typeof hasId === 'string');
    
    return !!(hasTitle && (hasId || hasUrl));
  }

  private extractAnimeFromItem(item: any, animes: Anime[]): void {
    try {
      const title = item.title || 
                   item.name || 
                   item.series_metadata?.title ||
                   item.metadata?.title || '';
                   
      const id = item.id || 
                item.series_id || 
                item.slug || 
                item.external_id || '';
                
      const description = item.description || 
                         item.synopsis || 
                         item.series_metadata?.description ||
                         item.metadata?.description || '';
                         
      // URLs et images
      let url = item.url || '';
      if (!url && id) {
        url = `${this.baseUrl}/fr/series/${id}`;
      }
      
      const thumbnail = this.extractThumbnail(item);
      
      if (title && title.length > 2 && (id || url)) {
        const anime: Anime = {
          id: String(id),
          title: String(title).substring(0, 100),
          url: url,
          description: description ? String(description).substring(0, 300) : undefined,
          thumbnail: thumbnail || undefined
        };
        
        // Éviter les doublons
        if (!animes.find(a => a.title === anime.title || a.id === anime.id)) {
          animes.push(anime);
          console.log(`✅ API: Ajouté "${anime.title.substring(0, 40)}..."`);
        }
      }
    } catch (error) {
      // Ignore les erreurs d'extraction d'éléments individuels
    }
  }

  private extractThumbnail(item: any): string {
    const imageFields = [
      'thumbnail', 'poster', 'image', 'poster_tall', 'poster_wide',
      'images.poster_tall', 'images.poster_wide', 'images.thumbnail',
      'series_metadata.images.poster_tall', 'metadata.images.poster_tall'
    ];
    
    for (const field of imageFields) {
      const value = this.getNestedValue(item, field);
      if (value && typeof value === 'string' && value.startsWith('http')) {
        return value;
      }
      if (value && Array.isArray(value) && value.length > 0) {
        const firstImage = value[0];
        if (typeof firstImage === 'string' && firstImage.startsWith('http')) {
          return firstImage;
        }
        if (firstImage && firstImage.source && firstImage.source.startsWith('http')) {
          return firstImage.source;
        }
      }
    }
    
    return '';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private filterRelevantResults(animes: Anime[], query: string): Anime[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    
    return animes.filter(anime => {
      const titleLower = anime.title.toLowerCase();
      const descLower = (anime.description || '').toLowerCase();
      
      // Pertinence stricte
      const titleMatch = titleLower.includes(queryLower) ||
                        queryWords.some(word => titleLower.includes(word));
      
      const descMatch = queryWords.some(word => descLower.includes(word));
      
      return titleMatch || descMatch;
    }).slice(0, 10);
  }

  private async fallbackDomExtraction(page: Page, query: string): Promise<ScraperResult<Anime[]>> {
    console.log('🔄 Extraction DOM de secours...');
    
    const animes = await page.evaluate(() => {
      const results: any[] = [];
      const links = document.querySelectorAll('a[href*="/series/"]');
      
      links.forEach(link => {
        const linkEl = link as HTMLAnchorElement;
        const href = linkEl.href;
        const title = linkEl.textContent?.trim() || '';
        
        if (title && title.length > 2) {
          results.push({
            id: href.split('/').pop()?.split('?')[0] || '',
            title: title.substring(0, 100),
            url: href,
            thumbnail: '',
            description: ''
          });
        }
      });
      
      return results.slice(0, 5);
    });
    
    return { success: true, data: animes };
  }

  // Méthodes placeholder pour compatibilité
  async getAnimeDetails(animeUrl: string): Promise<ScraperResult<Anime>> {
    return { success: false, error: 'Non implémenté dans le scraper réseau' };
  }

  async getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>> {
    return { success: false, error: 'Non implémenté dans le scraper réseau' };
  }

  async getAnimeSeries(animeUrl: string): Promise<ScraperResult<AnimeSeries>> {
    return { success: false, error: 'Non implémenté dans le scraper réseau' };
  }
} 