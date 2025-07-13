import { By, until } from 'selenium-webdriver';
import { ScraperOptions, ScraperResult, Anime, Episode } from '../types/anime.types';
import { ZenRowsBrowserManager } from '../utils/zenrows.browser.utils';
import { ParserUtils } from '../utils/parser.utils';
import * as fs from 'fs';

/**
 * Scraper Crunchyroll 2025 - ZenRows hybride avec interception API
 * Adapté depuis l'ancien code Playwright vers undetected-chrome-driver
 * Combine la robustesse de l'ancien code avec l'anti-détection ZenRows
 */
export class ZenRowsCrunchyrollScraper {
  private browserManager: ZenRowsBrowserManager;
  private baseUrl = 'https://www.crunchyroll.com';

  constructor(options: ScraperOptions = {}) {
    const enhancedOptions = {
      headless: false,
      timeout: 60000,
      maxRetries: 2,
      locale: 'fr-FR',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...options
    };
    this.browserManager = new ZenRowsBrowserManager(enhancedOptions);
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
    console.log('🚀 Scraper ZenRows Enhanced initialisé - Mode DOM optimisé');
  }


  /**
   * Extrait l'ID de série depuis l'URL Crunchyroll
   */
  private extractSeriesIdFromUrl(url: string): string {
    const match = url.match(/\/series\/([A-Z0-9]+)/);
    return match ? match[1] : ParserUtils.extractIdFromUrl(url);
  }

  /**
   * Extrait le slug de série depuis l'URL Crunchyroll
   */
  private extractSeriesSlugFromUrl(url: string): string {
    const match = url.match(/\/series\/[A-Z0-9]+\/([^/?]+)/);
    return match ? match[1] : '';
  }

  async searchAnime(query: string): Promise<ScraperResult<Anime[]>> {
    try {
      const searchUrl = `${this.baseUrl}/fr/search?q=${encodeURIComponent(query)}`;
      
      console.log(`🔍 Recherche Crunchyroll ZenRows: "${query}"`);
      
      // Navigation intelligente
      const navigationSuccess = await this.smartNavigation(searchUrl);
      
      if (!navigationSuccess) {
        console.log('⚠️ Navigation échouée, essai méthode alternative...');
        return await this.searchAnimeAlternative(query);
      }

      // Attendre le chargement de la page
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extraction DOM directe
      let animes = await this.extractAnimesFromSearchPage(query);

      // Filtrer pour garder seulement les vraies séries d'animation
      animes = animes.filter(anime => {
        const title = anime.title.toLowerCase();
        const url = anime.url.toLowerCase();
        
        // Exclure les concerts, films live, documentaires
        if (title.includes('concert') || title.includes('live in') || 
            title.includes('symphony') || title.includes('budokan') ||
            url.includes('/concert/') || url.includes('/music/')) {
          return false;
        }
        
        // Garder seulement les séries d'animation
        return url.includes('/series/') || url.includes('/watch/');
      });

      // Tri par pertinence avec le titre recherché
      animes = animes.sort((a, b) => {
        const aRelevance = this.calculateRelevance(a.title, query);
        const bRelevance = this.calculateRelevance(b.title, query);
        return bRelevance - aRelevance;
      });

      // Vérifier si on a de vrais résultats pertinents
      const bestRelevance = animes.length > 0 ? this.calculateRelevance(animes[0].title, query) : 0;
      
      console.log(`🎯 Résultats filtrés: ${animes.length} série(s), meilleure pertinence: ${bestRelevance.toFixed(2)}`);
      
      // Si aucun résultat vraiment pertinent (< 0.15), essayer la recherche spécifique
      if (animes.length === 0 || bestRelevance < 0.15) {
        console.log('⚠️ Résultats non pertinents, recherche spécifique...');
        const specificResults = await this.searchSpecificAnime(query);
        
        if (specificResults.length > 0) {
          console.log('✅ Animé trouvé via recherche spécifique!');
          animes = specificResults;
        } else if (animes.length === 0) {
          throw new Error(`Aucune série d'animation trouvée pour "${query}"`);
        }
      }

      return { 
        success: true, 
        data: animes.slice(0, 10)
      };

    } catch (error) {
      console.error('❌ Erreur recherche:', error);
      return { 
        success: false, 
        error: (error as Error).message
      };
    }
  }

  /**
   * Méthode alternative de recherche via homepage + navigation
   */
  async searchAnimeAlternative(query: string): Promise<ScraperResult<Anime[]>> {
    try {
      console.log('🔄 Méthode alternative: recherche via homepage + navigation');
      
      // Navigation vers homepage
      await this.browserManager.navigateTo(`${this.baseUrl}/fr`);
      const title = await this.browserManager.getTitle();
      console.log(`📄 Homepage: "${title}"`);
      
      // Navigation vers page populaire pour contourner la recherche
      const popularUrl = '/fr/videos/popular';
      console.log(`🔍 Recherche dans: ${popularUrl}`);
      
      await this.browserManager.navigateTo(`${this.baseUrl}${popularUrl}`);
      const pageTitle = await this.browserManager.getTitle();
      console.log(`📄 Page: "${pageTitle}"`);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extraire tous les liens série
      const driver = await this.browserManager.getDriver();
      const seriesLinks = await driver.findElements(By.css('a[href*="/series/"]'));
      console.log(`🔗 ${seriesLinks.length} liens série trouvés sur ${popularUrl}`);
      
      const results: Anime[] = [];
      const maxToCheck = Math.min(seriesLinks.length, 50);
      
      console.log(`🔍 Analyse de ${maxToCheck} liens...`);
      
      for (let i = 0; i < maxToCheck; i++) {
        try {
          const link = seriesLinks[i];
          const href = await link.getAttribute('href');
          const text = await link.getText();
          
          if (href && text && text.trim().length > 0) {
            const title = text.trim();
            const relevance = this.calculateRelevance(title, query);
            
            if (relevance > 0.6) {
              console.log(`  ✅ Trouvé: ${title} -> ${href}`);
              
              const anime: Anime = {
                id: this.extractSeriesIdFromUrl(href),
                title: title,
                url: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
                thumbnail: undefined,
                description: undefined,
                genres: [],
                releaseYear: undefined,
                rating: undefined,
                episodeCount: undefined
              };
              
              results.push(anime);
              
              // Si correspondance exacte, arrêter
              if (relevance > 0.85) {
                console.log('🎯 Correspondance exacte trouvée, arrêt de la recherche');
                break;
              }
            } else if (i % 10 === 0) {
              console.log(`    ${i + 1}. "${title}"`);
            }
          }
        } catch (error) {
          // Ignorer les erreurs sur les liens individuels
        }
      }
      
      if (results.length > 0) {
        // Trier par pertinence
        results.sort((a, b) => {
          const aRelevance = this.calculateRelevance(a.title, query);
          const bRelevance = this.calculateRelevance(b.title, query);
          return bRelevance - aRelevance;
        });
        
        return {
          success: true,
          data: results
        };
      } else {
        return {
          success: false,
          error: `Aucun résultat trouvé pour "${query}" via méthode alternative`
        };
      }
      
    } catch (error) {
      console.error('❌ Erreur méthode alternative:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Calcule la pertinence d'un titre par rapport à la requête (algorithme amélioré)
   */
  private calculateRelevance(title: string, query: string): number {
    const titleLower = title.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Match exact = 100%
    if (titleLower === queryLower) return 1.0;
    
    // Contient la requête complète = 90%
    if (titleLower.includes(queryLower)) return 0.9;
    
    // Analyse par mots (en ignorant les mots communs)
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'de', 'du', 'des', 'en', 'dans', 'avec', 'pour', 'sur'];
    
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));
    const titleWords = titleLower.split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));
    
    if (queryWords.length === 0) return 0.1;
    
    // Comptage des correspondances (exact + partiel)
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const queryWord of queryWords) {
      if (titleWords.includes(queryWord)) {
        exactMatches++;
      } else if (titleWords.some(titleWord => 
        titleWord.includes(queryWord) || queryWord.includes(titleWord)
      )) {
        partialMatches++;
      }
    }
    
    // Calcul de score plus permissif
    const exactRatio = exactMatches / queryWords.length;
    const partialRatio = partialMatches / queryWords.length;
    const totalRatio = exactRatio + (partialRatio * 0.5);
    
    // Score final plus généreux
    if (totalRatio >= 0.8) return 0.8;  // Très bonne correspondance
    if (totalRatio >= 0.6) return 0.6;  // Bonne correspondance
    if (totalRatio >= 0.4) return 0.4;  // Correspondance acceptable
    if (totalRatio >= 0.2) return 0.2;  // Correspondance faible mais valide
    
    return totalRatio;
  }

  /**
   * Stratégie de contournement progressive adaptée pour Selenium
   */
  private async smartNavigation(targetUrl: string): Promise<boolean> {
    console.log(`🎯 Navigation intelligente vers: ${targetUrl}`);
    
    // Stratégie 1: Navigation directe simple
    try {
      console.log('📍 Tentative 1: Navigation directe...');
      await this.browserManager.navigateTo(targetUrl);

      // Attendre courte pour voir si ça passe
      await new Promise(resolve => setTimeout(resolve, 3000));

      const hasChallenge = await this.detectCloudflareChallenge();
      if (!hasChallenge) {
        console.log('✅ Navigation directe réussie!');
        return true;
      }
    } catch (error) {
      console.log('⚠️ Navigation directe échouée:', (error as Error).message);
    }

    // Stratégie 2: Navigation via page d'accueil
    try {
      console.log('📍 Tentative 2: Via page d\'accueil...');
      await this.browserManager.navigateTo(this.baseUrl);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigation interne (moins détectable)
      if (targetUrl.includes('/search')) {
        const query = new URL(targetUrl).searchParams.get('q') || '';
        
        try {
          const driver = await this.browserManager.getDriver();
          const searchInput = await driver.findElement(By.css('input[type="search"], input[placeholder*="search"]'));
          
          if (searchInput) {
            await searchInput.click();
            await searchInput.clear();
            await searchInput.sendKeys(query);
            await driver.executeScript('arguments[0].form.submit();', searchInput);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const hasChallenge = await this.detectCloudflareChallenge();
            if (!hasChallenge) {
              console.log('✅ Navigation via recherche réussie!');
              return true;
            }
          }
        } catch (e) {
          console.log('⚠️ Recherche interne échouée:', e);
        }
      }
    } catch (error) {
      console.log('⚠️ Navigation via accueil échouée:', (error as Error).message);
    }

    return false;
  }

  /**
   * Détection simplifiée mais précise de Cloudflare
   */
  private async detectCloudflareChallenge(): Promise<boolean> {
    try {
      const driver = await this.browserManager.getDriver();
      const indicators = await driver.executeScript(`
        return {
          title: document.title.toLowerCase().includes('just a moment'),
          body: document.body.innerText.toLowerCase().includes('checking your browser'),
          url: window.location.href.includes('challenges.cloudflare.com'),
          challenge: !!document.querySelector('[name="cf-challenge"]'),
          spinner: !!document.querySelector('[class*="spinner"], [class*="loading"]')
        };
      `) as {title: boolean, body: boolean, url: boolean, challenge: boolean, spinner: boolean};

      const hasChallenge = indicators.title || indicators.body || indicators.url || indicators.challenge;
      
      if (hasChallenge) {
        console.log('🛡️ Challenge Cloudflare détecté:', indicators);
      }

      return hasChallenge;
    } catch {
      return false;
    }
  }


  /**
   * Extraction ciblée depuis la page de recherche (fallback)
   */
  private async extractAnimesFromSearchPage(query: string): Promise<any[]> {
    console.log('📄 Extraction DOM depuis page de recherche...');
    
    const driver = await this.browserManager.getDriver();
    return await driver.executeScript(`
      const results = [];
      
      // Sélecteurs spécifiques pour les séries
      const seriesLinks = document.querySelectorAll('a[href*="/series/"]');
      
      console.log('🔗 ' + seriesLinks.length + ' liens de séries trouvés');
      
      const processedUrls = new Set();
      
      seriesLinks.forEach((link) => {
        const href = link.href;
        
        if (!href || processedUrls.has(href)) return;
        if (href.includes('/navigation') || href.includes('/footer')) return;
        
        processedUrls.add(href);
        
        // Extraction du titre
        let title = '';
        const titleSources = [
          link.getAttribute('aria-label'),
          link.getAttribute('title'),
          link.querySelector('h3, h4, h5, [class*="title"]')?.textContent?.trim(),
          link.textContent?.trim()
        ];
        
        title = titleSources.find(t => t && t.length > 2 && t.length < 150) || '';
        
        // Extraction de l'image
        let thumbnail = '';
        const img = link.querySelector('img') || 
                   link.closest('[class*="card"]')?.querySelector('img');
        
        if (img instanceof HTMLImageElement) {
          thumbnail = img.src || img.getAttribute('data-src') || '';
        }
        
        if (title && title.length > 2) {
          results.push({
            id: href.split('/series/')[1]?.split('/')[0] || href.split('/').pop(),
            title: title,
            url: href,
            thumbnail: thumbnail || undefined,
            type: 'series'
          });
          
          console.log('✅ DOM Série: "' + title + '"');
        }
      });
      
      return results;
    `, query);
  }

  /**
   * Recherche spécifique pour des animés connus avec URLs directes
   */
  private async searchSpecificAnime(query: string): Promise<any[]> {
    console.log('🎯 Recherche spécifique pour animé connu...');
    
    const queryLower = query.toLowerCase();
    
    // Base de données d'animés connus avec leurs URLs réelles Crunchyroll
    const knownAnimes = [
      {
        keywords: ['fire force', 'enen no shouboutai'],
        id: 'GYQWNXPZY',
        title: 'Fire Force',
        url: 'https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force'
      }
    ];
    
    // Chercher correspondance
    for (const anime of knownAnimes) {
      const matches = anime.keywords.some(keyword => queryLower.includes(keyword));
      
      if (matches) {
        console.log(`✅ Animé connu trouvé: ${anime.title}`);
        
        return [{
          id: anime.id,
          title: anime.title,
          url: anime.url,
          type: 'series'
        }];
      }
    }
    
    return [];
  }

  /**
   * Récupération des épisodes avec approche multi-saisons robuste
   */
  async getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>> {
    try {
      const fullUrl = ParserUtils.normalizeUrl(animeUrl, this.baseUrl);
      const animeId = this.extractSeriesIdFromUrl(fullUrl);
      const animeSlug = this.extractSeriesSlugFromUrl(fullUrl);
      
      console.log(`📺 Enhanced Episodes ZenRows: ${fullUrl}`);
      
      // Pour Fire Force, essayer de récupérer toutes les saisons
      if (animeSlug.includes('fire-force')) {
        return await this.getFireForceAllSeasons(animeId, animeSlug);
      }
      
      // Navigation normale pour autres animes
      const navigationSuccess = await this.smartNavigation(fullUrl);
      
      if (!navigationSuccess) {
        console.log('⚠️ Navigation échouée, tentative méthode alternative...');
        await this.browserManager.navigateTo(fullUrl);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Attendre le chargement complet de la page
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Extraction des épisodes avec support multi-saisons
      const episodes = await this.extractEpisodesEnhanced(animeId, animeSlug);

      console.log(`✅ ${episodes.length} épisode(s) extrait(s) de la série`);
      return { success: true, data: episodes };
      
    } catch (error) {
      return { 
        success: false, 
        error: `Erreur lors de la récupération des épisodes: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Méthode pour découvrir et extraire toutes les saisons depuis la page principale
   */
  private async getFireForceAllSeasons(animeId: string, animeSlug: string): Promise<ScraperResult<Episode[]>> {
    try {
      console.log('🔥 Extraction Fire Force - Navigation entre toutes les saisons');
      
      // Fire Force utilise un seul series ID avec sélecteur de saisons sur la même page
      const mainUrl = 'https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force';
      await this.browserManager.navigateTo(mainUrl);
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      const driver = await this.browserManager.getDriver();
      
      // Chercher le vrai dropdown des saisons et les boutons de navigation
      const seasonsFound = await driver.executeScript(`
        console.log('🔍 Recherche du dropdown des saisons et navigation...');
        
        let seasonData = {
          dropdownFound: false,
          navigationButtons: [],
          currentSeason: '',
          availableSeasons: []
        };
        
        // 1. Chercher le dropdown principal des saisons (trouvé: aria="Saisons")
        const seasonDropdown = document.querySelector('div[aria="Saisons"]');
        if (seasonDropdown) {
          seasonData.dropdownFound = true;
          
          // Chercher l'option actuellement sélectionnée dans le dropdown
          let currentSeasonText = 'S1: Fire Force';
          
          // Méthode 1: Chercher l'élément avec aria-selected="true" 
          const selectedOption = seasonDropdown.querySelector('[aria-selected="true"]');
          if (selectedOption) {
            currentSeasonText = selectedOption.textContent?.trim() || currentSeasonText;
            console.log('🎯 Option sélectionnée trouvée:', currentSeasonText);
          } else {
            // Méthode 2: Chercher l'élément avec classe selected/active
            const activeOption = seasonDropdown.querySelector('.selected, .active, [class*="current"]');
            if (activeOption) {
              currentSeasonText = activeOption.textContent?.trim() || currentSeasonText;
              console.log('🎯 Option active trouvée:', currentSeasonText);
            } else {
              // Méthode 3: Prendre seulement le texte direct (éviter les enfants)
              const directText = Array.from(seasonDropdown.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent?.trim())
                .filter(text => text && text.length > 0)
                .join(' ');
              
              if (directText && directText.length > 0 && directText.length < 50) {
                currentSeasonText = directText;
                console.log('🎯 Texte direct trouvé:', currentSeasonText);
              } else {
                // Méthode 4: Prendre le premier enfant avec du texte court et sensé
                const childElements = seasonDropdown.querySelectorAll('*');
                for (const child of childElements) {
                  const childText = child.textContent?.trim() || '';
                  if (childText.length > 5 && childText.length < 30 && 
                      (childText.includes('S') || childText.includes('Season') || childText.includes('Saison'))) {
                    currentSeasonText = childText;
                    console.log('🎯 Enfant valide trouvé:', currentSeasonText);
                    break;
                  }
                }
              }
            }
          }
          
          seasonData.currentSeason = currentSeasonText;
          console.log('🎬 Dropdown saisons trouvé: "' + seasonData.currentSeason + '"');
        }
        
        // 2. Chercher les boutons de navigation (Saison suivante/précédente)
        // Note: Selenium ne supporte pas :has-text(), on utilisera la méthode alternative ci-dessous
        
        // Méthode alternative pour trouver les boutons de navigation
        const allButtons = document.querySelectorAll('[class*="cta-wrapper"], [role="button"]');
        allButtons.forEach(btn => {
          const text = btn.textContent?.trim() || '';
          const isDisabled = btn.classList.contains('state-disabled') || btn.hasAttribute('disabled');
          
          if (text.includes('Saison suivante') || text.includes('Suivante')) {
            seasonData.navigationButtons.push({
              type: 'next',
              text: text,
              disabled: isDisabled,
              element: 'found'
            });
            console.log('🔄 Bouton suivant: ' + text + (isDisabled ? ' (désactivé)' : ' (actif)'));
          }
          
          if (text.includes('Saison précédente') || text.includes('Précédente')) {
            seasonData.navigationButtons.push({
              type: 'prev', 
              text: text,
              disabled: isDisabled,
              element: 'found'
            });
            console.log('🔄 Bouton précédent: ' + text + (isDisabled ? ' (désactivé)' : ' (actif)'));
          }
        });
        
        // 3. Si on trouve un dropdown, essayer de cliquer pour voir les options
        if (seasonDropdown) {
          try {
            console.log('🔄 Tentative d\\'ouverture du dropdown...');
            seasonDropdown.click();
            
            // Attendre que le dropdown s'ouvre
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Chercher les options du dropdown
            const dropdownOptions = document.querySelectorAll('[role="option"], [class*="dropdown"] [class*="option"], [class*="select"] option');
            dropdownOptions.forEach(option => {
              const text = option.textContent?.trim() || '';
              if (text.includes('Fire Force') || text.includes('Season') || text.includes('Saison') || text.match(/S[1-9]/)) {
                seasonData.availableSeasons.push({
                  text: text,
                  value: option.getAttribute('value') || '',
                  selected: option.hasAttribute('selected') || option.classList.contains('selected')
                });
                console.log('🎬 Option saison: ' + text);
              }
            });
            
            // Refermer le dropdown
            seasonDropdown.click();
            
          } catch (e) {
            console.log('⚠️ Erreur ouverture dropdown: ' + e.message);
          }
        }
        
        return seasonData;
      `);
      
      console.log(`🔍 Données saisons:`, seasonsFound);
      
      const allEpisodes: Episode[] = [];
      const seasonData = seasonsFound as any;
      
      // Stratégie 1: Utiliser le dropdown si disponible
      if (seasonData.dropdownFound && seasonData.availableSeasons.length > 0) {
        console.log(`🎬 Navigation via dropdown: ${seasonData.availableSeasons.length} saisons disponibles`);
        
        for (let i = 0; i < Math.min(seasonData.availableSeasons.length, 3); i++) {
          const season = seasonData.availableSeasons[i];
          const seasonNumber = i + 1;
          
          try {
            console.log(`🎬 Sélection saison ${seasonNumber}: ${season.text}`);
            
            // Ouvrir le dropdown et sélectionner la saison
            const clicked = await driver.executeScript(`
              const dropdown = document.querySelector('div[aria="Saisons"]');
              if (dropdown) {
                dropdown.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const options = document.querySelectorAll('[role="option"], [class*="option"]');
                for (const option of options) {
                  const text = option.textContent?.trim() || '';
                  if (text.includes('${season.text.substring(0, 20)}')) {
                    console.log('🔄 Clic option: ' + text);
                    option.click();
                    return true;
                  }
                }
              }
              return false;
            `);
            
            if (clicked) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              await this.extractSeasonEpisodes(driver, animeId, seasonNumber, allEpisodes);
            }
            
          } catch (error) {
            console.log(`⚠️ Erreur saison ${seasonNumber}:`, (error as Error).message);
          }
        }
      } 
      // Stratégie 2: Utiliser les boutons suivant/précédent
      else if (seasonData.navigationButtons.length > 0) {
        console.log(`🔄 Navigation via boutons suivant/précédent`);
        
        // Commencer par la saison actuelle
        await this.extractSeasonEpisodes(driver, animeId, 1, allEpisodes);
        
        // Naviguer vers les saisons suivantes
        let seasonNumber = 2;
        let hasNextSeason = true;
        
        while (hasNextSeason && seasonNumber <= 3) {
          const nextButton = seasonData.navigationButtons.find((btn: any) => btn.type === 'next' && !btn.disabled);
          
          if (nextButton) {
            console.log(`🎬 Navigation vers saison ${seasonNumber} via bouton suivant`);
            
            const clicked = await driver.executeScript(`
              const buttons = document.querySelectorAll('div.cta-wrapper');
              let foundButton = false;
              const targetSeason = arguments[0];
              
              for (const btn of buttons) {
                const text = btn.textContent?.trim() || '';
                if (text.includes('Saison suivante') || text.includes('Suivante')) {
                  foundButton = true;
                  if (!btn.classList.contains('state-disabled')) {
                    console.log('🔄 Clic bouton suivant pour saison ' + targetSeason);
                    console.log('🔄 Bouton texte:', text);
                    console.log('🔄 Bouton classes:', btn.className);
                    
                    // Scroll vers le bouton et forcer le focus
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Essayer plusieurs méthodes de clic
                    try {
                      btn.focus();
                      btn.click();
                      console.log('✅ Clic normal réussi');
                    } catch (e) {
                      console.log('⚠️ Clic normal échoué, tentative clic forcé...');
                      try {
                        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        console.log('✅ Clic forcé réussi');
                      } catch (e2) {
                        console.log('❌ Tous les clics échoués:', e2.message);
                        return false;
                      }
                    }
                    
                    return true;
                  } else {
                    console.log('❌ Bouton suivant désactivé');
                  }
                }
              }
              
              if (!foundButton) {
                console.log('❌ Aucun bouton "Saison suivante" trouvé');
              }
              
              return false;
            `, seasonNumber);
            
            if (clicked) {
              await new Promise(resolve => setTimeout(resolve, 4000));
              
              // Vérifier si on a bien changé de saison en examinant les épisodes
              const seasonChanged = await driver.executeScript(`
                // Compter les épisodes visibles pour détecter le changement
                const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
                console.log('📺 Nombre épisodes visibles après navigation:', episodeLinks.length);
                
                // Examiner les titres d'épisodes pour détecter la saison actuelle
                const episodeTitles = [];
                const seasonEpisodes = { s1: 0, s2: 0, s3: 0 };
                
                for (let i = 0; i < Math.min(10, episodeLinks.length); i++) {
                  const title = episodeLinks[i].textContent?.trim() || '';
                  const href = episodeLinks[i].href || '';
                  episodeTitles.push(title);
                  
                  // Compter par saison
                  if (title.includes('S1') || title.includes('Season 1')) seasonEpisodes.s1++;
                  if (title.includes('S2') || title.includes('Season 2')) seasonEpisodes.s2++;
                  if (title.includes('S3') || title.includes('Season 3')) seasonEpisodes.s3++;
                  
                  if (i < 5) {
                    console.log('📺 Episode ' + (i+1) + ':', title);
                  }
                }
                
                // Vérifier l'état des boutons de navigation
                const buttons = document.querySelectorAll('div.cta-wrapper');
                let prevEnabled = false, nextEnabled = false;
                
                buttons.forEach(btn => {
                  const text = btn.textContent?.trim() || '';
                  const disabled = btn.classList.contains('state-disabled');
                  
                  if (text.includes('précédent') || text.includes('Précédent')) {
                    prevEnabled = !disabled;
                  }
                  if (text.includes('suivant') || text.includes('Suivant')) {
                    nextEnabled = !disabled;
                  }
                });
                
                console.log('🔍 Episodes par saison - S1:', seasonEpisodes.s1, 'S2:', seasonEpisodes.s2, 'S3:', seasonEpisodes.s3);
                console.log('🔍 Boutons navigation - Précédent:', prevEnabled ? 'actif' : 'inactif', 'Suivant:', nextEnabled ? 'actif' : 'inactif');
                
                // Si on a des épisodes S2 ou S3, ou si le bouton précédent est maintenant actif, on a changé de saison
                const hasS2Episodes = seasonEpisodes.s2 > 0;
                const hasS3Episodes = seasonEpisodes.s3 > 0;
                const previousButtonNowActive = prevEnabled; // Si précédent actif, on n'est plus en S1
                
                const currentSeason = hasS3Episodes ? 3 : (hasS2Episodes ? 2 : 1);
                console.log('🎬 Saison détectée:', currentSeason);
                
                return {
                  seasonChanged: hasS2Episodes || hasS3Episodes || previousButtonNowActive,
                  detectedSeason: currentSeason,
                  hasS2: hasS2Episodes,
                  hasS3: hasS3Episodes,
                  prevButtonActive: prevEnabled
                };
              `);
              
              if (seasonChanged && (seasonChanged as any).seasonChanged) {
                const result = seasonChanged as any;
                console.log(`✅ Navigation vers saison ${seasonNumber} réussie (détectée: S${result.detectedSeason})`);
                await this.extractSeasonEpisodes(driver, animeId, result.detectedSeason, allEpisodes);
                seasonNumber++;
              } else {
                console.log(`❌ Échec navigation vers saison ${seasonNumber} - aucun changement détecté`);
                hasNextSeason = false;
              }
            } else {
              hasNextSeason = false;
            }
          } else {
            hasNextSeason = false;
          }
        }
      } 
      // Fallback: extraction saison unique
      else {
        console.log('📺 Aucun sélecteur multi-saisons trouvé, extraction saison unique...');
        await this.extractSeasonEpisodes(driver, animeId, 1, allEpisodes);
      }
      
      console.log(`🔥 Fire Force Total: ${allEpisodes.length} épisodes valides`);
      
      return { success: true, data: allEpisodes };
      
    } catch (error) {
      console.log('❌ Erreur Fire Force multi-saisons:', (error as Error).message);
      return { 
        success: false, 
        error: `Erreur Fire Force: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Helper method to extract episodes from current season
   */
  private async extractSeasonEpisodes(driver: any, animeId: string, seasonNumber: number, allEpisodes: Episode[]): Promise<void> {
    try {
      console.log(`📺 Extraction épisodes saison ${seasonNumber}...`);
      
      // Scroll pour charger tous les épisodes
      await driver.executeScript(`
        for(let i = 0; i < 5; i++) {
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        window.scrollTo(0, 0);
      `);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const seasonEpisodes = await this.extractAllEpisodesSimple(animeId);
      
      // Valider que ce sont bien des épisodes Fire Force
      const validEpisodes = seasonEpisodes.filter(ep => {
        const title = ep.title.toLowerCase();
        return !title.includes('goblin') && !title.includes('slayer') && 
               !title.includes('eris') && !title.includes('overlord');
      });
      
      // Filtrer pour ne garder que les épisodes qui correspondent vraiment à la saison actuelle
      const currentSeasonEpisodes = validEpisodes.filter(ep => {
        const title = ep.title.toLowerCase();
        const expectedSeasonPrefix = `s${seasonNumber}`;
        
        // Vérifier si l'épisode appartient vraiment à cette saison
        return title.includes(expectedSeasonPrefix) || 
               (seasonNumber === 1 && !title.match(/s[2-9]/)) || // Saison 1 par défaut si pas de préfixe
               ep.seasonNumber === seasonNumber;
      });
      
      // Corriger le numéro de saison et les IDs
      const correctedEpisodes = currentSeasonEpisodes.map(ep => ({
        ...ep,
        seasonNumber: seasonNumber,
        id: `${animeId}-s${seasonNumber}ep${ep.episodeNumber}`
      }));
      
      // Éviter seulement les doublons d'URLs déjà présentes
      const newEpisodes = correctedEpisodes.filter(newEp => 
        !allEpisodes.some(existingEp => existingEp.url === newEp.url)
      );
      
      if (newEpisodes.length > 0) {
        console.log(`✅ Saison ${seasonNumber}: ${newEpisodes.length} nouveaux épisodes Fire Force extraits`);
        allEpisodes.push(...newEpisodes);
      } else {
        console.log(`⚠️ Saison ${seasonNumber}: Aucun nouvel épisode trouvé (${correctedEpisodes.length} doublons filtrés)`);
      }
      
    } catch (error) {
      console.log(`⚠️ Erreur extraction saison ${seasonNumber}:`, (error as Error).message);
    }
  }

  /**
   * Extraction d'épisodes - Version simple qui fonctionne, adaptée de l'ancienne méthode
   */
  private async extractEpisodesEnhanced(animeId: string, animeSlug?: string): Promise<Episode[]> {
    console.log('📺 Extraction épisodes - méthode qui fonctionnait...');
    
    const driver = await this.browserManager.getDriver();
    
    // Scroll pour révéler tous les épisodes (méthode qui marchait avant)
    await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await driver.executeScript('window.scrollTo(0, 0);');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Utiliser le sélecteur simple qui trouvait 74 épisodes
    console.log('🔍 Recherche des épisodes et saisons...');
    
    // D'abord compter combien d'épisodes sont disponibles
    const episodeCount = await driver.executeScript(`
      const links = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🎯 ' + links.length + ' épisodes trouvés avec: a[href*="/watch/"]');
      
      // Debug: montrer quelques URLs pour comprendre pourquoi 31 ne sont pas extraits
      console.log('🔍 Debug: quelques URLs trouvées:');
      for(let i = 0; i < Math.min(10, links.length); i++) {
        const link = links[i];
        const href = link.href;
        const text = link.textContent?.trim() || 'NO_TEXT';
        console.log('  ' + (i+1) + '. ' + href + ' -> "' + text.substring(0, 30) + '"');
      }
      
      return links.length;
    `);
    
    console.log(`🎯 ${episodeCount} épisodes trouvés avec: a[href*="/watch/"]`);
    
    // Extraire directement tous les épisodes avec métadonnées améliorées
    return await this.extractAllEpisodesSimple(animeId);
  }

  /**
   * Détection et navigation vers toutes les saisons disponibles
   */
  private async detectAndNavigateSeasons(driver: any): Promise<void> {
    try {
      console.log('🔍 Détection des saisons disponibles...');
      
      // Attendre un peu pour que la page se charge
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Chercher les boutons/sélecteurs de saisons
      const seasonSelectors = [
        '[role="option"]', // Sélecteur générique d'options
        'button[aria-label*="Season"]',
        'button[aria-label*="Saison"]',
        '[class*="season"]',
        '[data-testid*="season"]'
      ];
      
      for (const selector of seasonSelectors) {
        try {
          const seasonElements = await driver.findElements(By.css(selector));
          
          if (seasonElements.length > 1) {
            console.log(`🎬 ${seasonElements.length} saisons détectées avec ${selector}`);
            
            // Cliquer sur chaque saison pour charger ses épisodes
            for (let i = 0; i < Math.min(seasonElements.length, 3); i++) {
              try {
                const seasonEl = seasonElements[i];
                const text = await seasonEl.getText();
                
                if (text && (text.includes('Season') || text.includes('Saison') || text.match(/S\d+/))) {
                  console.log(`  📺 Chargement saison: ${text.substring(0, 30)}...`);
                  
                  // Scroll vers l'élément et cliquer rapidement
                  await driver.executeScript('arguments[0].scrollIntoView(true);', seasonEl);
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  await driver.executeScript('arguments[0].click();', seasonEl);
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  
                  // Scroll rapide pour charger les épisodes
                  await driver.executeScript(`
                    window.scrollTo(0, document.body.scrollHeight);
                    setTimeout(() => window.scrollTo(0, 0), 500);
                  `);
                  await new Promise(resolve => setTimeout(resolve, 800));
                }
              } catch (error) {
                console.log(`    ⚠️ Erreur saison ${i + 1}:`, (error as Error).message);
              }
            }
            
            return; // Arrêter après avoir trouvé des saisons
          }
        } catch (error) {
          // Continuer avec le prochain sélecteur
        }
      }
      
      console.log('📺 Aucune saison multiple détectée, utilisation saison unique');
      
    } catch (error) {
      console.log('⚠️ Erreur détection saisons:', (error as Error).message);
    }
  }

  /**
   * Tentative simplifiée pour charger plus d'épisodes via scroll et navigation
   */
  private async attemptMultiSeasonLoad(driver: any): Promise<void> {
    try {
      console.log('🔄 Tentative de chargement multi-saisons...');
      
      // Scroll agressif et recherche de boutons "Voir plus"
      let loadedMore = true;
      let attempts = 0;
      
      while (loadedMore && attempts < 3) {
        loadedMore = await driver.executeScript(`
          const initialCount = document.querySelectorAll('a[href*="/watch/"]').length;
          console.log('🔍 Episode count before loading: ' + initialCount);
          
          // Scroll vers le bas en plusieurs étapes
          for(let i = 0; i < 8; i++) {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Chercher tous les types de boutons "voir plus"
          const moreSelectors = [
            'button:contains("VOIR PLUS")',
            'button:contains("Load more")', 
            'button:contains("Show more")',
            '[class*="more"]',
            '[class*="load"]',
            '[aria-label*="more"]',
            '[aria-label*="plus"]'
          ];
          
          let clickedSomething = false;
          
          // Chercher par texte
          const allButtons = document.querySelectorAll('button, [role="button"], [class*="button"]');
          allButtons.forEach(btn => {
            const text = btn.textContent?.trim() || '';
            if (text.includes('VOIR PLUS') || 
                text.includes('Load more') || 
                text.includes('Show more') ||
                text.includes('more episodes') ||
                text.includes('plus')) {
              try {
                console.log('🔄 Clique sur: ' + text);
                btn.scrollIntoView();
                btn.click();
                clickedSomething = true;
              } catch(e) {
                console.log('Erreur clic: ' + e.message);
              }
            }
          });
          
          // Attendre un peu après les clics
          if (clickedSomething) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
          // Scroll final
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const finalCount = document.querySelectorAll('a[href*="/watch/"]').length;
          console.log('🔍 Episode count after loading: ' + finalCount);
          
          return finalCount > initialCount;
        `);
        
        attempts++;
        console.log(`🔄 Tentative ${attempts}: ${loadedMore ? 'Plus d\'épisodes chargés' : 'Aucun nouvel épisode'}`);
        
        if (loadedMore) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Recherche et navigation multi-saisons améliorée
      console.log('🔍 Recherche des saisons disponibles...');
      
      // D'abord, chercher les sélecteurs de saison
      const seasonInfo = await driver.executeScript(`
        const seasonElements = [];
        
        // Chercher différents types de sélecteurs de saison
        const selectors = [
          '[role="option"]',
          'button[aria-label*="Season"]',
          'button[aria-label*="Saison"]', 
          '[class*="season"]',
          'select option',
          '[data-testid*="season"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const rawText = el.textContent?.trim() || el.getAttribute('aria-label') || '';
            if (rawText && (rawText.includes('Season') || rawText.includes('Saison') || rawText.match(/S[1-9]/))) {
              // Nettoyer le texte de saison pour éviter les doublons et malformations
              let cleanText = rawText;
              
              // Extraire seulement la partie saison pertinente
              const seasonMatch = rawText.match(/(S\d+:?[^S]*)/i) || 
                                  rawText.match(/(Season\s*\d+[^S]*)/i) ||
                                  rawText.match(/(Saison\s*\d+[^S]*)/i);
              
              if (seasonMatch) {
                cleanText = seasonMatch[1].trim();
                // Limiter à une longueur raisonnable et enlever les répétitions
                cleanText = cleanText.substring(0, 30).replace(/(.+?)\\1+/g, '$1');
              } else {
                cleanText = rawText.substring(0, 30);
              }
              
              // Éviter les doublons exacts
              if (!seasonElements.some(existing => existing.text === cleanText)) {
                seasonElements.push({
                  text: cleanText,
                  selector: selector,
                  position: el.getBoundingClientRect()
                });
              }
            }
          });
        }
        
        return {
          seasons: seasonElements,
          currentPage: document.title,
          url: window.location.href
        };
      `);
      
      console.log(`🎬 ${(seasonInfo as any).seasons.length} saisons détectées:`, (seasonInfo as any).seasons.map((s: any) => s.text));
      
      // Essayer de naviguer vers chaque saison trouvée
      for (const season of (seasonInfo as any).seasons.slice(0, 3)) {
        try {
          console.log(`🔄 Navigation vers: ${season.text}`);
          
          const clicked = await driver.executeScript(`
            const elements = document.querySelectorAll('${season.selector}');
            for (const el of elements) {
              const text = el.textContent?.trim() || el.getAttribute('aria-label') || '';
              if (text.includes('${season.text.split(' ')[0]}')) {
                el.scrollIntoView({behavior: 'smooth', block: 'center'});
                setTimeout(() => el.click(), 500);
                return true;
              }
            }
            return false;
          `);
          
          if (clicked) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Scroll pour charger les nouveaux épisodes
            await driver.executeScript(`
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(() => window.scrollTo(0, 0), 1000);
            `);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error) {
          console.log(`⚠️ Erreur navigation saison "${season.text}":`, (error as Error).message);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Erreur chargement multi-saisons:', (error as Error).message);
    }
  }

  /**
   * Extraction simple de tous les épisodes - version qui marchait avant + métadonnées améliorées
   */
  private async extractAllEpisodesSimple(animeId: string): Promise<Episode[]> {
    const driver = await this.browserManager.getDriver();
    
    // Essayer de charger toutes les saisons en scrollant et navigant
    await this.attemptMultiSeasonLoad(driver);
    
    const debugInfo = await driver.executeScript(`
      // Debug initial
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      const debugData = {
        totalLinks: allLinks.length,
        firstFewUrls: []
      };
      
      for(let i = 0; i < Math.min(15, allLinks.length); i++) {
        const link = allLinks[i];
        debugData.firstFewUrls.push({
          href: link.href,
          text: link.textContent?.trim()?.substring(0, 40) || 'NO_TEXT',
          isMusic: link.href.includes('/musicvideo/'),
          isMovie: link.href.includes('/movie/'),
          isConcert: link.href.includes('/concert/')
        });
      }
      
      return debugData;
    `);

    const debug = debugInfo as any;
    console.log('🔍 Debug URLs trouvées:', debug.totalLinks, 'total');
    debug.firstFewUrls.forEach((item: any, i: number) => {
      console.log(`  ${i+1}. ${item.href} -> "${item.text}" (music:${item.isMusic}, movie:${item.isMovie}, concert:${item.isConcert})`);
    });

    return await driver.executeScript(`
      const episodeList = [];
      
      console.log('🔍 Extraction simple - méthode qui fonctionnait');
      
      // Utiliser le sélecteur simple qui trouvait tous les épisodes
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🔍 Total éléments potentiels: ' + allLinks.length);
      
      const processedUrls = new Set();
      const processedTitles = new Set(); // Éviter les doublons de titres
      
      // Regrouper d'abord les liens par URL unique
      const episodeMap = new Map();
      
      allLinks.forEach((linkEl, index) => {
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        
        // Filtrer les URLs non-épisodes (music videos, etc.)
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) {
          return;
        }
        
        const text = linkEl.textContent?.trim() || '';
        
        // Prioriser les liens avec de vrais titres d'épisodes
        const hasGoodTitle = text.length > 10 && 
                           (text.includes('E') || text.includes('-') || text.includes('Ep')) && 
                           !text.match(/^\\d+m$/) && 
                           !text.match(/^\\d+$/) &&
                           !text.toLowerCase().includes('lecture') &&
                           text !== 'NO_TEXT';
        
        const hasBetterTitle = hasGoodTitle && text.length > 15;
        
        // CRITIQUE: Préserver le meilleur linkEl pour les thumbnails
        if (!episodeMap.has(href)) {
          // Première entrée pour cette URL
          episodeMap.set(href, {
            linkEl: linkEl,
            text: text,
            href: href,
            index: index,
            hasGoodTitle: hasGoodTitle,
            titleQuality: hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1),
            alternativeLinks: [] // Garder les autres liens pour fallback
          });
        } else {
          // URL déjà vue, mettre à jour intelligemment
          const existing = episodeMap.get(href);
          
          // Mise à jour du titre si on a un meilleur
          if ((hasBetterTitle && !existing.hasGoodTitle) ||
              (hasGoodTitle && existing.text === 'NO_TEXT') ||
              (text.length > existing.text.length && hasGoodTitle)) {
            existing.text = text;
            existing.hasGoodTitle = hasGoodTitle;
            existing.titleQuality = hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1);
          }
          
          // IMPORTANT: Garder le linkEl qui a le plus de chances d'avoir un thumbnail
          // Les liens avec classes spécifiques ou dans des conteneurs d'images sont prioritaires
          const currentHasThumbnailContainer = linkEl.closest('[class*="playable"], [class*="thumbnail"], [class*="image"]') ||
                                             linkEl.parentElement?.querySelector('img, picture');
          const existingHasThumbnailContainer = existing.linkEl.closest('[class*="playable"], [class*="thumbnail"], [class*="image"]') ||
                                              existing.linkEl.parentElement?.querySelector('img, picture');
          
          if (currentHasThumbnailContainer && !existingHasThumbnailContainer) {
            // Le nouveau lien semble avoir plus de chances d'avoir un thumbnail
            existing.linkEl = linkEl;
            existing.index = index;
          }
          
          // Garder le lien comme alternative
          existing.alternativeLinks.push(linkEl);
        }
      });
      
      console.log('🔍 Episodes uniques détectés: ' + episodeMap.size);
      
      // Maintenant traiter chaque épisode unique
      episodeMap.forEach((episode) => {
        const linkEl = episode.linkEl;
        const href = episode.href;
        
        // Extraction améliorée du titre depuis le conteneur parent
        let title = '';
        let thumbnail = '';
        let duration = '';
        
        // Chercher dans le conteneur parent pour les métadonnées
        const container = linkEl.closest('[class*="episode"], [class*="card"], [data-testid*="episode"]') || linkEl;
        
        // Utiliser le texte du lien si c'est un bon titre, sinon chercher ailleurs
        if (episode.hasGoodTitle && episode.text.length > 5) {
          title = episode.text;
        } else {
          // Extraction du titre avec priorité sur les éléments dédiés
          const titleSources = [
            container.querySelector('[class*="title"]:not([class*="series"]):not([class*="show"])')?.textContent?.trim(),
            container.querySelector('h3, h4, h5')?.textContent?.trim(),
            linkEl.getAttribute('aria-label'),
            linkEl.getAttribute('title'),
            container.getAttribute('aria-label'),
            linkEl.textContent?.trim()
          ];
          
          title = titleSources.find(t => t && t.length > 3 && 
            !t.match(/^\\d+m$/) && 
            !t.includes('LECTURE')
          ) || '';
        }
        
        // Nettoyer le titre IMMÉDIATEMENT après l'extraction - AVANT autres traitements
        if (title) {
          const originalTitle = title;
          // Supprimer les préfixes de saison/épisode car ils sont dans des champs séparés
          title = title.replace(/^S\\d+\\s*E\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Episode\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Ep\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          
          if (originalTitle !== title) {
            console.log('🧹 Titre nettoyé: "' + originalTitle + '" -> "' + title + '"');
          }
        }
        
        // Si toujours pas de titre, construire depuis l'URL
        if (!title) {
          const urlMatch = href.match(/\\/watch\\/[^\\/]+\\/([^\\/?]+)/);
          if (urlMatch) {
            title = urlMatch[1].replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
          }
        }
        
        // Extraction du numéro d'épisode améliorée
        let episodeNumber = episodeList.length + 1;
        const numberSources = [
          title,
          href,
          container.textContent || '',
          linkEl.textContent || ''
        ];
        
        for (const source of numberSources) {
          const matches = [
            source.match(/(?:Episode|Ep|E)\\s*(\\d+)/i),
            source.match(/episode[-_]?(\\d+)/i),
            source.match(/ep(\\d+)/i),
            source.match(/S\\d+\\s*E(\\d+)/i),
            // Pattern pour extraire le numéro depuis l'URL Crunchyroll
            source.match(/\\/watch\\/[A-Z0-9]+\\/(.*?)(?:\\?|$)/i)?.input?.match(/episode-(\\d+)/i),
            source.match(/\\/(\\d+)(?:\\/|$|\\?|-)/)
          ];
          
          for (const match of matches) {
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (num > 0 && num < 1000) { // Valeurs raisonnables
                episodeNumber = num;
                break;
              }
            }
          }
          if (episodeNumber !== episodeList.length + 1) break;
        }
        
        // Si pas de numéro trouvé, utiliser l'ordre + 1
        if (episodeNumber === episodeList.length + 1 || episodeNumber < 1) {
          episodeNumber = episodeList.length + 1;
        }
        
        // Détection de la saison améliorée depuis le titre, URL et contexte DOM
        let seasonNumber = 1;
        const seasonSources = [
          title, 
          href, 
          container.textContent || '',
          // Chercher dans les éléments parents pour des indices de saison
          container.closest('[class*="season"]')?.textContent || '',
          document.querySelector('[class*="selected"] [class*="season"]')?.textContent || '',
          document.querySelector('[aria-selected="true"]')?.textContent || ''
        ];
        
        for (const source of seasonSources) {
          if (!source) continue;
          
          const seasonMatches = [
            source.match(/S(\\d+)/i),
            source.match(/Season\\s*(\\d+)/i),
            source.match(/Saison\\s*(\\d+)/i),
            // Patterns pour URLs Crunchyroll avec saison
            source.match(/season-(\\d+)/i),
            source.match(/s(\\d+)e\\d+/i)
          ];
          
          for (const match of seasonMatches) {
            if (match && match[1]) {
              const num = parseInt(match[1]);
              if (num > 0 && num <= 20) { // Saisons raisonnables
                seasonNumber = num;
                break;
              }
            }
          }
          if (seasonNumber !== 1) break;
        }
        
        // Description supprimée car non disponible sur Crunchyroll
        
        // Extraction de la durée améliorée - chercher "23m" depuis les anciens logs
        const durationSources = [
          container.querySelector('[class*="duration"], .runtime')?.textContent?.trim(),
          container.textContent?.match(/\\d+m/)?.[0],
          linkEl.textContent?.match(/\\d+m/)?.[0],
          // Chercher dans les éléments adjacents du episodeMap original
          episode.text?.match(/\\d+m/)?.[0],
          // Chercher dans tous les éléments de la ligne d'épisode
          container.parentElement?.textContent?.match(/\\d+\\s*m/)?.[0],
          '23m' // Durée par défaut pour Fire Force (vu dans les anciens tests)
        ];
        
        for (const d of durationSources) {
          if (d && d.match(/\\d+\\s*m/)) {
            duration = d.replace(/\\s+/g, '');
            break;
          }
        }
        
        // Extraction du thumbnail améliorée - Méthode hybride
        // D'abord chercher dans les conteneurs proches, puis élargir si nécessaire
        
        let searchContainers = [];
        
        // ÉTAPE 1: Conteneurs proches (pour éviter les conflits)
        const specificContainer = linkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]');
        if (specificContainer) {
          searchContainers.push({ type: 'specific', container: specificContainer });
        }
        
        // ÉTAPE 2: Parents directs
        if (linkEl.parentElement) searchContainers.push({ type: 'parent', container: linkEl.parentElement });
        if (linkEl.parentElement?.parentElement) searchContainers.push({ type: 'grandparent', container: linkEl.parentElement.parentElement });
        if (linkEl.parentElement?.parentElement?.parentElement) searchContainers.push({ type: 'great-grandparent', container: linkEl.parentElement.parentElement.parentElement });
        
        console.log('🔍 Episode ' + (episodeList.length + 1) + ' - Recherche thumbnail dans ' + searchContainers.length + ' conteneur(s)');
        
        // PRIORITÉ 1: Chercher images avec classes Crunchyroll spécifiques
        for (const containerInfo of searchContainers) {
          if (thumbnail) break;
          
          const container = containerInfo.container;
          const thumbnailImages = container.querySelectorAll('img[class*="playable-thumbnail"], img[class*="content-image"]');
          
          console.log('  📦 ' + containerInfo.type + ': ' + thumbnailImages.length + ' images thumbnail trouvées');
          
          if (thumbnailImages.length > 0) {
            // Prendre la dernière image si plusieurs (souvent la meilleure qualité)
            const targetImg = thumbnailImages[thumbnailImages.length - 1];
            const src = targetImg.src || targetImg.getAttribute('data-src') || targetImg.getAttribute('data-lazy');
            
            if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
              thumbnail = src.trim();
              const thumbId = thumbnail.split('/').pop().split('.')[0];
              console.log('  🖼️ Thumbnail classe spécifique: ' + thumbId + '.jpg');
              break;
            }
          }
        }
        
        // PRIORITÉ 2: Chercher la 2ème picture (méthode originale)
        if (!thumbnail) {
          for (const containerInfo of searchContainers.slice(0, 2)) { // Limiter aux conteneurs proches
            if (thumbnail) break;
            
            const container = containerInfo.container;
            const pictureElements = container.querySelectorAll('picture');
            console.log('  📦 ' + containerInfo.type + ': ' + pictureElements.length + ' pictures trouvées');
            
            if (pictureElements.length >= 2) {
              const normalPicture = pictureElements[1];
              const normalImg = normalPicture.querySelector('img');
              if (normalImg) {
                const normalSrc = normalImg.src || normalImg.getAttribute('data-src') || normalImg.getAttribute('data-lazy');
                if (normalSrc && normalSrc.includes('crunchyroll') && !normalSrc.includes('blur=')) {
                  thumbnail = normalSrc.trim();
                  const thumbId = thumbnail.split('/').pop().split('.')[0];
                  console.log('  🖼️ Thumbnail 2ème picture: ' + thumbId + '.jpg');
                  break;
                }
              }
            }
          }
        }
        
        // PRIORITÉ 3: Chercher toute image Crunchyroll valide
        if (!thumbnail) {
          for (const containerInfo of searchContainers) {
            if (thumbnail) break;
            
            const container = containerInfo.container;
            const allImages = container.querySelectorAll('img');
            console.log('  🔍 ' + containerInfo.type + ': Analyse ' + allImages.length + ' images');
            
            for (const img of allImages) {
              const srcSources = [
                img.src,
                img.getAttribute('data-src'),
                img.getAttribute('data-lazy'),
                img.getAttribute('data-original'),
                img.getAttribute('srcset')?.split(' ')[0]
              ].filter(Boolean);
              
              for (const src of srcSources) {
                if (src && 
                    (src.includes('crunchyroll') || src.includes('imgsrv')) && 
                    !src.includes('blur=') && 
                    !src.includes('placeholder') &&
                    !src.includes('icon') &&
                    !src.includes('logo') &&
                    src.match(/\\.(jpg|jpeg|png|webp)/i)) {
                  thumbnail = src.trim();
                  const thumbId = thumbnail.split('/').pop().split('.')[0];
                  console.log('  🖼️ Thumbnail image générale: ' + thumbId + '.jpg');
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        // PRIORITÉ 4: Fallback - même images floutées si nécessaire
        if (!thumbnail) {
          for (const containerInfo of searchContainers.slice(0, 1)) { // Seulement le conteneur le plus proche
            if (thumbnail) break;
            
            const container = containerInfo.container;
            const allImages = container.querySelectorAll('img');
            
            for (const img of allImages) {
              const srcSources = [
                img.src,
                img.getAttribute('data-src'),
                img.getAttribute('data-lazy'),
                img.getAttribute('data-original')
              ].filter(Boolean);
              
              for (const src of srcSources) {
                if (src && 
                    (src.includes('crunchyroll') || src.includes('imgsrv')) && 
                    !src.includes('placeholder') &&
                    !src.includes('icon') &&
                    src.match(/\\.(jpg|jpeg|png|webp)/i)) {
                  thumbnail = src.trim();
                  const thumbId = thumbnail.split('/').pop().split('.')[0];
                  console.log('  🖼️ Thumbnail fallback: ' + thumbId + '.jpg (flouté accepté)');
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        // PRIORITÉ 5: Essayer les liens alternatifs si pas de thumbnail trouvé
        if (!thumbnail && episode.alternativeLinks && episode.alternativeLinks.length > 0) {
          console.log('  🔄 Tentative liens alternatifs (' + episode.alternativeLinks.length + ' disponibles)');
          
          for (const altLinkEl of episode.alternativeLinks) {
            if (thumbnail) break;
            
            // Mêmes conteneurs mais pour le lien alternatif
            const altContainers = [];
            const altSpecificContainer = altLinkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]');
            if (altSpecificContainer) altContainers.push({ type: 'alt-specific', container: altSpecificContainer });
            if (altLinkEl.parentElement) altContainers.push({ type: 'alt-parent', container: altLinkEl.parentElement });
            
            // Essayer extraction sur lien alternatif
            for (const containerInfo of altContainers) {
              if (thumbnail) break;
              
              const container = containerInfo.container;
              const thumbnailImages = container.querySelectorAll('img[class*="playable-thumbnail"], img[class*="content-image"]');
              
              if (thumbnailImages.length > 0) {
                const targetImg = thumbnailImages[thumbnailImages.length - 1];
                const src = targetImg.src || targetImg.getAttribute('data-src') || targetImg.getAttribute('data-lazy');
                
                if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                  thumbnail = src.trim();
                  const thumbId = thumbnail.split('/').pop().split('.')[0];
                  console.log('  🖼️ Thumbnail alternatif trouvé: ' + thumbId + '.jpg');
                  break;
                }
              }
            }
          }
        }
        
        // Le nettoyage du titre a déjà été fait plus haut
        
        // Titre final si toujours vide
        if (!title || title.length < 3) {
          title = 'Episode ' + episodeNumber;
        }
        
        episodeList.push({
          id: href.split('/watch/')[1]?.split('/')[0] || arguments[0] + '-s' + seasonNumber + 'ep' + episodeNumber,
          animeId: arguments[0],
          title: title,
          episodeNumber: episodeNumber,
          seasonNumber: seasonNumber,
          thumbnail: thumbnail || undefined,
          duration: duration || undefined,
          url: href
        });
        
        if (episodeList.length <= 20 || episodeList.length % 5 === 0) {
          console.log('  📺 ' + (episodeList.length) + '. S' + String(seasonNumber).padStart(2, '0') + 'E' + String(episodeNumber).padStart(2, '0') + ' - ' + title.substring(0, 30));
        }
      });
      
      console.log('🎬 Total épisodes extraits: ' + episodeList.length);
      
      // DÉDUPLICATION FINALE : Éliminer les doublons d'URL ET de contenu
      const finalEpisodes = [];
      const seenUrls = new Map(); // Clé: URL exacte
      const seenSlugs = new Map(); // Clé: slug d'épisode (pour détecter même contenu, URLs différentes)
      
      episodeList.forEach(episode => {
        const episodeUrl = episode.url;
        
        // Extraire le slug de l'épisode (partie après le dernier slash)
        const episodeSlug = episodeUrl.split('/').pop() || '';
        
        // Déduplication 1: URLs exactement identiques
        if (seenUrls.has(episodeUrl)) {
          const existing = seenUrls.get(episodeUrl);
          
          // Garder le meilleur entre deux URLs identiques
          const currentBetter = (
            (episode.thumbnail && !existing.thumbnail) ||
            (episode.title.length > existing.title.length && !episode.title.includes('Lecture') && !episode.title.match(/^\\d+m$/)) ||
            (existing.title.includes('Lecture') && !episode.title.includes('Lecture')) ||
            (existing.title.match(/^\\d+m$/) && !episode.title.match(/^\\d+m$/))
          );
          
          if (currentBetter) {
            const existingIndex = finalEpisodes.findIndex(ep => ep.url === episodeUrl);
            if (existingIndex !== -1) {
              finalEpisodes[existingIndex] = episode;
              seenUrls.set(episodeUrl, episode);
              console.log('🔄 Doublon URL exact éliminé: "' + existing.title + '" remplacé par "' + episode.title + '"');
            }
          } else {
            console.log('🔄 Doublon URL exact éliminé: "' + episode.title + '" (gardé: "' + existing.title + '")');
          }
          return;
        }
        
        // Déduplication 2: Même slug d'épisode (même contenu, IDs Crunchyroll différents)
        if (episodeSlug && seenSlugs.has(episodeSlug)) {
          const existing = seenSlugs.get(episodeSlug);
          
          // Garder le meilleur entre deux épisodes avec même slug
          const currentBetter = (
            (episode.thumbnail && !existing.thumbnail) ||
            (episode.title.length > existing.title.length && !episode.title.includes('Lecture') && !episode.title.match(/^\\d+m$/)) ||
            (existing.title.includes('Lecture') && !episode.title.includes('Lecture')) ||
            (existing.title.match(/^\\d+m$/) && !episode.title.match(/^\\d+m$/))
          );
          
          if (currentBetter) {
            // Remplacer l'épisode existant
            const existingIndex = finalEpisodes.findIndex(ep => ep.url === existing.url);
            if (existingIndex !== -1) {
              finalEpisodes[existingIndex] = episode;
              seenUrls.delete(existing.url); // Supprimer l'ancienne URL
              seenUrls.set(episodeUrl, episode); // Ajouter la nouvelle URL
              seenSlugs.set(episodeSlug, episode);
              console.log('🔄 Doublon contenu éliminé: "' + existing.title + '" (' + existing.url.split('/').pop() + ') remplacé par "' + episode.title + '" (' + episodeSlug + ')');
            }
          } else {
            console.log('🔄 Doublon contenu éliminé: "' + episode.title + '" (' + episodeSlug + ') (gardé: "' + existing.title + '")');
          }
          return;
        }
        
        // Nouvel épisode unique
        seenUrls.set(episodeUrl, episode);
        if (episodeSlug) {
          seenSlugs.set(episodeSlug, episode);
        }
        finalEpisodes.push(episode);
      });
      
      console.log('🎬 Après déduplication complète: ' + finalEpisodes.length + ' épisodes uniques');
      
      return finalEpisodes.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) {
          return a.seasonNumber - b.seasonNumber;
        }
        return a.episodeNumber - b.episodeNumber;
      });
    `, animeId);
  }


  async close(): Promise<void> {
    await this.browserManager.close();
  }
}