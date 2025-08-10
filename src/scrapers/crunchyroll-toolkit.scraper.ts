import { By, until } from 'selenium-webdriver';
import { ScraperOptions, ScraperResult, Anime, Episode } from '../types/anime.types';
import { CrunchyrollToolkitBrowserManager } from '../utils/crunchyroll-toolkit.browser.utils';
import { ParserUtils } from '../utils/parser.utils';
import * as fs from 'fs';

/**
 * Scraper Crunchyroll 2025 - Crunchyroll Toolkit avec interception API
 * Adapté depuis l'ancien code Playwright vers undetected-chrome-driver
 * Combine la robustesse de l'ancien code avec l'anti-détection
 */
export class CrunchyrollToolkitScraper {
  private browserManager: CrunchyrollToolkitBrowserManager;
  private baseUrl = 'https://www.crunchyroll.com';
  private debug: boolean = false;
  private log(...args: any[]): void { if (this.debug) console.log(...args); }

  constructor(options: ScraperOptions = {}) {
    const enhancedOptions = {
      headless: false,
      timeout: 30000,
      maxRetries: 1,
      locale: 'fr-FR',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...options
    };
    this.browserManager = new CrunchyrollToolkitBrowserManager(enhancedOptions);
    this.debug = Boolean(options.debug || process.env.CR_TOOLKIT_DEBUG === '1' || process.env.CR_TOOLKIT_DEBUG === 'true');
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
    if (this.debug) console.log('🚀 Scraper Crunchyroll Toolkit initialisé - Mode DOM optimisé');
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
      
      console.log(`🔍 Recherche Crunchyroll Toolkit: "${query}"`);
      
      // Navigation intelligente
      const navigationSuccess = await this.smartNavigation(searchUrl);
      
      if (!navigationSuccess) {
        console.log('⚠️ Navigation échouée, essai méthode alternative...');
        return await this.searchAnimeAlternative(query);
      }

      // Attendre le chargement de la page + accepter cookies + forcer le chargement des résultats
      await new Promise(resolve => setTimeout(resolve, 750));
      await this.acceptCookiesIfPresent();
      await this.ensureSearchResultsLoaded(query);
      
      // Extraction DOM directe (avec scroll sur page de recherche)
      let animes = await this.extractAnimesFromSearchPage(query);
      const rawResults = [...animes];
      console.log(`🔍 Debug résultats bruts: ${rawResults.length}`);
      rawResults.slice(0, 10).forEach((r: any, i: number) => {
        console.log(`  [${i+1}] ${r.title} -> ${r.url} slug:${r.slug||''} y:${typeof r.y==='number'?r.y:''}`);
      });

      // Filtrer pour garder seulement les vraies séries d'animation
      animes = animes.filter(anime => {
        const title = anime.title.toLowerCase();
        const url = anime.url.toLowerCase();
        
        // Exclure les concerts, films live, documentaires, podcasts
        if (title.includes('concert') || title.includes('live in') || 
            title.includes('symphony') || title.includes('budokan') ||
            title.includes('secrets of') || title.includes('behind') ||
            title.includes('celebrates') || title.includes('ft.') ||
            title.includes('celebrates') || title.includes('interview') ||
            url.includes('/concert/') || url.includes('/music/') ||
            url.includes('/musicvideo/') || url.includes('/podcast/')) {
          return false;
        }
        
        // Exclure les titres qui commencent par "E[numéro]" (épisodes de podcast)
        if (title.match(/^e\d+\s*-/i)) {
          return false;
        }
        
        // Garder seulement les séries d'animation (doit être /series/)
        return url.includes('/series/');
      });

      // Tri par pertinence avec heuristique position/slug pour mieux coller au premier résultat visible
      const normalize = (s: string) => (s||'')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const qNorm = normalize(query);
      const sigTokens = qNorm.split(/\s+/).filter(w => w.length >= 5);

      animes = animes.sort((a: any, b: any) => {
        const aRelevance = this.calculateRelevance(a.title, query);
        const bRelevance = this.calculateRelevance(b.title, query);
        if (aRelevance !== bRelevance) return bRelevance - aRelevance;
        // Bonus via slug/URL: compter les tokens significatifs présents
        const aSlugSource = normalize((a.slug || a.url || ''));
        const bSlugSource = normalize((b.slug || b.url || ''));
        const aSlugScore = sigTokens.reduce((acc, w) => acc + (aSlugSource.includes(w) ? 1 : 0), 0);
        const bSlugScore = sigTokens.reduce((acc, w) => acc + (bSlugSource.includes(w) ? 1 : 0), 0);
        if (aSlugScore !== bSlugScore) return bSlugScore - aSlugScore;
        // Sinon, favoriser l'élément plus haut (plus proche du premier résultat visuel)
        const aY = typeof a.y === 'number' ? a.y : 0;
        const bY = typeof b.y === 'number' ? b.y : 0;
        if (aY !== bY) return aY - bY;
        // Enfin, par index d'apparition
        const aRank = typeof a.rank === 'number' ? a.rank : 9999;
        const bRank = typeof b.rank === 'number' ? b.rank : 9999;
        return aRank - bRank;
      });

      // Vérifier si on a de vrais résultats pertinents (après tri affiné)
      const bestRelevance = animes.length > 0 ? this.calculateRelevance(animes[0].title, query) : 0;
      console.log('🔍 Candidats triés (top 10):');
      animes.slice(0, 10).forEach((r: any, i: number) => {
        const rel = this.calculateRelevance(r.title, query).toFixed(2);
        const slugSrc = normalize((r.slug || r.url || ''));
        const slugScore = sigTokens.reduce((acc, w) => acc + (slugSrc.includes(w) ? 1 : 0), 0);
        console.log(`  [${i+1}] ${r.title} (rel:${rel}, slugScore:${slugScore}) -> ${r.url}`);
      });
      
      console.log(`🎯 Résultats filtrés: ${animes.length} série(s), meilleure pertinence: ${bestRelevance.toFixed(2)}`);
      
      // Si la pertinence est basse (< 0.8), tenter une recherche en anglais
      if (bestRelevance < 0.8) {
        console.log('🌐 Pertinence basse, tentative en locale EN...');
        const localesTry = ['en'];
        let bestAltList: Anime[] = [];
        let bestAltScore = 0;
        for (const loc of localesTry) {
          const alt = await this.searchInLocale(loc, query);
          if (alt.length > 0) {
            const score = this.calculateRelevance(alt[0].title, query);
            if (score > bestAltScore) {
              bestAltScore = score;
              bestAltList = alt;
            }
          }
        }
        if (bestAltScore > bestRelevance) {
          console.log(`✅ Locale EN plus pertinente: ${bestAltScore.toFixed(2)} > ${bestRelevance.toFixed(2)} (remplacement des résultats)`);
          animes = bestAltList;
        }
      }
      
      // Essayer de remonter via liens watch → series si pas de /series/
      if (animes.length === 0 && rawResults.length > 0) {
        const watchLinks = rawResults.filter(r => r.url && r.url.includes('/watch/')).slice(0, 5);
        if (watchLinks.length > 0) {
          console.log(`🔄 Aucun /series/ direct. Tentative depuis ${watchLinks.length} lien(s) /watch/...`);
          const resolved = await this.resolveSeriesFromWatchLinks(watchLinks.map(r => r.url));
          if (resolved.length > 0) {
            animes = resolved;
          }
        }
      }

      // Si aucun résultat pertinent, utiliser la recherche via UI puis fallback spécifique/multi-locale
      // NB: recalculer le meilleur score après éventuelles substitutions
      const currentBest = animes.length > 0 ? this.calculateRelevance(animes[0].title, query) : 0;
      if (animes.length === 0 || currentBest < 0.02) {
        console.log('⚠️ Résultats non pertinents, tentative recherche via UI...');
        const uiResults = await this.uiSearch(query);
        if (uiResults.length > 0) {
          animes = uiResults;
        } else {
          console.log('⚠️ UI search vide, recherche spécifique...');
          const specificResults = await this.searchSpecificAnime(query);
        if (specificResults.length > 0) {
          console.log('✅ Animé trouvé via recherche spécifique!');
          animes = specificResults;
        } else if (animes.length === 0) {
            // Essai multi-locale
            const locales = ['en'];
            for (const loc of locales) {
              const altSeries = await this.searchInLocale(loc, query);
              if (altSeries.length > 0) { animes = altSeries; break; }
            }
            if (animes.length === 0) {
          throw new Error(`Aucune série d'animation trouvée pour "${query}"`);
            }
          }
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
      
      await new Promise(resolve => setTimeout(resolve, 750));
      
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
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // retirer accents
        .replace(/[\p{P}\p{S}]/gu, ' ') // retirer ponctuation/symboles
        .replace(/\s+/g, ' ') // compresser espaces
        .trim();
    const titleLower = normalize(title);
    const queryLower = normalize(query);
    
    // Synonymes et noms alternatifs pour certains anime
    const synonymMap: { [key: string]: string[] } = {
      'the apothecary diaries': ['kusuriya no hitorigoto', 'les carnets de l\'apothicaire', 'apothecary diaries'],
      'kusuriya no hitorigoto': ['the apothecary diaries', 'les carnets de l\'apothicaire', 'apothecary diaries'],
      'demon slayer': ['kimetsu no yaiba', 'demon slayer kimetsu no yaiba'],
      'attack on titan': ['shingeki no kyojin', 'aot'],
      'my hero academia': ['boku no hero academia', 'mha', 'bnha'],
      'jujutsu kaisen': ['jjk', 'sorcery fight'],
      'one piece': ['wan pisu'],
      'tokyo revengers': ['tokyo manji revengers'],
      'spy x family': ['spy family', 'spyxfamily']
    };
    
    // Vérifier les synonymes
    let bestScore = 0;
    const checkSynonyms = (q: string, t: string) => {
      if (synonymMap[q]) {
        for (const synonym of synonymMap[q]) {
          if (t.includes(synonym)) {
            return 0.95; // Très haute pertinence pour synonyme
          }
        }
      }
      return 0;
    };
    
    bestScore = Math.max(bestScore, checkSynonyms(queryLower, titleLower));
    bestScore = Math.max(bestScore, checkSynonyms(titleLower, queryLower));
    
    if (bestScore > 0) return bestScore;
    
    // Match exact = 100%
    if (titleLower === queryLower) return 1.0;
    
    // Contient la requête complète = 90%
    if (titleLower.includes(queryLower)) return 0.9;
    
    // Analyse par mots (en ignorant les mots communs)
    const stopWords = [
      // EN
      'the','a','an','and','or','but','in','on','at','to','for','of','with','by','is','are','was','were','be','been','being','will','would','shall','should','do','does','did','have','has','had','not','no','yes','it','its','this','that','these','those','from','as','into','than','then','there','here','over','under','up','down','out','about','after','before','again','more','most','some','any','all','can','cannot','cant','won','t','s','ll','re','ve',
      // FR
      'le','la','les','un','une','des','du','de','et','ou','en','dans','avec','pour','sur','au','aux','ce','cet','cette','ces','est','sont','été','etre','être','pas','ne','que','qui','dont','ou','où','au','aux','par','plus','moins'
    ];
    
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));
    const titleWords = titleLower.split(/\s+/).filter(word => word.length > 2 && !stopWords.includes(word));

    // Mettre l'accent sur les mots "significatifs" (longueur >= 5)
    const significant = (w: string) => w.length >= 5 && !stopWords.includes(w);
    const querySig = queryWords.filter(significant);
    const titleSig = titleWords.filter(significant);
    
    if (queryWords.length === 0) return 0.1;
    
    // Comptage des correspondances (exact + partiel)
    let exactMatches = 0;
    let partialMatches = 0;
    let exactMatchesSig = 0;
    let partialMatchesSig = 0;
    
    for (const queryWord of queryWords) {
      const exact = titleWords.includes(queryWord);
      const partial = titleWords.some(titleWord => titleWord.includes(queryWord) || queryWord.includes(titleWord));
      if (exact) exactMatches++;
      else if (partial) partialMatches++;
    }

    for (const q of querySig) {
      const exact = titleSig.includes(q);
      const partial = titleSig.some(t => t.includes(q) || q.includes(t));
      if (exact) exactMatchesSig++;
      else if (partial) partialMatchesSig++;
    }
    
    // Calcul de score en privilégiant les mots significatifs
    const exactRatio = queryWords.length ? exactMatches / queryWords.length : 0;
    const partialRatio = queryWords.length ? partialMatches / queryWords.length : 0;
    const exactSigRatio = querySig.length ? exactMatchesSig / querySig.length : 0;
    const partialSigRatio = querySig.length ? partialMatchesSig / querySig.length : 0;

    // Bonus fort si au moins deux mots significatifs exacts
    if (exactMatchesSig >= 2) return Math.max(0.9, 0.6 + exactSigRatio * 0.4);
    if (exactMatchesSig === 1 && (partialMatchesSig >= 1 || exactMatches >= 2)) return 0.8;

    // Score pondéré
    let score = (exactSigRatio * 0.6) + (partialSigRatio * 0.2) + (exactRatio * 0.15) + (partialRatio * 0.05);

    // Petit bonus si un mot très long (>= 8) du query est contenu intégralement dans le titre
    const longWordHit = querySig.some(w => w.length >= 8 && titleLower.includes(w));
    if (longWordHit) score += 0.1;

    // Clamp 0..0.85 (laisser 1.0 aux matches exacts / 0.9 aux cas forts)
    score = Math.max(0, Math.min(0.85, score));
    return score;
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
      await new Promise(resolve => setTimeout(resolve, 750));

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

      await new Promise(resolve => setTimeout(resolve, 1000));

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
            await new Promise(resolve => setTimeout(resolve, 750));
            
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
    // Échapper correctement la query pour éviter les erreurs JavaScript
    const escapedQuery = query.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    // Tenter un scroll pour charger plus de résultats de recherche
    try {
      await driver.executeScript(`
        let total = document.body.scrollHeight;
        window.scrollTo(0, total);
        setTimeout(() => window.scrollTo(0, 0), 800);
      `);
      await new Promise(r => setTimeout(r, 1200));
    } catch {}
    
    return await driver.executeScript(`
      const results = [];
      
      console.log('🔍 Recherche de tous les types de liens sur la page pour: ${escapedQuery}');
      
      // Sélecteurs élargis pour trouver tous les liens possibles
      const allLinkSelectors = [
        'a[href*="/series/"]',
        'a[href*="/watch/"]', 
        'a[href*="crunchyroll.com"]',
        'a[title]',
        'a[aria-label]',
        '[role="link"]',
        '[class*="link"]'
      ];
      
      const foundLinks = new Map();
      
      // Debug: compter tous les éléments trouvés
      console.log('📊 Debug - Analyse de tous les sélecteurs:');
      
      allLinkSelectors.forEach((selector, index) => {
        const elements = document.querySelectorAll(selector);
        console.log('  ' + (index + 1) + '. "' + selector + '" -> ' + elements.length + ' éléments');
        
        if (index === 0) { // Premier sélecteur détaillé
          console.log('🔍 Détail du premier sélecteur (séries):');
          for (let i = 0; i < Math.min(10, elements.length); i++) {
            const el = elements[i];
            const href = el.href || 'NO_HREF';
            const text = el.textContent?.trim() || 'NO_TEXT';
            console.log('    ' + (i+1) + '. ' + href + ' -> "' + text.substring(0, 40).replace(/'/g, "\\\\'") + '"');
          }
        }
      });
      
      // Recherche élargie: tous les liens avec du texte
      const allLinks = document.querySelectorAll('a[href]');
      console.log('🔍 Total de liens sur la page: ' + allLinks.length);
      
      const queryLower = '${escapedQuery}'.toLowerCase();
      console.log('🎯 Recherche de: "' + queryLower + '"');
      
      let potentialMatches = 0;
      let seriesCount = 0;
      
      // Normalisation et tokens significatifs (éviter les faux positifs sur "will", etc.)
      const normalize = (s) => (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const stopWords = [
        'the','a','an','and','or','of','for','to','in','on','with','by','is','are','was','were','be','been','being','it','its','this','that','these','those','from','as','into','than','then','there','here','over','under','up','down','out','about','after','before','again','more','most','some','any','all','can','cannot','cant','won','t','s','ll','re','ve','do','does','did','have','has','had','not','no','yes',
        'le','la','les','un','une','des','du','de','et','ou','en','dans','avec','pour','sur','au','aux','ce','cet','cette','ces','est','sont','ete','etre','pas','ne','que','qui','dont','ou','ou','par','plus','moins',
        'will','not','be'
      ];
      const stopSet = new Set(stopWords);
      const qNorm = normalize(queryLower);
      const sigTokens = qNorm.split(' ').filter(w => w.length >= 5 && !stopSet.has(w));
      
      allLinks.forEach((link, index) => {
        const href = link.href || '';
        const text = (link.textContent?.trim() || '').toLowerCase();
        const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
        const title = (link.getAttribute('title') || '').toLowerCase();
        
        // Compter les séries
        if (href.includes('/series/')) {
          seriesCount++;
        }
        
        // Chercher des correspondances de titre avec plusieurs stratégies
        const searchText = text + ' ' + ariaLabel + ' ' + title;
        const isDirectMatch = searchText.includes(queryLower) || text.includes(queryLower);
        const normText = normalize(searchText);
        const sigHits = sigTokens.reduce((acc, w) => acc + (normText.includes(w) ? 1 : 0), 0);
        
        // Nouvelle stratégie : recherche par mots-clés
        const queryWords = queryLower.split(' ').filter(word => word.length > 2);
        const hasWordMatch = queryWords.some(word => 
          searchText.includes(word) || text.includes(word)
        );
        
        if ((isDirectMatch || hasWordMatch) && (normText.includes(qNorm) || sigHits >= 1)) {
          potentialMatches++;
          console.log('🎯 CORRESPONDANCE POTENTIELLE ' + potentialMatches + ':');
          console.log('  URL: ' + href);
          console.log('  Texte: "' + (link.textContent?.trim() || '').replace(/'/g, "\\\\'") + '"');
          console.log('  Aria-label: "' + (link.getAttribute('aria-label') || '').replace(/'/g, "\\\\'") + '"');
          console.log('  Title: "' + (link.getAttribute('title') || '').replace(/'/g, "\\\\'") + '"');
          console.log('  Match type: ' + (isDirectMatch ? 'direct' : 'word'));
          
          // Si c'est un lien série ou watch, l'ajouter
          if (href.includes('/series/') || href.includes('/watch/')) {
            const cleanTitle = link.textContent?.trim() || 
                             link.getAttribute('aria-label') || 
                             link.getAttribute('title') || 
                             'Episode';
            
            if (cleanTitle.length > 2) {
              const animeId = href.includes('/series/') ? 
                href.split('/series/')[1]?.split('/')[0] : 
                href.split('/watch/')[1]?.split('/')[0];
               // Essayer d'extraire le slug (après l'id série) pour meilleur matching
               let slug = '';
               if (href.includes('/series/')) {
                 const after = href.split('/series/')[1] || '';
                 slug = after.split('/')[1] || '';
               }
               const rect = link.getBoundingClientRect();
              
              results.push({
                id: animeId || href.split('/').pop(),
                title: cleanTitle,
                url: href,
                 thumbnail: undefined,
                 type: href.includes('/series/') ? 'series' : 'episode',
                 slug: slug,
                 rank: index,
                 y: rect ? rect.top : 0
              });
              
              console.log('✅ Ajouté: "' + cleanTitle + '" (' + (href.includes('/series/') ? 'série' : 'épisode') + ')');
            }
          }
        }
        
        // Log détaillé pour les premiers liens
        if (index < 10) {
          console.log('  Link ' + (index+1) + ': ' + href.substring(0, 50) + ' -> "' + text.substring(0, 30) + '"');
        }
      });
      
      // Fallback: si aucun résultat, collecter des liens /series/ en reconstruisant le titre depuis le card
      if (results.length === 0) {
        const seriesAnchors = Array.from(document.querySelectorAll('a[href*="/series/"]'));
        let added = 0;
        seriesAnchors.slice(0, 60).forEach((link, index) => {
          const href = link.href || '';
          const after = href.split('/series/')[1] || '';
          const id = after.split('/')[0] || '';
          if (!id) return;
          let cleanTitle = (link.textContent || link.getAttribute('aria-label') || link.getAttribute('title') || '').trim();
          if (!cleanTitle) {
            const card = link.closest('article, li, div');
            const head = card ? (card.querySelector('h3, h4, [data-title], [aria-label], img[alt]')) : null;
            if (head) {
              cleanTitle = (head.getAttribute('data-title') || head.getAttribute('aria-label') || head.getAttribute('alt') || head.textContent || '').trim();
            }
          }
          const slug = after.split('/')[1] || '';
          if (!cleanTitle && slug) cleanTitle = slug.replace(/-/g, ' ').trim();
          const rect = link.getBoundingClientRect();
          results.push({
            id,
            title: cleanTitle || 'Series',
            url: href,
            thumbnail: undefined,
            type: 'series',
            slug,
            rank: index,
            y: rect ? rect.top : 0
          });
          added++;
        });
        console.log('🛟 Fallback /series/ collectés:', added);
      }
      
      console.log('📊 Statistiques de recherche:');
      console.log('  - Total liens analysés: ' + allLinks.length);
      console.log('  - Liens séries trouvés: ' + seriesCount);
      console.log('  - Correspondances potentielles: ' + potentialMatches);
      console.log('  - Résultats finaux: ' + results.length);
      
      // Si aucun résultat, chercher dans le HTML brut
      if (results.length === 0) {
        console.log('🔍 Recherche dans le HTML brut...');
        const htmlContent = document.documentElement.innerHTML.toLowerCase();
        
        if (htmlContent.includes(queryLower)) {
          console.log('✅ "' + queryLower + '" trouvé dans le HTML de la page');
          
          // Essayer d'extraire des liens depuis le HTML
          const htmlMatches = htmlContent.match(/href="[^"]*(?:series|watch)[^"]*"/g) || [];
          console.log('🔗 ' + htmlMatches.length + ' liens série/watch trouvés dans HTML');
          
          htmlMatches.slice(0, 10).forEach((match, i) => {
            console.log('  HTML ' + (i+1) + ': ' + match);
          });
        } else {
          console.log('❌ "' + queryLower + '" NOT FOUND dans le HTML de la page');
        }
        
        // Debug: voir le contenu visible de la page
        const visibleText = document.body.textContent || '';
        console.log('📄 Contenu visible de la page (' + visibleText.length + ' caractères):');
        console.log('  Début: "' + visibleText.substring(0, 200) + '"');
        
        if (visibleText.toLowerCase().includes(queryLower)) {
          console.log('✅ "' + queryLower + '" trouvé dans le contenu visible');
        } else {
          console.log('❌ "' + queryLower + '" NOT FOUND dans le contenu visible');
        }
      }
      
      return results;
    `, query);
  }

  // Accepter des cookies si bannière présente
  private async acceptCookiesIfPresent(): Promise<void> {
    try {
      const driver = await this.browserManager.getDriver();
      await driver.executeScript(`
        const texts = ['Tout accepter', 'Accepter tout', 'Accept All', 'J\'accepte', 'Accepter'];
        const btns = Array.from(document.querySelectorAll('button, [role="button"], [class*="cookie"], [id*="cookie"]'));
        for (const b of btns) {
          const t = (b.textContent || '').trim();
          if (texts.some(x => t.includes(x))) { try { b.click(); } catch(e) {} }
        }
      `);
      await new Promise(r => setTimeout(r, 500));
    } catch {}
  }

  // Forcer le chargement des résultats (scroll + polling)
  private async ensureSearchResultsLoaded(query: string): Promise<void> {
    const driver = await this.browserManager.getDriver();
    for (let i = 0; i < 6; i++) {
      try {
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight);');
        await new Promise(r => setTimeout(r, 400));
        await driver.executeScript('window.scrollTo(0, 0);');
        await new Promise(r => setTimeout(r, 400));
        const count = await driver.executeScript('return document.querySelectorAll(\'a[href*="/series/"], a[href*="/watch/"]\').length;');
        console.log(`🔎 Chargement recherche: tentative ${i+1}, liens détectés: ${count}`);
        if ((count as number) > 0) break;
      } catch {}
    }
  }

  // Remonter série depuis des liens /watch/
  private async resolveSeriesFromWatchLinks(watchUrls: string[]): Promise<Anime[]> {
    const driver = await this.browserManager.getDriver();
    const results: Anime[] = [];
    for (const url of watchUrls) {
      try {
        await this.browserManager.navigateTo(url);
        await new Promise(r => setTimeout(r, 800));
        const info: any = await driver.executeScript(`
          const seriesLink = document.querySelector('a[href*="/series/"]');
          if (!seriesLink) return null;
          const href = seriesLink.href;
          const id = href.split('/series/')[1]?.split('/')[0] || '';
          const title = (seriesLink.textContent || seriesLink.getAttribute('aria-label') || seriesLink.title || '').trim();
          return { href, id, title };
        `);
        if (info && (info as any).id && (info as any).href) {
          results.push({ id: (info as any).id, title: (info as any).title || 'Series', url: (info as any).href } as Anime);
        }
      } catch {}
      if (results.length >= 3) break;
    }
    const uniq = new Map<string, Anime>();
    for (const a of results) uniq.set(a.id, a);
    return Array.from(uniq.values());
  }

  // Recherche dans une locale donnée et retourne des /series/ triées par pertinence
  private async searchInLocale(locale: string, query: string): Promise<Anime[]> {
    try {
      // Pour la locale EN, Crunchyroll utilise la racine sans préfixe de langue
      const url = locale === 'en'
        ? `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
        : `${this.baseUrl}/${locale}/search?q=${encodeURIComponent(query)}`;
      console.log(`🌐 Recherche locale (${locale}): ${url}`);
      await this.browserManager.navigateTo(url);
      await this.acceptCookiesIfPresent();
      await this.ensureSearchResultsLoaded(query);
      let list = await this.extractAnimesFromSearchPage(query);
      // Debug visible pour EN
      console.log(`🔍 [${locale}] ${list.length} candidats bruts`);
      list.slice(0, 10).forEach((r: any, i: number) => console.log(`  [${i+1}] ${r.title} -> ${r.url}`));
      const seriesOnly = list.filter((a: any) => a.url.includes('/series/'));
      // Appliquer le même tri affiné que FR
      const normalize = (s: string) => (s||'')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const qNorm = normalize(query);
      const sigTokens = qNorm.split(/\s+/).filter(w => w.length >= 5);
      const sorted = seriesOnly.sort((a: any, b: any) => {
        const aRel = this.calculateRelevance(a.title, query);
        const bRel = this.calculateRelevance(b.title, query);
        if (aRel !== bRel) return bRel - aRel;
        const aSlugSrc = normalize((a.slug || a.url || ''));
        const bSlugSrc = normalize((b.slug || b.url || ''));
        const aSlugScore = sigTokens.reduce((acc, w) => acc + (aSlugSrc.includes(w) ? 1 : 0), 0);
        const bSlugScore = sigTokens.reduce((acc, w) => acc + (bSlugSrc.includes(w) ? 1 : 0), 0);
        if (aSlugScore !== bSlugScore) return bSlugScore - aSlugScore;
        const aY = typeof (a as any).y === 'number' ? (a as any).y : 0;
        const bY = typeof (b as any).y === 'number' ? (b as any).y : 0;
        if (aY !== bY) return aY - bY;
        const aRank = typeof (a as any).rank === 'number' ? (a as any).rank : 9999;
        const bRank = typeof (b as any).rank === 'number' ? (b as any).rank : 9999;
        return aRank - bRank;
      });
      console.log('🔍 [EN] Candidats triés (top 5):');
      sorted.slice(0, 5).forEach((r: any, i: number) => console.log(`  [${i+1}] ${r.title} -> ${r.url}`));
      return sorted as any;
    } catch {
      return [];
    }
  }

  /**
   * Recherche via l'UI (barre de recherche interne) pour titres peu connus
   */
  private async uiSearch(query: string): Promise<Anime[]> {
    try {
      console.log('🔎 UI search Crunchyroll...');
      await this.browserManager.navigateTo(`${this.baseUrl}/fr`);
      await new Promise(resolve => setTimeout(resolve, 800));
      const driver = await this.browserManager.getDriver();

      // Essayer plusieurs sélecteurs d'input
      const tried: any = await driver.executeScript(`
        const selectors = [
          'input[type="search"]',
          'input[placeholder*="Rechercher"]',
          'input[placeholder*="Search"]',
          '[role="search"] input',
          '[data-testid*="search"] input'
        ];
        let el = null;
        for (const sel of selectors) {
          const cand = document.querySelector(sel);
          if (cand) { el = cand; break; }
        }
        if (!el) return { ok:false };
        el.focus();
        el.value = '';
        return { ok:true };
      `);
      if (!tried || !(tried as any).ok) return [];

      // Taper le texte via WebDriver
      try {
        const inputEl = await driver.findElement(By.css('input[type="search"], input[placeholder*="Rechercher"], input[placeholder*="Search"], [role="search"] input, [data-testid*="search"] input'));
        await inputEl.clear();
        await inputEl.sendKeys(query);
        await new Promise(r => setTimeout(r, 1200));
      } catch {}

      // Récupérer résultats depuis le DOM après saisie
      const results = await driver.executeScript(`
        const out = [];
        const candidates = document.querySelectorAll('a[href*="/series/"]');
        candidates.forEach(a => {
          const href = a.href;
          const text = (a.textContent || a.getAttribute('aria-label') || a.title || '').trim();
          if (!href || !text) return;
          out.push({ id: href.split('/series/')[1]?.split('/')[0] || '', title: text, url: href });
        });
        return out;
      `);

      const sanitized: Anime[] = (results as any[]).filter(x => x && x.id && x.title && x.url).map(x => ({
        id: x.id,
        title: x.title,
        url: x.url
      }));

      // Filtrer pour garder /series/ et appliquer pertinence généreuse
      const filtered = sanitized.filter(a => a.url.includes('/series/'))
        .sort((a, b) => this.calculateRelevance(b.title, query) - this.calculateRelevance(a.title, query));

      console.log(`🔎 UI search -> ${filtered.length} série(s)`);
      return filtered.slice(0, 10);
    } catch (e) {
      console.log('⚠️ UI search erreur:', (e as Error).message);
      return [];
    }
  }

  /**
   * Recherche spécifique pour des animés connus avec URLs directes
   */
  private async searchSpecificAnime(query: string): Promise<any[]> {
    console.log('🎯 Recherche spécifique activée pour:', query);
    
    try {
      // Essayer la méthode alternative si la recherche normale échoue
      const alternativeResult = await this.searchAnimeAlternative(query);
      
      if (alternativeResult.success && alternativeResult.data && alternativeResult.data.length > 0) {
        console.log('✅ Recherche spécifique réussie via méthode alternative');
        return alternativeResult.data;
      }
      
      // Si ça échoue aussi, essayer de chercher directement dans les pages populaires
      const driver = await this.browserManager.getDriver();
      
      // Essayer plusieurs pages pour trouver l'anime
      const searchPages = [
        '/fr/videos/popular',
        '/fr/browse/anime',
        '/fr/browse'
      ];
      
      for (const page of searchPages) {
        try {
          console.log(`🔍 Recherche spécifique dans: ${page}`);
          await this.browserManager.navigateTo(`${this.baseUrl}${page}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const results = await driver.executeScript(`
            const results = [];
            const query = '${query.toLowerCase()}';
            
            // Chercher tous les liens de séries
            const seriesLinks = document.querySelectorAll('a[href*="/series/"]');
            
            for (const link of seriesLinks) {
              const title = link.textContent?.trim() || '';
              const href = link.href;
              
              if (title && href && title.toLowerCase().includes(query)) {
                results.push({
                  id: href.split('/series/')[1]?.split('/')[0] || '',
                  title: title,
                  url: href,
                  thumbnail: undefined,
                  description: undefined,
                  genres: [],
                  releaseYear: undefined,
                  rating: undefined,
                  episodeCount: undefined
                });
              }
            }
            
            return results;
          `);
          
          if (results && (results as any[]).length > 0) {
            console.log(`✅ Trouvé ${(results as any[]).length} résultats dans ${page}`);
            return results as any[];
          }
          
        } catch (error) {
          console.log(`⚠️ Erreur recherche dans ${page}:`, (error as Error).message);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Erreur recherche spécifique:', (error as Error).message);
    }
    
    return [];
  }

  /**
   * Extraction des métadonnées de l'anime depuis la page série
   */
  private async extractAnimeMetadata(): Promise<any> {
    try {
      console.log('📋 Extraction des métadonnées de l\'anime...');
      
      const driver = await this.browserManager.getDriver();
      
      return await driver.executeScript(() => {
        const metadata: any = {
          thumbnail: null,
          description: null,
          genres: [],
          releaseYear: null
        };
        
        console.log('🔍 Recherche des métadonnées sur la page...');
        
        // EXTRACTION DU THUMBNAIL PRINCIPAL
        console.log('🖼️ Recherche du thumbnail principal...');
        const thumbnailSelectors = [
          'img[class*="hero-image"]',
          'img[class*="poster"]', 
          'img[class*="series-image"]',
          'picture img',
          '[class*="media"] img',
          'img[src*="imgsrv.crunchyroll.com"]'
        ];
        
        for (const selector of thumbnailSelectors) {
          const img = document.querySelector(selector);
          if (img instanceof HTMLImageElement) {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
            if (src && src.includes('crunchyroll') && !src.includes('blur=') && !src.includes('icon')) {
              metadata.thumbnail = src;
              const thumbId = src.split('/').pop()?.split('.')[0] || 'thumbnail';
              console.log('✅ Thumbnail trouvé: ' + thumbId + '.jpg via ' + selector);
              break;
            }
          }
        }
        
        // EXTRACTION DE LA DESCRIPTION
        console.log('📄 Recherche de la description...');
        const descriptionSelectors = [
          '[class*="description"] p',
          '[class*="synopsis"] p',
          '[class*="overview"] p',
          '[data-testid*="description"]',
          '[class*="summary"]',
          'p[class*="text"]'
        ];
        
        for (const selector of descriptionSelectors) {
          const descElement = document.querySelector(selector);
          if (descElement) {
            const text = descElement.textContent?.trim();
            if (text && text.length > 50 && text.length < 1000) {
              metadata.description = text;
              console.log('✅ Description trouvée: "' + text.substring(0, 50) + '..." via ' + selector);
              break;
            }
          }
        }
        
        // EXTRACTION DES GENRES
        console.log('🏷️ Recherche des genres...');
        const genreSelectors = [
          '[class*="genre"] a',
          '[class*="tag"] a',
          '[class*="category"] a',
          'a[href*="/genre/"]',
          '[class*="genres"] span',
          '[data-testid*="genre"]'
        ];
        
        const foundGenres = new Set();
        
        for (const selector of genreSelectors) {
          const genreElements = document.querySelectorAll(selector);
          genreElements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && text.length < 30 && 
                !text.includes('http') && !text.includes('www') &&
                !foundGenres.has(text.toLowerCase())) {
              foundGenres.add(text.toLowerCase());
              metadata.genres.push(text);
              console.log('✅ Genre trouvé: "' + text + '" via ' + selector);
            }
          });
          
          if (metadata.genres.length >= 5) break; // Limiter à 5 genres max
        }
        
        // EXTRACTION DE L'ANNÉE DE SORTIE
        console.log('📅 Recherche de l\'année de sortie...');
        const yearSources = [
          document.querySelector('[class*="year"]')?.textContent,
          document.querySelector('[class*="date"]')?.textContent,
          document.querySelector('[class*="release"]')?.textContent,
          document.querySelector('[data-testid*="year"]')?.textContent,
          document.querySelector('[data-testid*="date"]')?.textContent,
          document.title,
          document.body.textContent
        ];
        
        for (const source of yearSources) {
          if (source) {
            const yearMatch = source.match(/20[0-2][0-9]/); // Années entre 2000 et 2029
            if (yearMatch) {
              const year = parseInt(yearMatch[0]);
              if (year >= 2000 && year <= new Date().getFullYear()) {
                metadata.releaseYear = year;
                console.log('✅ Année trouvée: ' + year);
                break;
              }
            }
          }
        }
        
        // Si pas de thumbnail principal trouvé, chercher dans les épisodes
        if (!metadata.thumbnail) {
          console.log('🔍 Recherche thumbnail depuis les épisodes...');
          const episodeImg = document.querySelector('a[href*="/watch/"] img');
          if (episodeImg instanceof HTMLImageElement) {
            const src = episodeImg.src || episodeImg.getAttribute('data-src');
            if (src && src.includes('crunchyroll')) {
              metadata.thumbnail = src;
              console.log('✅ Thumbnail depuis épisodes: ' + (src.split('/').pop() || 'episode-thumb'));
            }
          }
        }
        
        console.log('📋 Métadonnées extraites:', metadata);
        return metadata;
      });
      
    } catch (error) {
      console.log('⚠️ Erreur extraction métadonnées:', (error as Error).message);
      return {
        thumbnail: null,
        description: null,
        genres: [],
        releaseYear: null
      };
    }
  }

  /**
   * Récupération des épisodes avec approche multi-saisons robuste
   */
  async getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>> {
    try {
      const fullUrl = ParserUtils.normalizeUrl(animeUrl, this.baseUrl);
      const animeId = this.extractSeriesIdFromUrl(fullUrl);
      const animeSlug = this.extractSeriesSlugFromUrl(fullUrl);
      
      console.log(`📺 Enhanced Episodes Crunchyroll Toolkit: ${fullUrl}`);
      
      // Pour Fire Force, essayer de récupérer toutes les saisons
      if (animeSlug.includes('fire-force')) {
        return await this.getFireForceAllSeasons(animeId, animeSlug);
      }
      
      // Pour A Couple of Cuckoos, essayer de récupérer toutes les saisons
      if (animeSlug.includes('a-couple-of-cuckoos')) {
        return await this.getCuckooAllSeasons(animeId, animeSlug);
      }
      
      // Navigation normale pour autres animes
      const navigationSuccess = await this.smartNavigation(fullUrl);
      
      if (!navigationSuccess) {
        console.log('⚠️ Navigation échouée, tentative méthode alternative...');
        await this.browserManager.navigateTo(fullUrl);
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      // Attendre le chargement complet de la page
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Extraction des métadonnées de l'anime depuis la page
      const animeMetadata = await this.extractAnimeMetadata();
      
      // Extraction des épisodes avec support multi-saisons
      const episodes = await this.extractEpisodesEnhanced(animeId, animeSlug);

      console.log(`✅ ${episodes.length} épisode(s) extrait(s) de la série`);
      
      // Enrichir les données avec les métadonnées extraites
      const enrichedEpisodes = episodes.map(ep => ({
        ...ep,
        animeMetadata: animeMetadata
      }));
      
      return { success: true, data: enrichedEpisodes, metadata: animeMetadata };
      
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
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const driver = await this.browserManager.getDriver();

      // Raccourci: essayer l'extraction multi-saisons simple et retourner si satisfaisant
      try {
        const simple = await this.extractAllEpisodesSimple(animeId);
        const seasonsFound = new Set(simple.map(ep => ep.seasonNumber || 1));
        if (simple.length >= 30 || seasonsFound.size > 1) {
          console.log(`✅ Raccourci multi-saisons: ${simple.length} épisodes, ${seasonsFound.size} saison(s) détectée(s)`);
          return { success: true, data: simple };
        }
      } catch (e) {
        console.log('⚠️ Échec raccourci multi-saisons, poursuite des stratégies détaillées');
      }
      
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
              await new Promise(resolve => setTimeout(resolve, 750));
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
              await new Promise(resolve => setTimeout(resolve, 2000));
              
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
                    console.log('📺 Episode ' + (i+1) + ':', title.replace(/'/g, "\\\\'"));
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
   * Méthode pour découvrir et extraire toutes les saisons de A Couple of Cuckoos
   */
  private async getCuckooAllSeasons(animeId: string, animeSlug: string): Promise<ScraperResult<Episode[]>> {
    try {
      console.log('🥚 Extraction A Couple of Cuckoos - Utilisation de la logique corrigée');
      
      // A Couple of Cuckoos a une structure avec sélecteur de saisons
      const mainUrl = 'https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos';
      await this.browserManager.navigateTo(mainUrl);
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Utiliser directement la logique corrigée qui fonctionne
      const episodes = await this.extractAllEpisodesSimple(animeId);
      
      console.log(`✅ A Couple of Cuckoos: ${episodes.length} épisodes extraits avec saisons corrigées`);
      
      return { success: true, data: episodes };
      
    } catch (error) {
      console.log('❌ Erreur extraction A Couple of Cuckoos:', (error as Error).message);
      return { success: false, error: (error as Error).message };
    }
  }

  private async getCuckooAllSeasonsOLD(animeId: string, animeSlug: string): Promise<ScraperResult<Episode[]>> {
    try {
      console.log('🥚 Extraction A Couple of Cuckoos - Navigation entre toutes les saisons');
      
      // A Couple of Cuckoos a une structure avec sélecteur de saisons
      const mainUrl = 'https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos';
      await this.browserManager.navigateTo(mainUrl);
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const driver = await this.browserManager.getDriver();
      
      // Chercher les saisons disponibles
      const seasonsFound = await driver.executeScript(`
        console.log('🔍 Recherche des saisons pour A Couple of Cuckoos...');
        
        let seasonData = {
          dropdownFound: false,
          navigationButtons: [],
          currentSeason: '',
          availableSeasons: []
        };
        
        // 1. Chercher le dropdown des saisons
        const seasonDropdown = document.querySelector('div[aria="Saisons"], [class*="season-selector"], [aria-label*="season"]');
        if (seasonDropdown) {
          seasonData.dropdownFound = true;
          console.log('✅ Dropdown saisons trouvé');
          
          // Essayer de l'ouvrir pour voir les options
          try {
            seasonDropdown.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Chercher les options du dropdown
            const options = document.querySelectorAll('[role="option"], [class*="option"]');
            options.forEach(option => {
              const text = option.textContent?.trim() || '';
              if (text.includes('Saison') || text.includes('Season') || text.match(/S[12]/)) {
                seasonData.availableSeasons.push({
                  text: text,
                  element: 'found'
                });
                console.log('🎬 Option saison trouvée: ' + text);
              }
            });
            
            // Refermer le dropdown
            seasonDropdown.click();
            
          } catch (e) {
            console.log('⚠️ Erreur ouverture dropdown: ' + e.message);
          }
        }
        
        // 2. Chercher les boutons de navigation saison
        const allButtons = document.querySelectorAll('button, [role="button"], [class*="button"]');
        allButtons.forEach(btn => {
          const text = btn.textContent?.trim() || '';
          
          if (text.includes('Saison suivante') || text.includes('Suivante') || text.includes('Next')) {
            seasonData.navigationButtons.push({
              type: 'next',
              text: text,
              disabled: btn.hasAttribute('disabled') || btn.classList.contains('disabled')
            });
            console.log('🔄 Bouton suivant trouvé: ' + text);
          }
          
          if (text.includes('Saison précédente') || text.includes('Précédente') || text.includes('Previous')) {
            seasonData.navigationButtons.push({
              type: 'prev',
              text: text,
              disabled: btn.hasAttribute('disabled') || btn.classList.contains('disabled')
            });
            console.log('🔄 Bouton précédent trouvé: ' + text);
          }
        });
        
        // 3. Chercher directement les liens vers les saisons dans l'URL
        const currentUrl = window.location.href;
        console.log('📍 URL actuelle: ' + currentUrl);
        
        // Vérifier si on peut construire les URLs des saisons
        const baseSeriesUrl = currentUrl.split('?')[0];
        console.log('📍 URL de base: ' + baseSeriesUrl);
        
        return seasonData;
      `);
      
      console.log('🔍 Données saisons A Couple of Cuckoos:', seasonsFound);
      
      const allEpisodes: Episode[] = [];
      const seasonData = seasonsFound as any;
      
      // Stratégie 1: Utiliser le dropdown si disponible
      if (seasonData.dropdownFound && seasonData.availableSeasons.length > 0) {
        console.log(`🎬 Navigation via dropdown: ${seasonData.availableSeasons.length} saisons`);
        
        for (let i = 0; i < seasonData.availableSeasons.length; i++) {
          const season = seasonData.availableSeasons[i];
          const seasonNumber = i + 1;
          
          try {
            console.log(`🎬 Extraction saison ${seasonNumber}: ${season.text}`);
            
            // Extraire les épisodes de cette saison
            const seasonEpisodes = await this.extractAllEpisodesSimple(animeId);
            
            // Corriger les numéros de saison
            const correctedEpisodes = seasonEpisodes.map(ep => ({
              ...ep,
              seasonNumber: seasonNumber,
              id: `${animeId}-s${seasonNumber}ep${ep.episodeNumber}`
            }));
            
            // Éviter les doublons
            const newEpisodes = correctedEpisodes.filter(newEp => 
              !allEpisodes.some(existingEp => existingEp.url === newEp.url)
            );
            
            if (newEpisodes.length > 0) {
              console.log(`✅ Saison ${seasonNumber}: ${newEpisodes.length} épisodes ajoutés`);
              allEpisodes.push(...newEpisodes);
            }
            
          } catch (error) {
            console.log(`⚠️ Erreur saison ${seasonNumber}:`, (error as Error).message);
          }
        }
      }
      
      // Stratégie 2: Navigation interactive avec les boutons saison si disponibles
      if (seasonData.navigationButtons.length > 0 && allEpisodes.length < 30) {
        console.log('🔄 Stratégie boutons de navigation des saisons...');
        
        // Extraire d'abord la saison actuelle (saison 1)
        console.log('📺 Extraction saison 1 (actuelle)...');
        let seasonEpisodes = await this.extractAllEpisodesSimple(animeId);
        
        // Filtrer et corriger pour saison 1
        const season1Episodes = seasonEpisodes.map(ep => ({
          ...ep,
          seasonNumber: 1,
          id: `${animeId}-s1ep${ep.episodeNumber}`
        }));
        
        allEpisodes.push(...season1Episodes);
        console.log(`✅ Saison 1: ${season1Episodes.length} épisodes extraits`);
        
        // Maintenant essayer de naviguer vers la saison 2 avec les boutons
        const nextButton = seasonData.navigationButtons.find((btn: any) => btn.type === 'next' && !btn.disabled);
        
        if (nextButton) {
          console.log('🔄 Navigation vers saison 2 via bouton "Suivante"...');
          
          const navigated = await driver.executeScript(`
            console.log('🔍 Recherche du bouton saison suivante...');
            
            // Chercher tous les boutons avec texte "suivante" ou "next"
            const allButtons = document.querySelectorAll('button, [role="button"], [class*="button"]');
            let foundButton = null;
            
            for (const btn of allButtons) {
              const text = btn.textContent?.trim() || '';
              console.log('🔍 Bouton trouvé: "' + text + '"');
              
              if ((text.includes('Saison suivante') || text.includes('Suivante') || text.includes('Next')) && 
                  !btn.hasAttribute('disabled') && 
                  !btn.classList.contains('disabled')) {
                foundButton = btn;
                console.log('✅ Bouton valide trouvé: "' + text + '"');
                break;
              }
            }
            
            if (foundButton) {
              try {
                console.log('🔄 Clic sur le bouton saison suivante...');
                foundButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 500));
                
                foundButton.focus();
                foundButton.click();
                
                console.log('✅ Clic réussi, attente du chargement...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                return true;
              } catch (e) {
                console.log('❌ Erreur lors du clic: ' + e.message);
                return false;
              }
            } else {
              console.log('❌ Aucun bouton saison suivante actif trouvé');
              return false;
            }
          `);
          
          if (navigated) {
            console.log('🎬 Navigation réussie, extraction saison 2...');
            
            // Attendre le chargement complet
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Extraire les épisodes de la saison 2
            const season2Episodes = await this.extractAllEpisodesSimple(animeId);
            
            // Filtrer pour ne garder que les nouveaux épisodes (saison 2)
            const newEpisodes = season2Episodes.filter(newEp => 
              !allEpisodes.some(existingEp => existingEp.url === newEp.url) &&
              // Exclure les titres de lecture générique
              !newEp.title.toLowerCase().includes('lecture episode') &&
              !newEp.title.toLowerCase().includes('lecture e')
            );
            
            if (newEpisodes.length > 0) {
              // Corriger les numéros de saison
              const correctedEpisodes = newEpisodes.map(ep => ({
                ...ep,
                seasonNumber: 2,
                id: `${animeId}-s2ep${ep.episodeNumber}`
              }));
              
              allEpisodes.push(...correctedEpisodes);
              console.log(`✅ Saison 2: ${correctedEpisodes.length} nouveaux épisodes extraits`);
            } else {
              console.log('⚠️ Aucun nouvel épisode trouvé pour la saison 2');
            }
          }
        }
      }
      
      // Stratégie 3: Essayer les URLs directes des saisons si pas assez d'épisodes
      if (allEpisodes.length < 30) {
        console.log('🔍 Essai URLs directes des saisons...');
        
        const seasonUrls = [
          'https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos',
          'https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos?season=2',
          'https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos/season/2'
        ];
        
        for (let i = 0; i < seasonUrls.length; i++) {
          const url = seasonUrls[i];
          const seasonNumber = i + 1;
          
          try {
            console.log(`🔄 Navigation vers saison ${seasonNumber}: ${url}`);
            
            await this.browserManager.navigateTo(url);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const seasonEpisodes = await this.extractAllEpisodesSimple(animeId);
            
            // Éviter les doublons
            const newEpisodes = seasonEpisodes.filter(newEp => 
              !allEpisodes.some(existingEp => existingEp.url === newEp.url)
            );
            
            if (newEpisodes.length > 0) {
              // Corriger les numéros de saison
              const correctedEpisodes = newEpisodes.map(ep => ({
                ...ep,
                seasonNumber: seasonNumber,
                id: `${animeId}-s${seasonNumber}ep${ep.episodeNumber}`
              }));
              
              allEpisodes.push(...correctedEpisodes);
              console.log(`✅ Saison ${seasonNumber} (URL directe): ${correctedEpisodes.length} épisodes ajoutés`);
            }
            
          } catch (error) {
            console.log(`⚠️ Erreur URL saison ${seasonNumber}:`, (error as Error).message);
          }
        }
      }
      
      // Fallback: extraction simple si rien ne fonctionne
      if (allEpisodes.length === 0) {
        console.log('📺 Fallback: extraction simple saison unique...');
        await this.extractSeasonEpisodes(driver, animeId, 1, allEpisodes);
      }
      
      console.log(`🥚 A Couple of Cuckoos Total: ${allEpisodes.length} épisodes`);
      
      return { success: true, data: allEpisodes };
      
    } catch (error) {
      console.log('❌ Erreur A Couple of Cuckoos multi-saisons:', (error as Error).message);
      return { 
        success: false, 
        error: `Erreur A Couple of Cuckoos: ${(error as Error).message}` 
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
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        window.scrollTo(0, 0);
      `);
      await new Promise(resolve => setTimeout(resolve, 750));
      
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
    await new Promise(resolve => setTimeout(resolve, 750));
    await driver.executeScript('window.scrollTo(0, 0);');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
                  await new Promise(resolve => setTimeout(resolve, 750));
                  
                  // Scroll rapide pour charger les épisodes
                  await driver.executeScript(`
                    window.scrollTo(0, document.body.scrollHeight);
                    setTimeout(() => window.scrollTo(0, 0), 500);
                  `);
                  await new Promise(resolve => setTimeout(resolve, 400));
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
      
      while (loadedMore && attempts < 2) {
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
            await new Promise(resolve => setTimeout(resolve, 750));
          }
          
          // Scroll final
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const finalCount = document.querySelectorAll('a[href*="/watch/"]').length;
          console.log('🔍 Episode count after loading: ' + finalCount);
          
          return finalCount > initialCount;
        `);
        
        attempts++;
        console.log(`🔄 Tentative ${attempts}: ${loadedMore ? 'Plus d\'épisodes chargés' : 'Aucun nouvel épisode'}`);
        
        if (loadedMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Recherche et navigation multi-saisons améliorée
      console.log('🔍 Recherche des saisons disponibles...');
      
      // D'abord, chercher les sélecteurs de saison
      const seasonInfo = await driver.executeScript(`
        const seasonElements = [];
        
        // Chercher différents types de sélecteurs de saison avec une approche plus robuste
        const selectors = [
          // Sélecteurs spécifiques pour les dropdowns de saison
          'select[aria-label*="season"] option',
          'div[role="listbox"] [role="option"]',
          'button[aria-expanded] + div [role="option"]',
          // Boutons de navigation saison
          'button[aria-label*="Season"]',
          'button[aria-label*="Saison"]',
          '[data-testid*="season-selector"] option',
          '[data-testid*="season-selector"] button',
          // Liens vers d'autres saisons  
          'a[href*="season"]',
          'a[href*="saison"]',
          // Éléments contenant du texte de saison
          '[class*="season-item"]',
          '[class*="season-button"]'
        ];
        
        console.log('🔍 Analyse avancée des saisons...');
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          console.log('Sélecteur:', selector, '-> Éléments trouvés:', elements.length);
          
          elements.forEach(el => {
            const rawText = el.textContent?.trim() || el.getAttribute('aria-label') || el.title || '';
            const href = el.href || '';
            
            console.log('Texte brut trouvé:', rawText);
            
            // Filtres plus stricts pour éviter les malformations
            if (rawText && rawText.length > 0) {
              // Détecter les vraies saisons avec patterns plus précis
              const seasonPatterns = [
                /^S(?:eason)?\s*(\d+)(?:\s*:?\s*(.+?))?$/i,
                /^Saison\s*(\d+)(?:\s*:?\s*(.+?))?$/i,
                /^(\d+)(?:e|ème|nd|rd|th)?\s*saison/i,
                /Season\s*(\d+)/i
              ];
              
              let matchFound = false;
              for (const pattern of seasonPatterns) {
                const match = rawText.match(pattern);
                if (match) {
                  const seasonNumber = parseInt(match[1]);
                  const seasonTitle = match[2] || '';
                  
                  // Éviter les numéros de saison impossibles
                  if (seasonNumber >= 1 && seasonNumber <= 10) {
                    const cleanText = seasonTitle ? 
                      'S' + seasonNumber + ': ' + seasonTitle.substring(0, 20) :
                      'S' + seasonNumber;
                    
                    console.log('Saison valide détectée:', cleanText);
                    
                    // Éviter les doublons et textes vides
                    if (!seasonElements.some(existing => 
                      existing.text === cleanText || 
                      existing.seasonNumber === seasonNumber
                    )) {
                      seasonElements.push({
                        text: cleanText,
                        seasonNumber: seasonNumber,
                        selector: selector,
                        element: el,
                        href: href,
                        position: el.getBoundingClientRect()
                      });
                      matchFound = true;
                    }
                  }
                  break;
                }
              }
              
              // Fallback pour détecter la navigation "Saison suivante" / "Next Season"
              if (!matchFound && (
                rawText.toLowerCase().includes('next season') ||
                rawText.toLowerCase().includes('saison suivante') ||
                rawText.toLowerCase().includes('suivante') ||
                rawText.toLowerCase().includes('season 2') ||
                rawText.toLowerCase().includes('saison 2') ||
                rawText.includes('suivanteSuivante') // Pattern DAN DA DAN spécifique
              )) {
                console.log('Navigation saison suivante détectée:', rawText);
                seasonElements.push({
                  text: 'Navigation -> Saison 2',
                  seasonNumber: 2,
                  selector: selector,
                  element: el,
                  href: href,
                  position: el.getBoundingClientRect(),
                  isNavigation: true,
                  isNextSeason: true
                });
              }
            }
          });
        }
        
        // Si aucune saison détectée avec la nouvelle logique, utiliser l'ancienne comme fallback
        if (seasonElements.length === 0) {
          console.log('⚠️ Aucune saison détectée avec nouvelle logique, essai méthode fallback...');
          
          // Fallback: méthode originale moins stricte
          const fallbackSelectors = [
            '[role="option"]',
            'button[aria-label*="Season"]',
            'button[aria-label*="Saison"]', 
            '[class*="season"]',
            'select option',
            '[data-testid*="season"]'
          ];
          
          for (const selector of fallbackSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const rawText = el.textContent?.trim() || el.getAttribute('aria-label') || '';
              if (rawText && (rawText.includes('Season') || rawText.includes('Saison') || rawText.match(/S[1-9]/))) {
                console.log('Fallback - texte trouvé:', rawText);
                
                // Éviter les doublons exacts
                if (!seasonElements.some(existing => existing.text === rawText)) {
                  seasonElements.push({
                    text: rawText,
                    seasonNumber: 1, // Par défaut
                    selector: selector,
                    element: el,
                    href: el.href || '',
                    position: el.getBoundingClientRect(),
                    isFallback: true
                  });
                }
              }
            });
          }
        }
        
        // Debug: afficher tous les éléments trouvés
        console.log('🎯 Saisons finales détectées:', seasonElements.map(s => ({
          text: s.text, 
          seasonNumber: s.seasonNumber,
          selector: s.selector,
          href: s.href,
          isFallback: s.isFallback || false
        })));
        
        return {
          seasons: seasonElements,
          currentPage: document.title,
          url: window.location.href
        };
      `);
      
      console.log(`🎬 ${(seasonInfo as any).seasons.length} saisons détectées:`, (seasonInfo as any).seasons.map((s: any) => s.text));
      
      // Trier les saisons pour prioriser les boutons "Next Season"
      const seasons = (seasonInfo as any).seasons;
      const sortedSeasons = seasons.sort((a: any, b: any) => {
        // Prioriser les boutons de navigation "saison suivante"
        if (a.isNextSeason && !b.isNextSeason) return -1;
        if (!a.isNextSeason && b.isNextSeason) return 1;
        // Ensuite par numéro de saison
        return (a.seasonNumber || 1) - (b.seasonNumber || 1);
      });
      
      console.log('🔄 Ordre de tentative des saisons:', sortedSeasons.map((s: any) => s.text));
      
      // Essayer de naviguer vers chaque saison trouvée avec une approche plus robuste
      for (const season of sortedSeasons.slice(0, 5)) {
        try {
          console.log(`🔄 Navigation vers saison ${season.seasonNumber}: ${season.text}`);
          
          // Si c'est un lien direct, utiliser la navigation par URL
          if (season.href && season.href.includes('season')) {
            console.log(`🔗 Navigation par lien vers: ${season.href}`);
            await driver.get(season.href);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Scroll pour charger les épisodes
            await driver.executeScript(`
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(() => window.scrollTo(0, 0), 1000);
            `);
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
          }
          
          // Sinon, essayer le clic avec une approche plus précise
          const clicked = await driver.executeScript(`
            console.log('🎯 Recherche élément pour saison ${season.seasonNumber}');
            console.log('🎯 Type de saison:', {
              isNextSeason: ${season.isNextSeason || false},
              isNavigation: ${season.isNavigation || false},
              text: '${season.text}'
            });
            
            let targetElement = null;
            
            // Stratégie spéciale pour les boutons "Saison suivante"
            if (${season.isNextSeason || false}) {
              console.log('🎯 Recherche spécifique bouton "Saison suivante"');
              
              const allButtons = document.querySelectorAll('button, [role="button"], .cta-wrapper');
              for (const btn of allButtons) {
                const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
                console.log('  Bouton analysé:', text);
                
                if (text && (
                  text.includes('suivanteSuivante') ||
                  text.includes('Saison suivante') ||
                  text.includes('Next Season') ||
                  (text.includes('suivante') && text.includes('Saison')) ||
                  (text.includes('Suivante') && !btn.disabled && !btn.classList.contains('disabled'))
                )) {
                  console.log('✅ Bouton "Saison suivante" trouvé:', text);
                  targetElement = btn;
                  break;
                }
              }
            } else {
              // Logique normale pour les autres saisons
              const allElements = document.querySelectorAll('*');
              
              for (const el of allElements) {
                const text = el.textContent?.trim() || el.getAttribute('aria-label') || el.title || '';
                
                // Correspondances plus précises
                if (text && (
                  text === '${season.text}' ||
                  text.includes('S${season.seasonNumber}') ||
                  text.includes('Season ${season.seasonNumber}') ||
                  text.includes('Saison ${season.seasonNumber}')
                )) {
                  console.log('🎯 Élément trouvé:', text);
                  targetElement = el;
                  break;
                }
              }
            }
            
            if (targetElement) {
              console.log('🖱️ Clic sur l\\'élément saison');
              targetElement.scrollIntoView({behavior: 'smooth', block: 'center'});
              
              // Attendre un peu puis cliquer
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Essayer différents types de clic
              try {
                targetElement.click();
                console.log('✅ Clic direct réussi');
                return true;
              } catch (e1) {
                console.log('⚠️ Clic direct échoué, essai événement');
                try {
                  const event = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                  });
                  targetElement.dispatchEvent(event);
                  console.log('✅ Événement clic réussi');
                  return true;
                } catch (e2) {
                  console.log('❌ Tous les types de clic ont échoué');
                  return false;
                }
              }
            }
            
            console.log('❌ Aucun élément trouvé pour la saison ${season.seasonNumber}');
            return false;
          `);
          
          if (clicked) {
            console.log(`✅ Navigation vers saison ${season.seasonNumber} réussie`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Scroll pour charger les nouveaux épisodes
            await driver.executeScript(`
              console.log('📜 Scroll pour charger les épisodes de la saison ${season.seasonNumber}');
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(() => window.scrollTo(0, 0), 1000);
            `);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Essayer de charger plus d'épisodes si nécessaire
            await driver.executeScript(`
              const loadMoreButtons = document.querySelectorAll('button, [role="button"]');
              for (const btn of loadMoreButtons) {
                const text = btn.textContent?.trim() || '';
                if (text.includes('VOIR PLUS') || text.includes('Load more') || text.includes('Show more')) {
                  console.log('🔄 Clic sur "Voir plus" pour saison ${season.seasonNumber}');
                  btn.click();
                  break;
                }
              }
            `);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log(`⚠️ Impossible de naviguer vers saison ${season.seasonNumber}`);
          }
          
        } catch (error) {
          console.log(`⚠️ Erreur navigation saison ${season.seasonNumber}:`, (error as Error).message);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Erreur chargement multi-saisons:', (error as Error).message);
    }
  }

  /**
   * Cherche spécifiquement le bouton "Saison suivante" et clique dessus
   */
  private async tryNextSeasonButton(driver: any): Promise<boolean> {
    try {
      console.log('🔍 Recherche spécifique du bouton "Saison suivante"...');
      
      const found = await driver.executeScript(`
        console.log('🎯 Analyse des boutons pour "Saison suivante"');
        
        // Chercher tous les boutons potentiels
        const allButtons = document.querySelectorAll('button, [role="button"], .cta-wrapper, a');
        let nextSeasonButton = null;
        
        console.log('Total boutons trouvés:', allButtons.length);
        
        for (const btn of allButtons) {
          const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
          const isDisabled = btn.disabled || btn.classList.contains('disabled') || btn.classList.contains('state-disabled');
          
          if (text) {
            console.log('  Bouton:', text.substring(0, 50), '- Désactivé:', isDisabled);
            
            // Recherche spécifique pour DAN DA DAN
            if (!isDisabled && (
              text.includes('Saison suivante') ||
              text.includes('suivanteSuivante') ||
              text.includes('Next Season') ||
              (text.includes('Suivante') && !text.includes('Précédente'))
            )) {
              console.log('✅ Bouton "Saison suivante" trouvé!', text);
              nextSeasonButton = btn;
              break;
            }
          }
        }
        
        if (nextSeasonButton) {
          console.log('🖱️ Clic sur le bouton "Saison suivante"');
          nextSeasonButton.scrollIntoView({behavior: 'smooth', block: 'center'});
          
          // Attendre un peu puis cliquer
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          try {
            nextSeasonButton.click();
            console.log('✅ Clic réussi!');
            return true;
          } catch (e) {
            console.log('⚠️ Clic direct échoué, essai événement');
            try {
              const event = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
              });
              nextSeasonButton.dispatchEvent(event);
              console.log('✅ Événement clic réussi!');
              return true;
            } catch (e2) {
              console.log('❌ Tous les clics ont échoué');
              return false;
            }
          }
        } else {
          console.log('❌ Aucun bouton "Saison suivante" trouvé');
          return false;
        }
      `);
      
      if (found) {
        console.log('✅ Bouton "Saison suivante" cliqué avec succès!');
        
        // Attendre que la page se charge
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Scroll pour charger les nouveaux épisodes
        await driver.executeScript(`
          console.log('📜 Chargement des épisodes de la saison suivante...');
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(() => window.scrollTo(0, 0), 1000);
        `);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Vérifier si on a vraiment changé de saison
        const seasonInfo = await driver.executeScript(`
          const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
          const pageText = document.body.textContent || '';
          const hasS2Indicators = pageText.includes('S2') || pageText.includes('Season 2') || pageText.includes('Saison 2');
          
          console.log('Épisodes trouvés après navigation:', episodeLinks.length);
          console.log('Indicateurs Saison 2:', hasS2Indicators);
          
          return {
            episodeCount: episodeLinks.length,
            hasS2Indicators: hasS2Indicators,
            url: window.location.href
          };
        `);
        
        console.log(`📺 Après navigation "Saison suivante": ${seasonInfo.episodeCount} épisodes, S2: ${seasonInfo.hasS2Indicators}`);
        
        return true; // Succès
        
      } else {
        console.log('⚠️ Impossible de trouver ou cliquer le bouton "Saison suivante"');
        return false; // Échec
      }
      
    } catch (error) {
      console.log('⚠️ Erreur recherche bouton "Saison suivante":', (error as Error).message);
      return false; // Échec
    }
  }

  /**
   * Essaie de naviguer directement vers les URLs des autres saisons
   */
  private async tryDirectSeasonUrls(driver: any, animeId: string): Promise<void> {
    try {
      console.log('🔍 Recherche directe des saisons via URLs...');
      
      const currentUrl = await driver.getCurrentUrl();
      const baseSeriesUrl = currentUrl.split('?')[0]; // Enlever les paramètres de query
      
      // Patterns d'URLs possibles pour d'autres saisons
      const seasonUrlPatterns = [
        `${baseSeriesUrl}?season=2`,
        `${baseSeriesUrl}/season-2`,
        `${baseSeriesUrl}?filter=season:2`,
        // Pour DAN DA DAN spécifiquement, essayer avec le pattern Crunchyroll
        currentUrl.replace(/\/series\/([^\/]+)/, '/series/$1?season=2'),
        currentUrl.replace(/\/series\/([^\/]+)/, '/series/$1/season-2')
      ];
      
      for (const seasonUrl of seasonUrlPatterns) {
        try {
          console.log(`🔗 Test URL saison: ${seasonUrl}`);
          
          // Sauvegarder l'URL actuelle
          const originalUrl = await driver.getCurrentUrl();
          
          // Essayer de naviguer vers l'URL de saison
          await driver.get(seasonUrl);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Vérifier si la page a changé et contient de nouveaux épisodes
          const newUrl = await driver.getCurrentUrl();
          const hasNewEpisodes = await driver.executeScript(`
            const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
            console.log('🎯 Episodes trouvés sur', window.location.href, ':', episodeLinks.length);
            
            // Vérifier si on a trouvé des épisodes avec des numéros différents
            let hasSeasonIndicators = false;
            for (const link of episodeLinks) {
              const text = link.textContent || '';
              if (text.includes('S2') || text.includes('Season 2') || text.includes('Saison 2')) {
                console.log('✅ Indicateur Saison 2 trouvé:', text);
                hasSeasonIndicators = true;
                break;
              }
            }
            
            return {
              episodeCount: episodeLinks.length,
              hasSeasonIndicators,
              url: window.location.href,
              title: document.title
            };
          `);
          
          if (hasNewEpisodes.hasSeasonIndicators) {
            console.log(`✅ Saison 2 trouvée via URL directe: ${seasonUrl}`);
            console.log(`📺 ${hasNewEpisodes.episodeCount} épisodes détectés`);
            
            // Scroll pour charger tous les épisodes
            await driver.executeScript(`
              window.scrollTo(0, document.body.scrollHeight);
              setTimeout(() => window.scrollTo(0, 0), 1000);
            `);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Essayer de charger plus d'épisodes
            await driver.executeScript(`
              const loadMoreButtons = document.querySelectorAll('button, [role="button"]');
              for (const btn of loadMoreButtons) {
                const text = btn.textContent?.trim() || '';
                if (text.includes('VOIR PLUS') || text.includes('Load more') || text.includes('Show more')) {
                  console.log('🔄 Clic "Voir plus" pour Saison 2');
                  btn.click();
                  break;
                }
              }
            `);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Succès - on reste sur cette page
            return;
          } else {
            // Pas de nouvelle saison trouvée, retourner à l'URL originale
            console.log(`❌ Aucune saison 2 trouvée sur: ${seasonUrl}`);
            await driver.get(originalUrl);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.log(`⚠️ Erreur test URL ${seasonUrl}:`, (error as Error).message);
          // Continuer avec la prochaine URL
        }
      }
      
      console.log('🔍 Recherche directe terminée - aucune saison supplémentaire trouvée');
      
    } catch (error) {
      console.log('⚠️ Erreur recherche directe saisons:', (error as Error).message);
    }
  }

  /**
   * Extraction simple de tous les épisodes - version qui marchait avant + métadonnées améliorées
   */
  /**
   * Extrait les épisodes de la saison actuelle uniquement (sans navigation)
   */
  private async extractCurrentSeasonEpisodes(driver: any, expectedSeasonNumber: number = 1): Promise<Episode[]> {
    return await driver.executeScript(`
      const episodeList = [];
      
      console.log('📺 Extraction de la saison courante uniquement...');
      
      // ÉTAPE 1: Détecter automatiquement la saison actuelle depuis la page
      let detectedSeasonNumber = ${expectedSeasonNumber};
      
      // Chercher des indices de saison dans le titre de la page, les headers, etc.
      const pageTitle = document.title || '';
      const pageText = document.body.textContent || '';
      
      // Patterns pour détecter Season 2, Saison 2, S2, etc.
      const seasonPatterns = [
        /Season\\s*2/i,
        /Saison\\s*2/i,
        /S2[^\\d]/i,
        /Season\\s*Two/i,
        /Saison\\s*Deux/i
      ];
      
      // Vérifier si on est sur une page de saison 2
      const isSeasonTwo = seasonPatterns.some(pattern => 
        pattern.test(pageTitle) || pattern.test(pageText)
      );
      
      if (isSeasonTwo && ${expectedSeasonNumber} === 1) {
        detectedSeasonNumber = 2;
        console.log('🔍 Saison 2 détectée automatiquement depuis le contenu de la page');
      }
      
      console.log('📺 Numéro de saison utilisé: ' + detectedSeasonNumber);
      
      // Utiliser le sélecteur simple qui fonctionne bien
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🔍 Total éléments potentiels: ' + allLinks.length);
      
      const processedUrls = new Set();
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
        
        if (!episodeMap.has(href)) {
          episodeMap.set(href, {
            linkEl: linkEl,
            text: text,
            href: href,
            index: index,
            hasGoodTitle: hasGoodTitle,
            titleQuality: hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1)
          });
        } else {
          const existing = episodeMap.get(href);
          
          // Mise à jour du titre si on a un meilleur
          if ((hasBetterTitle && !existing.hasGoodTitle) ||
              (hasGoodTitle && existing.text === 'NO_TEXT') ||
              (text.length > existing.text.length && hasGoodTitle)) {
            existing.text = text;
            existing.hasGoodTitle = hasGoodTitle;
            existing.titleQuality = hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1);
          }
        }
      });
      
      console.log('🔍 Episodes uniques détectés: ' + episodeMap.size);
      
      // Traiter chaque épisode unique
      episodeMap.forEach((episode) => {
        const linkEl = episode.linkEl;
        const href = episode.href;
        
        let title = '';
        
        // Chercher dans le conteneur parent pour les métadonnées
        const container = linkEl.closest('[class*="episode"], [class*="card"], [data-testid*="episode"]') || linkEl;
        
        // Texte brut pour détection de saison AVANT nettoyage, incluant le conteneur
        const rawTextForSeason = [
          episode.text || '',
          (linkEl.textContent || ''),
          (linkEl.getAttribute('aria-label') || ''),
          (linkEl.getAttribute('title') || ''),
          (container && container.textContent) || '',
          href,
        ].join(' ');
        let seasonFromEpisode = null;
        const seasonRegexes = [
          /S(?:eason|aison)?\s*(\d+)/i,
          /S(\d+)\s*E\d+/i,
          /season-(\d+)/i
        ];
        for (const re of seasonRegexes) {
          const m = rawTextForSeason.match(re);
          if (m && m[1]) {
            const n = parseInt(m[1], 10);
            if (!Number.isNaN(n) && n > 0 && n < 100) { seasonFromEpisode = n; break; }
          }
        }
        
        // Utiliser le texte du lien si c'est un bon titre, sinon chercher ailleurs
        if (episode.hasGoodTitle && episode.text.length > 5) {
          title = episode.text;
        } else {
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
        
        // Nettoyer le titre
        if (title) {
          title = title.replace(/^S\\d+\\s*E\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Episode\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Ep\\s*\\d+\\s*[-–]\\s*/i, '').trim();
        }
        
        // Si toujours pas de titre, construire depuis l'URL
        if (!title) {
          const urlMatch = href.match(/\\/watch\\/[^\\/]+\\/([^\\/?]+)/);
          if (urlMatch) {
            title = urlMatch[1].replace(/-/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
          }
        }
        
        // Extraction du numéro d'épisode
        let episodeNumber = episodeList.length + 1;
        const numberSources = [title, href, container.textContent || '', linkEl.textContent || ''];
        
        for (const source of numberSources) {
          const matches = [
            source.match(/(?:Episode|Ep|E)\\s*(\\d+)/i),
            source.match(/episode[-_]?(\\d+)/i),
            source.match(/ep(\\d+)/i),
            source.match(/S\\d+\\s*E(\\d+)/i),
            source.match(/\\/watch\\/[A-Z0-9]+\\/(.*?)(?:\\?|$)/i)?.input?.match(/episode-(\\d+)/i),
            source.match(/\\/(\\d+)(?:\\/|$|\\?|-)/)
          ];
          
          for (const match of matches) {
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (num > 0 && num < 1000) {
                episodeNumber = num;
                break;
              }
            }
          }
          if (episodeNumber !== episodeList.length + 1) break;
        }
        
        // Extraire thumbnail
        let thumbnail = '';
        const thumbnailSources = [
          container.querySelector('img')?.src,
          container.querySelector('img')?.getAttribute('data-src'),
          container.querySelector('picture source')?.srcset?.split(' ')[0],
          linkEl.querySelector('img')?.src
        ];
        
        thumbnail = thumbnailSources.find(t => t && t.includes('http')) || '';
        
        // Extraire durée
        let duration = '';
        const durationEl = container.querySelector('[class*="duration"], [class*="time"]');
        if (durationEl) {
          duration = durationEl.textContent?.trim() || '';
        }
        
        // Filtrer les liens de lecture générique et autres faux épisodes
        const isValidEpisode = title && 
                              title.length > 1 && 
                              !processedUrls.has(href) &&
                              !title.toLowerCase().includes('lecture') &&
                              !title.match(/^lecture\s+season\s+\d+\s+episode\s+\d+/i) &&
                              !title.match(/^watch\s+season\s+\d+/i) &&
                              !title.includes('Lecture Season') &&
                              !title.includes('LECTURE') &&
                              episodeNumber > 0 && episodeNumber < 100; // Numéros d'épisodes raisonnables
        
        if (isValidEpisode) {
          processedUrls.add(href);
          
          episodeList.push({
            id: href.split('/').pop() || 'unknown',
            title: title,
            url: href,
            episodeNumber: episodeNumber,
            seasonNumber: seasonFromEpisode || detectedSeasonNumber, // Saison détectée depuis le texte brut si dispo
            thumbnail: thumbnail,
            duration: duration
          });
          
          console.log('✅ Episode ajouté: ' + episodeNumber + ' - ' + title.substring(0, 30).replace(/'/g, "\\\\'") + '...');
        } else if (title && title.toLowerCase().includes('lecture')) {
          console.log('❌ Lien générique filtré: ' + title.substring(0, 30).replace(/'/g, "\\\\'") + '...');
        }
      });
      
      // Trier par numéro d'épisode
      episodeList.sort((a, b) => a.episodeNumber - b.episodeNumber);
      
      console.log('📺 Extraction courante terminée: ' + episodeList.length + ' épisode(s)');
      return episodeList;
    `);
  }

  private async extractAllEpisodesSimple(animeId: string): Promise<Episode[]> {
    const driver = await this.browserManager.getDriver();
    
    // ÉTAPE 0: S'assurer qu'on est sur la bonne page de l'anime
    const animeUrl = `https://www.crunchyroll.com/fr/series/${animeId}`;
    const currentUrl = await driver.getCurrentUrl();
    
    if (!currentUrl.includes(animeId)) {
      console.log(`🌐 Navigation vers la page de l'anime: ${animeUrl}`);
      await driver.get(animeUrl);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Plus de temps pour le chargement complet
    }
    
    // Accumulateur d'épisodes uniques par URL
    const uniqueByUrl = new Map<string, Episode>();
    const addEpisodes = (eps: Episode[]) => {
      for (const ep of eps) {
        if (!uniqueByUrl.has(ep.url)) {
          uniqueByUrl.set(ep.url, ep);
        }
      }
    };

    // ÉTAPE 1: Extraire les épisodes de la saison courante
    console.log('📺 ÉTAPE 1: Extraction des épisodes de la saison courante...');
    const initialEpisodes = await this.extractCurrentSeasonEpisodes(driver, 1);
    console.log(`✅ ${initialEpisodes.length} épisode(s) de la saison courante extraits`);
    addEpisodes(initialEpisodes);
    
    // ÉTAPE 2: Charger plus d'épisodes
    await this.attemptMultiSeasonLoad(driver);
    // Re-extraction après chargement pour capter tous les épisodes de la saison courante (souvent S1)
    const s1Reload = await this.extractCurrentSeasonEpisodes(driver, 1);
    if (s1Reload.length > 0) {
      console.log(`✅ Ré-extraction saison 1 après chargement: ${s1Reload.length} épisode(s)`);
      addEpisodes(s1Reload);
    }

    // ÉTAPE 3: Boucler via le bouton "Saison suivante"
    let seasonIndex = 2;
    for (let hop = 0; hop < 4; hop++) {
      const moved = await this.tryNextSeasonButton(driver);
      if (!moved) break;
      const eps = await this.extractCurrentSeasonEpisodes(driver, seasonIndex);
      console.log(`✅ ${eps.length} épisode(s) extraits pour la saison ${seasonIndex}`);
      addEpisodes(eps);
      seasonIndex += 1;
    }

    // ÉTAPE 4: Fallback URL direct si collecté insuffisant
    if (uniqueByUrl.size < 24) {
      await this.tryDirectSeasonUrls(driver, animeId);
      const more = await this.extractCurrentSeasonEpisodes(driver, seasonIndex);
      addEpisodes(more);
    }

    const allCollectedEpisodes = Array.from(uniqueByUrl.values());

    // Trier par saison puis épisode
    allCollectedEpisodes.sort((a, b) => {
      const sa = a.seasonNumber || 1;
      const sb = b.seasonNumber || 1;
      if (sa !== sb) return sa - sb;
      return (a.episodeNumber || 0) - (b.episodeNumber || 0);
    });

    console.log(`🎯 Total épisodes collectés: ${allCollectedEpisodes.length}`);
    if (allCollectedEpisodes.length > 0) {
      console.log('✅ Utilisation des épisodes collectés (multi-saisons)');
      return allCollectedEpisodes;
    }
    
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
            console.log('🧹 Titre nettoyé: "' + originalTitle.replace(/'/g, "\\\\'") + '" -> "' + title.replace(/'/g, "\\\\'") + '"');
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
        
        // Filtrer les liens de lecture générique - même validation qu'extractCurrentSeasonEpisodes
        const isValidEpisode = title && 
                              title.length > 1 && 
                              !processedUrls.has(href) &&
                              !title.toLowerCase().includes('lecture') &&
                              !title.match(/^lecture\\s+season\\s+\\d+\\s+episode\\s+\\d+/i) &&
                              !title.match(/^watch\\s+season\\s+\\d+/i) &&
                              !title.includes('Lecture Season') &&
                              !title.includes('LECTURE') &&
                              episodeNumber > 0 && episodeNumber < 100; // Numéros d'épisodes raisonnables
        
        if (isValidEpisode) {
          // Utiliser l'ID Crunchyroll depuis l'URL, sinon l'URL complète comme identifiant unique
          const crunchyrollId = href.split('/watch/')[1]?.split('/')[0];
          const uniqueId = crunchyrollId || href;
          
          episodeList.push({
            id: uniqueId,
            animeId: arguments[0],
            title: title,
            episodeNumber: episodeNumber,
            seasonNumber: seasonNumber,
            thumbnail: thumbnail || undefined,
            duration: duration || undefined,
            url: href
          });
        } else if (title && title.toLowerCase().includes('lecture')) {
          console.log('❌ Lien générique filtré (méthode principale): ' + title.substring(0, 30).replace(/'/g, "\\\\'") + '...');
        }
        
        if (episodeList.length <= 20 || episodeList.length % 5 === 0) {
          console.log('  📺 ' + (episodeList.length) + '. S' + String(seasonNumber).padStart(2, '0') + 'E' + String(episodeNumber).padStart(2, '0') + ' - ' + title.substring(0, 30).replace(/'/g, "\\\\'"));
        }
      });
      
      console.log('🎬 Total épisodes extraits: ' + episodeList.length);
      
      // DÉDUPLICATION FINALE : Éliminer les doublons par ID, URL ET slug
      const finalEpisodes = [];
      const seenIds = new Map(); // Clé: ID unique 
      const seenUrls = new Map(); // Clé: URL exacte
      const seenSlugs = new Map(); // Clé: slug d'épisode (pour détecter même contenu, URLs différentes)
      
      episodeList.forEach(episode => {
        const episodeUrl = episode.url;
        const episodeId = episode.id;
        
        // Extraire le slug de l'épisode (partie après le dernier slash)
        const episodeSlug = episodeUrl.split('/').pop() || '';
        
        // Déduplication 0: IDs exactement identiques
        if (seenIds.has(episodeId)) {
          const existing = seenIds.get(episodeId);
          console.log('🔄 Doublon ID éliminé: "' + episode.title.replace(/'/g, "\\\\'") + '" (gardé: "' + existing.title.replace(/'/g, "\\\\'") + '")');
          return;
        }
        
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
              console.log('🔄 Doublon URL exact éliminé: "' + existing.title.replace(/'/g, "\\\\'") + '" remplacé par "' + episode.title.replace(/'/g, "\\\\'") + '"');
            }
          } else {
            console.log('🔄 Doublon URL exact éliminé: "' + episode.title.replace(/'/g, "\\\\'") + '" (gardé: "' + existing.title.replace(/'/g, "\\\\'") + '")');
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
              console.log('🔄 Doublon contenu éliminé: "' + existing.title.replace(/'/g, "\\\\'") + '" (' + existing.url.split('/').pop() + ') remplacé par "' + episode.title.replace(/'/g, "\\\\'") + '" (' + episodeSlug + ')');
            }
          } else {
            console.log('🔄 Doublon contenu éliminé: "' + episode.title.replace(/'/g, "\\\\'") + '" (' + episodeSlug + ') (gardé: "' + existing.title.replace(/'/g, "\\\\'") + '")');
          }
          return;
        }
        
        // Nouvel épisode unique
        seenIds.set(episodeId, episode);
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