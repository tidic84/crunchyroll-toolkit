import { Page } from 'playwright';
import { CrunchyrollAuth } from './auth.utils';
import { UserAgentManager } from './user-agent.utils';
import { AdaptiveRateLimit } from './rate-limiter.utils';
import { EndpointCircuitBreaker } from './circuit-breaker.utils';
import { FallbackStrategyManager } from './fallback-strategy.utils';
import { CrunchyrollMonitor } from './monitor.utils';

export interface EnhancedScraperConfig {
  rateLimit?: {
    initialDelay?: number;
    maxDelay?: number;
    maxRequestsPerMinute?: number;
  };
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
  };
  monitoring?: {
    error403Threshold?: number;
    consecutiveErrorThreshold?: number;
    successRateThreshold?: number;
  };
}

export class EnhancedScraperManager {
  private auth: CrunchyrollAuth;
  private userAgentManager: UserAgentManager;
  private rateLimit: AdaptiveRateLimit;
  private circuitBreaker: EndpointCircuitBreaker;
  private fallbackManager: FallbackStrategyManager;
  private monitor: CrunchyrollMonitor;
  
  private isInitialized = false;

  constructor(config?: EnhancedScraperConfig) {
    // Initialiser tous les composants
    this.auth = new CrunchyrollAuth();
    this.userAgentManager = new UserAgentManager();
    this.rateLimit = new AdaptiveRateLimit(config?.rateLimit);
    this.circuitBreaker = new EndpointCircuitBreaker(config?.circuitBreaker);
    this.monitor = new CrunchyrollMonitor(config?.monitoring);
    
    // Le fallback manager a besoin des autres composants
    this.fallbackManager = new FallbackStrategyManager(
      this.rateLimit,
      this.circuitBreaker
    );

    console.log('🚀 Enhanced Scraper Manager initialisé');
  }

  async initializeWithPage(page: Page): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configuration du user agent et headers
      const profile = this.userAgentManager.getRandomProfile();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': profile.userAgent,
        ...this.userAgentManager.generateDynamicHeaders(profile)
      });

      await page.setViewportSize(profile.viewport);

      // Configuration anti-détection
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });

        delete (window as any).__playwright;
        delete (window as any).__pw_manual;
      });

      // Sauvegarder la session pour réutilisation future
      await this.auth.saveCurrentSession(page);

      console.log('✅ Page configurée avec Enhanced Scraper');
      this.isInitialized = true;

    } catch (error: any) {
      console.error('❌ Erreur initialisation Enhanced Scraper:', error.message);
      throw error;
    }
  }

  async executeRequest<T>(
    endpoint: string,
    operation: () => Promise<T>,
    context: {
      page: Page;
      query: string;
      operationType: string;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Vérifier et obtenir un token valide
      const token = await this.auth.getValidToken(context.page);
      if (token) {
        console.log('🔑 Token d\'authentification récupéré');
      }

      // Exécuter avec protection complète
      const result = await this.circuitBreaker.execute(endpoint, async () => {
        return await this.rateLimit.executeWithBackoff(endpoint, operation);
      });

      // Enregistrer le succès
      const responseTime = Date.now() - startTime;
      await this.monitor.trackSuccess({
        endpoint,
        query: context.query,
        userAgent: await context.page.evaluate(() => navigator.userAgent),
        timestamp: Date.now()
      }, responseTime);

      return result;

    } catch (error: any) {
      // Enregistrer l'erreur
      const responseTime = Date.now() - startTime;
      await this.monitor.trackError(error, {
        endpoint,
        query: context.query,
        userAgent: await context.page.evaluate(() => navigator.userAgent),
        timestamp: Date.now()
      });

      // Invalider la session si erreur 403
      if (error.status === 403) {
        const userAgent = await context.page.evaluate(() => navigator.userAgent);
        await this.auth.invalidateSession(userAgent);
      }

      throw error;
    }
  }

  async executeWithFallback<T>(
    operation: string,
    query: string,
    context: { page: Page },
    strategies: Array<{
      name: string;
      priority: number;
      execute: () => Promise<T>;
    }>
  ): Promise<T> {
    // Enregistrer les stratégies si pas encore fait
    if (!this.fallbackManager.getRegisteredStrategies(operation)) {
      for (const strategy of strategies) {
        this.fallbackManager.registerStrategy(operation, {
          ...strategy,
          timeout: 30000,
          retryCount: 2,
          isAvailable: () => true
        });
      }
    }

    // Exécuter avec fallback
    const result = await this.fallbackManager.executeWithFallback<T>(
      operation,
      query,
      []
    );

    if (!result.success) {
      throw result.error || new Error('Toutes les stratégies de fallback ont échoué');
    }

    return result.data!;
  }

  async rotateUserAgent(page: Page): Promise<void> {
    try {
      const newProfile = this.userAgentManager.getNextProfile();
      
      await page.setExtraHTTPHeaders({
        'User-Agent': newProfile.userAgent,
        ...this.userAgentManager.generateDynamicHeaders(newProfile)
      });

      await page.setViewportSize(newProfile.viewport);
      
      console.log(`🔄 User-Agent modifié: ${newProfile.platform}`);
      
    } catch (error: any) {
      console.warn('⚠️ Erreur rotation User-Agent:', error.message);
    }
  }

  // Méthodes de monitoring et gestion

  getHealthReport(): string {
    return this.monitor.generateHealthReport();
  }

  getDetailedStats() {
    return {
      monitoring: this.monitor.getFullStats(),
      rateLimit: this.rateLimit.getGlobalStats(),
      circuitBreaker: this.circuitBreaker.getStats(),
      userAgent: this.userAgentManager.getProfileStats(),
      auth: {
        sessionCount: this.auth.getSessionCount(),
        validTokens: this.auth.getValidTokenCount()
      },
      fallback: this.fallbackManager.getStats()
    };
  }

  async handleCriticalError(error: any, page: Page): Promise<void> {
    console.log('🚨 Gestion erreur critique:', error.status || error.code);

    // Actions correctives selon le type d'erreur
    switch (error.status || error.code) {
      case 403:
        await this.rotateUserAgent(page);
        await this.auth.invalidateSession(
          await page.evaluate(() => navigator.userAgent)
        );
        break;
        
      case 429:
        // Augmenter les délais globalement
        this.rateLimit.updateConfig({
          initialDelay: 5000,
          maxRequestsPerMinute: 10
        });
        break;
        
      case 'ECONNREFUSED':
        // Réduire la charge sur le réseau
        this.rateLimit.updateConfig({
          maxRequestsPerMinute: 5
        });
        break;
    }

    // Forcer l'ouverture du circuit breaker pour donner du temps
    if (error.status === 403) {
      this.circuitBreaker.forceOpen('main-api');
    }
  }

  enableCooldownMode(): void {
    console.log('❄️ Activation mode cooldown');
    
    this.rateLimit.updateConfig({
      initialDelay: 10000,
      maxDelay: 60000,
      maxRequestsPerMinute: 5
    });

    this.circuitBreaker.updateConfig({
      failureThreshold: 2,
      recoveryTimeout: 600000 // 10 minutes
    });
  }

  disableCooldownMode(): void {
    console.log('🔥 Désactivation mode cooldown');
    
    this.rateLimit.updateConfig({
      initialDelay: 1000,
      maxDelay: 30000,
      maxRequestsPerMinute: 20
    });

    this.circuitBreaker.updateConfig({
      failureThreshold: 5,
      recoveryTimeout: 300000 // 5 minutes
    });
  }

  resetAll(): void {
    console.log('🔄 Réinitialisation complète Enhanced Scraper');
    
    this.monitor.reset();
    this.rateLimit.resetAll();
    this.circuitBreaker.reset();
    this.userAgentManager.resetAllProfiles();
    this.fallbackManager.clearStrategies();
    
    this.isInitialized = false;
  }

  // Méthodes utilitaires pour l'intégration

  shouldStopScraping(): boolean {
    const stats = this.monitor.getFullStats();
    
    // Arrêter si trop d'erreurs consécutives
    if (stats.consecutiveErrors >= 10) {
      console.log('🛑 Arrêt scraping: trop d\'erreurs consécutives');
      return true;
    }

    // Arrêter si taux de succès critique
    if (stats.successRate < 20 && stats.totalRequests > 20) {
      console.log('🛑 Arrêt scraping: taux de succès critique');
      return true;
    }

    return false;
  }

  getRecommendedAction(): string {
    const stats = this.monitor.getFullStats();
    
    if (stats.error403Count > 5) {
      return 'COOLDOWN_MODE';
    }
    
    if (stats.consecutiveErrors > 5) {
      return 'ROTATE_AGENT';
    }
    
    if (stats.successRate < 50) {
      return 'REDUCE_LOAD';
    }
    
    return 'CONTINUE';
  }

  // Cleanup automatique
  startAutoCleanup(): void {
    setInterval(() => {
      this.circuitBreaker.cleanup();
      
      // Auto-ajustement si nécessaire
      const action = this.getRecommendedAction();
      switch (action) {
        case 'COOLDOWN_MODE':
          this.enableCooldownMode();
          break;
        case 'REDUCE_LOAD':
          this.rateLimit.updateConfig({ maxRequestsPerMinute: 10 });
          break;
      }
    }, 300000); // Toutes les 5 minutes
  }
}