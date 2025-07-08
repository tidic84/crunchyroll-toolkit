import { Page, BrowserContext } from 'playwright';
import { 
  Anime, 
  Episode, 
  AnimeSeries, 
  ScraperResult, 
  ScraperOptions 
} from '../types/anime.types';
import { BrowserManager } from '../utils/browser.utils';
import { ParserUtils } from '../utils/parser.utils';

/**
 * Scraper avancé utilisant les techniques les plus récentes (2024/2025)
 * pour contourner les protections anti-bot de Crunchyroll
 */
export class CrunchyrollAdvancedScraper {
  private browserManager: BrowserManager;
  private baseUrl = 'https://www.crunchyroll.com';
  private context?: BrowserContext;

  constructor(options: ScraperOptions = {}) {
    // Configuration optimisée pour contourner Cloudflare
    const enhancedOptions = {
      headless: false, // Mode visible pour éviter la détection
      timeout: 60000,
      maxRetries: 3,
      locale: 'fr-FR',
      ...options
    };
    this.browserManager = new BrowserManager(enhancedOptions);
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
    const page = await this.browserManager.getPage();
    this.context = page.context();
    
    // Configuration anti-détection avancée
    await this.setupAntiDetection(page);
    console.log('✅ Scraper avancé initialisé avec protection anti-détection');
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }

  /**
   * Configuration anti-détection basée sur les recherches récentes
   */
  private async setupAntiDetection(page: Page): Promise<void> {
    // 1. Masquer les propriétés WebDriver
    await page.addInitScript(() => {
      // Supprimer les traces d'automation
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // Masquer les propriétés Playwright/Chrome CDP
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      
      // Masquer playwright
      delete (window as any).__playwright;
      delete (window as any).__pw_manual;
      delete (window as any).__PW_inspect;
    });

    // 2. Simuler un comportement humain réaliste
    await page.addInitScript(() => {
      // Simuler des mouvements de souris
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type === 'mousemove') {
          // Ajouter un délai aléatoire pour simuler un comportement humain
          const humanListener = (event: Event) => {
            setTimeout(() => {
              if (typeof listener === 'function') {
                listener.call(this, event);
              }
            }, Math.random() * 10);
          };
          return originalAddEventListener.call(this, type, humanListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    });

    // 3. Configurer les headers HTTP réalistes
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    });

    // 4. Simuler une taille d'écran réaliste
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 }
    ];
    const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewportSize(randomViewport);
  }

  /**
   * Délai humanisé entre les actions
   */
  private async humanDelay(min: number = 1500, max: number = 4000): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulation de mouvements de souris aléatoires
   */
  private async randomMouseMovement(page: Page): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) return;

    const moves = Math.floor(Math.random() * 5) + 2; // 2-6 mouvements
    
    for (let i = 0; i < moves; i++) {
      const x = Math.random() * viewport.width;
      const y = Math.random() * viewport.height;
      
      await page.mouse.move(x, y, { 
        steps: Math.floor(Math.random() * 10) + 5 
      });
      await this.humanDelay(100, 500);
    }
  }

  /**
   * Navigation avec techniques anti-détection
   */
  private async navigateWithStealth(page: Page, url: string): Promise<void> {
    console.log(`🌐 Navigation furtive vers: ${url}`);
    
    // 1. Aller d'abord à la page d'accueil
    await page.goto(this.baseUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await this.humanDelay(2000, 4000);
    
    // 2. Simuler une activité humaine
    await this.randomMouseMovement(page);
    await page.keyboard.press('Tab'); // Simulation de navigation clavier
    await this.humanDelay(1000, 2000);
    
    // 3. Gérer les cookies/popups
    try {
      await page.click('button:has-text("Accept"), button:has-text("Accepter"), [data-testid="cookie-accept"], .cookie-accept', { timeout: 3000 });
      await this.humanDelay(1000, 2000);
    } catch {
      // Pas de popup trouvé
    }
    
    // 4. Navigation vers l'URL cible
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 5. Attendre et simuler du scrolling
    await this.humanDelay(3000, 6000);
    await this.simulateHumanScrolling(page);
  }

  /**
   * Simulation de scrolling humain
   */
  private async simulateHumanScrolling(page: Page): Promise<void> {
    const scrollSteps = Math.floor(Math.random() * 3) + 2; // 2-4 scrolls
    
    for (let i = 0; i < scrollSteps; i++) {
      const scrollY = Math.random() * 800 + 200; // 200-1000px
      await page.evaluate((y) => {
        window.scrollBy({ top: y, behavior: 'smooth' });
      }, scrollY);
      await this.humanDelay(800, 2000);
    }
    
    // Revenir en haut
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await this.humanDelay(1000, 2000);
  }

  async searchAnime(query: string): Promise<ScraperResult<Anime[]>> {
    try {
      const page = await this.browserManager.getPage();
      
      // Navigation vers la recherche avec techniques furtives
      const searchUrl = `${this.baseUrl}/fr/search?q=${encodeURIComponent(query)}`;
      await this.navigateWithStealth(page, searchUrl);
      
      console.log(`🔍 Recherche avancée de "${query}"...`);
      
      // Attendre spécifiquement les résultats de recherche
      await page.waitForLoadState('networkidle');
      await this.humanDelay(2000, 3000);
      
      // Vérifier qu'on est bien sur la page de recherche
      const currentUrl = page.url();
      if (!currentUrl.includes('/search')) {
        throw new Error('Navigation vers la page de recherche échouée');
      }
      
      // Attendre que les résultats de recherche apparaissent
      console.log('⏳ Attente des résultats de recherche...');
      
      // Stratégie 1: Attendre les éléments de contenu dynamique
      let contentLoaded = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        await this.humanDelay(2000, 3000);
        
        const hasContent = await page.evaluate(() => {
          // Vérifier s'il y a du contenu dynamique chargé
          const links = document.querySelectorAll('a[href*="/series/"]');
          return links.length > 0;
        });
        
        if (hasContent) {
          console.log(`✅ Contenu dynamique détecté après ${(attempt + 1) * 2.5}s`);
          contentLoaded = true;
          break;
        }
        
        console.log(`⏳ Tentative ${attempt + 1}/10 - Attente du contenu...`);
      }
      
      if (!contentLoaded) {
        console.log('⚠️ Timeout - Tentative d\'extraction sans contenu dynamique');
      }
      
      // Stratégie 2: Scroll pour déclencher le lazy loading
      console.log('📜 Scroll pour déclencher le chargement...');
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.humanDelay(1000, 2000);
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.humanDelay(1000, 2000);
      
      // Debug: Afficher l'URL actuelle et des infos sur la page
      console.log(`📍 URL actuelle: ${currentUrl}`);
      
      // Debug optionnel: Capture d'écran pour diagnostic
      try {
        await page.screenshot({ path: `debug-search-${Date.now()}.png`, fullPage: false });
        console.log('📸 Capture d\'écran sauvegardée pour debug');
      } catch {
        // Ignore si la capture échoue
      }
      
      // Extraction des données avec stratégies spécifiques aux résultats de recherche
      const animes = await page.evaluate((searchQuery) => {
        const results: any[] = [];
        const processedUrls = new Set<string>();
        
        console.log('🔍 Début extraction sur page:', window.location.href);
        console.log('📄 Titre page:', document.title);
        
        // Stratégie 1: Analyser tous les liens de séries présents
        const allSeriesLinks = document.querySelectorAll('a[href*="/series/"]');
        console.log(`🔗 Total liens séries trouvés: ${allSeriesLinks.length}`);
        
        // Debug: Afficher les premiers liens pour diagnostic
        allSeriesLinks.forEach((link, index) => {
          if (index < 5) {
            const href = (link as HTMLAnchorElement).href;
            const text = link.textContent?.trim() || 'Pas de texte';
            console.log(`   ${index + 1}. ${text.substring(0, 50)} -> ${href}`);
          }
        });
        
        // Stratégie 2: Chercher dans la zone de contenu principal
        const mainContentSelectors = [
          'main', '[role="main"]', '#main', '.main-content', 
          '[class*="search-results"]', '[class*="content-area"]',
          '[class*="browse"]', '[class*="catalog"]'
        ];
        
        let searchResultsContainer = null;
        for (const selector of mainContentSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            searchResultsContainer = element;
            console.log(`✅ Container trouvé: ${selector}`);
            break;
          }
        }
        
        // Si pas de container principal, utiliser tout le document
        if (!searchResultsContainer) {
          searchResultsContainer = document;
          console.log('⚠️ Utilisation du document complet');
        }
        
        // Stratégie 3: Filtrage intelligent des résultats
        // Exclure les liens de navigation, footer, header
        const excludePatterns = [
          'nav', 'header', 'footer', '.nav', '.header', '.footer',
          '[class*="navigation"]', '[class*="menu"]', '[class*="breadcrumb"]'
        ];
        
        const isInExcludedArea = (element: Element) => {
          for (const pattern of excludePatterns) {
            if (element.closest(pattern)) return true;
          }
          return false;
        };
        
        // Stratégie 4: Traitement intelligent de tous les liens de séries
        console.log(`🎯 Traitement intelligent des liens de séries...`);
        
        allSeriesLinks.forEach((link, index) => {
          const linkEl = link as HTMLAnchorElement;
          const href = linkEl.href;
          
          // Filtrer seulement les liens vers des séries
          if (!href || !href.includes('/series/')) return;
          if (processedUrls.has(href)) return;
          
          // Exclure les liens dans les zones de navigation
          if (isInExcludedArea(linkEl)) {
            console.log(`🚫 Exclu (navigation): ${linkEl.textContent?.trim()?.substring(0, 30)}`);
            return;
          }
          
          processedUrls.add(href);
          
          let title = '';
          let thumbnail = '';
          let description = '';
          
          // Méthode 1: Texte direct du lien
          title = linkEl.textContent?.trim() || '';
          
          // Méthode 2: Attributs du lien
          if (!title) {
            title = linkEl.getAttribute('aria-label') ||
                   linkEl.getAttribute('title') ||
                   linkEl.getAttribute('data-title') || '';
          }
          
          // Méthode 3: Chercher dans les éléments enfants
          if (!title) {
            const titleSelectors = [
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              '[class*="title"]', '[class*="name"]', '[class*="label"]',
              'span', 'div', 'p'
            ];
            
            for (const titleSel of titleSelectors) {
              const titleEl = linkEl.querySelector(titleSel);
              if (titleEl?.textContent?.trim()) {
                title = titleEl.textContent.trim();
                break;
              }
            }
          }
          
          // Méthode 4: Chercher dans le parent du lien
          if (!title) {
            const parent = linkEl.closest('[class*="card"], [class*="item"], [class*="result"]');
            if (parent) {
              const titleInParent = parent.querySelector('h1, h2, h3, h4, [class*="title"]');
              if (titleInParent?.textContent?.trim()) {
                title = titleInParent.textContent.trim();
              }
            }
          }
          
          // Extraction de l'image
          const imgEl = linkEl.querySelector('img') ||
                       linkEl.closest('[class*="card"], [class*="item"]')?.querySelector('img');
          if (imgEl) {
            thumbnail = imgEl.getAttribute('src') ||
                       imgEl.getAttribute('data-src') ||
                       imgEl.getAttribute('data-lazy-src') ||
                       imgEl.getAttribute('srcset')?.split(' ')[0] || '';
          }
          
          // Extraction de la description
          const descEl = linkEl.closest('[class*="card"], [class*="item"]')?.querySelector(
            '[class*="description"], [class*="synopsis"], [class*="summary"], p'
          );
          if (descEl) {
            description = descEl.textContent?.trim() || '';
          }
          
          // Validation et nettoyage
          if (title && title.length > 2 && href.includes('/series/')) {
            // Nettoyer le titre
            title = title.replace(/\s+/g, ' ').trim();
            
            // Extraire l'ID de l'URL
            const idMatch = href.match(/\/series\/([^\/\?]+)/);
            const id = idMatch ? idMatch[1] : href.split('/').pop()?.split('?')[0] || '';
            
            results.push({
              id,
              title: title.substring(0, 100),
              url: href,
              thumbnail: thumbnail || '',
              description: description.substring(0, 300)
            });
            
            console.log(`✅ Ajouté: ${title.substring(0, 50)}`);
          }
        });
        
        // Dédupliquer par titre et URL
        const uniqueResults = results.filter((result, index, self) => 
          index === self.findIndex(r => 
            r.title.toLowerCase() === result.title.toLowerCase() ||
            r.url === result.url
          )
        );
        
        console.log(`📊 Total trouvé: ${results.length}, après dédup: ${uniqueResults.length}`);
        
        return uniqueResults.slice(0, 15); // Augmenter la limite
      }, query);
      
      // Normaliser les URLs
      const normalizedAnimes = animes.map(anime => ({
        ...anime,
        url: ParserUtils.normalizeUrl(anime.url, this.baseUrl)
      }));
      
      console.log(`✅ ${normalizedAnimes.length} animé(s) trouvé(s) pour "${query}"`);
      
      return { success: true, data: normalizedAnimes };
      
    } catch (error) {
      console.error('❌ Erreur dans le scraper avancé:', error);
      return { 
        success: false, 
        error: `Erreur lors de la recherche: ${(error as Error).message}` 
      };
    }
  }

  async getAnimeDetails(animeUrl: string): Promise<ScraperResult<Anime>> {
    try {
      const page = await this.browserManager.getPage();
      const fullUrl = ParserUtils.normalizeUrl(animeUrl, this.baseUrl);
      
      console.log(`📋 Récupération des détails pour: ${fullUrl}`);
      await this.navigateWithStealth(page, fullUrl);
      
      const animeData = await page.evaluate(() => {
        // Stratégies d'extraction optimisées pour Crunchyroll 2024/2025
        const title = document.querySelector('h1')?.textContent?.trim() ||
                     document.querySelector('[class*="title"]')?.textContent?.trim() ||
                     document.title.split(' | ')[0] || '';
        
        const description = document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                           document.querySelector('[class*="description"] p')?.textContent?.trim() ||
                           document.querySelector('[class*="synopsis"]')?.textContent?.trim() || '';
        
        const thumbnail = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                         document.querySelector('[class*="hero"] img')?.getAttribute('src') ||
                         document.querySelector('[class*="poster"] img')?.getAttribute('src') || '';
        
        // Extraction des genres
        const genreElements = document.querySelectorAll('[class*="genre"], [class*="tag"], [data-testid*="genre"]');
        const genres: string[] = [];
        genreElements.forEach(el => {
          const genre = el.textContent?.trim();
          if (genre && genre.length > 1 && genre.length < 20) {
            genres.push(genre);
          }
        });
        
        return { title, description, thumbnail, genres: genres.length > 0 ? genres : undefined };
      });
      
      const anime: Anime = {
        id: ParserUtils.extractIdFromUrl(fullUrl),
        url: fullUrl,
        ...animeData,
        thumbnail: animeData.thumbnail || undefined
      };
      
      console.log(`✅ Détails récupérés pour: ${anime.title}`);
      return { success: true, data: anime };
      
    } catch (error) {
      console.error('❌ Erreur récupération détails:', error);
      return { 
        success: false, 
        error: `Erreur lors de la récupération des détails: ${(error as Error).message}` 
      };
    }
  }

  async getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>> {
    try {
      const page = await this.browserManager.getPage();
      const fullUrl = ParserUtils.normalizeUrl(animeUrl, this.baseUrl);
      const animeId = ParserUtils.extractIdFromUrl(fullUrl);
      
      console.log(`📺 Récupération des épisodes pour: ${fullUrl}`);
      await this.navigateWithStealth(page, fullUrl);
      
      // Essayer de cliquer sur l'onglet épisodes
      try {
        await page.click('button:has-text("Episodes"), a:has-text("Episodes"), [data-testid*="episode"]', { timeout: 5000 });
        await this.humanDelay(2000, 3000);
      } catch {
        // Pas d'onglet trouvé
      }
      
      // Scroll pour charger le contenu dynamique
      await this.simulateHumanScrolling(page);
      
      const episodes = await page.evaluate((animeId) => {
        const episodeList: any[] = [];
        
        // Sélecteurs pour les épisodes Crunchyroll 2024/2025
        const episodeSelectors = [
          'a[href*="/watch/"]',
          '[class*="episode"] a',
          '[data-testid*="episode"] a',
          '.content-card a[href*="/watch/"]'
        ];
        
        for (const selector of episodeSelectors) {
          const episodeLinks = document.querySelectorAll(selector);
          
          episodeLinks.forEach((link, index) => {
            const linkEl = link as HTMLAnchorElement;
            const href = linkEl.href;
            
            if (!href.includes('/watch/')) return;
            
            const title = linkEl.textContent?.trim() ||
                         linkEl.querySelector('[class*="title"]')?.textContent?.trim() ||
                         `Episode ${index + 1}`;
            
            const img = linkEl.querySelector('img') ||
                       linkEl.closest('[class*="card"]')?.querySelector('img');
            const thumbnail = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
            
            const episodeNumber = title.match(/\b(\d+)\b/)?.[1] ? 
                                 parseInt(title.match(/\b(\d+)\b/)![1], 10) : 
                                 index + 1;
            
            episodeList.push({
              id: href.split('/').pop()?.split('?')[0] || `${animeId}-ep${episodeNumber}`,
              animeId,
              title,
              episodeNumber,
              thumbnail,
              url: href
            });
          });
        }
        
        // Trier par numéro d'épisode et dédupliquer
        const uniqueEpisodes = episodeList.filter((ep, index, self) => 
          index === self.findIndex(e => e.episodeNumber === ep.episodeNumber)
        );
        
        return uniqueEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
      }, animeId);
      
      // Normaliser les URLs
      const normalizedEpisodes = episodes.map(episode => ({
        ...episode,
        url: ParserUtils.normalizeUrl(episode.url, this.baseUrl)
      }));
      
      console.log(`✅ ${normalizedEpisodes.length} épisode(s) récupéré(s)`);
      return { success: true, data: normalizedEpisodes };
      
    } catch (error) {
      console.error('❌ Erreur récupération épisodes:', error);
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

      console.log(`✅ Série complète: ${animeSeries.title} (${animeSeries.episodeCount} épisodes)`);
      return { success: true, data: animeSeries };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la récupération de la série: ${(error as Error).message}`
      };
    }
  }
} 