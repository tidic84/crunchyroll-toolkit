import { AdaptiveRateLimit } from './rate-limiter.utils';
import { EndpointCircuitBreaker } from './circuit-breaker.utils';

interface StrategyConfig {
  name: string;
  priority: number;
  timeout: number;
  retryCount: number;
  isAvailable: () => boolean;
  execute: (...args: any[]) => Promise<any>;
}

interface FallbackResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  strategyUsed?: string;
  attemptCount: number;
  totalTime: number;
}

export class FallbackStrategyManager {
  private rateLimit: AdaptiveRateLimit;
  private circuitBreaker: EndpointCircuitBreaker;
  private strategies: Map<string, StrategyConfig[]> = new Map();

  constructor(
    rateLimit: AdaptiveRateLimit,
    circuitBreaker: EndpointCircuitBreaker
  ) {
    this.rateLimit = rateLimit;
    this.circuitBreaker = circuitBreaker;
  }

  registerStrategy(operation: string, strategy: StrategyConfig): void {
    if (!this.strategies.has(operation)) {
      this.strategies.set(operation, []);
    }
    
    const strategies = this.strategies.get(operation)!;
    strategies.push(strategy);
    
    // Trier par priorité (plus haute priorité en premier)
    strategies.sort((a, b) => b.priority - a.priority);
    
    console.log(`📋 Stratégie "${strategy.name}" enregistrée pour l'opération "${operation}"`);
  }

  async executeWithFallback<T>(
    operation: string, 
    query: string, 
    synonyms: string[] = []
  ): Promise<FallbackResult<T>> {
    const strategies = this.strategies.get(operation);
    if (!strategies || strategies.length === 0) {
      throw new Error(`Aucune stratégie enregistrée pour l'opération: ${operation}`);
    }

    const startTime = Date.now();
    let attemptCount = 0;
    let lastError: Error | undefined;

    // Créer une liste complète des tentatives incluant les synonymes
    const allAttempts = this.buildAttemptList(strategies, query, synonyms);

    console.log(`🎯 Début stratégie fallback pour "${operation}" avec ${allAttempts.length} tentatives`);

    for (const attempt of allAttempts) {
      attemptCount++;
      
      try {
        // Vérifier si le circuit breaker permet l'exécution
        if (!this.circuitBreaker.isEndpointAvailable(attempt.endpoint)) {
          console.log(`⏭️ Circuit breaker OPEN pour ${attempt.strategy} - tentative suivante`);
          continue;
        }

        // Vérifier si le rate limiter permet l'exécution
        if (this.rateLimit.isEndpointInCooldown(attempt.endpoint)) {
          console.log(`⏭️ Rate limit actif pour ${attempt.strategy} - tentative suivante`);
          continue;
        }

        console.log(`🔄 Tentative ${attemptCount}/${allAttempts.length}: ${attempt.strategy} avec "${attempt.query}"`);

        // Exécuter avec protection circuit breaker et rate limit
        const result = await this.executeWithProtection(attempt);

        if (this.isValidResult(result)) {
          const totalTime = Date.now() - startTime;
          console.log(`✅ Succès avec stratégie "${attempt.strategy}" en ${totalTime}ms`);
          
          return {
            success: true,
            data: result,
            strategyUsed: attempt.strategy,
            attemptCount,
            totalTime
          };
        } else {
          console.log(`⚠️ Résultat invalide avec "${attempt.strategy}"`);
        }

      } catch (error: any) {
        lastError = error;
        console.log(`❌ Échec tentative ${attemptCount}: ${attempt.strategy} - ${error.message}`);
        
        // Attendre un délai adaptatif entre les tentatives selon l'erreur
        await this.adaptiveDelay(error.status || error.code, attemptCount);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`💥 Toutes les stratégies fallback ont échoué en ${totalTime}ms`);

    return {
      success: false,
      error: lastError || new Error('Toutes les stratégies de fallback ont échoué'),
      attemptCount,
      totalTime
    };
  }

  private buildAttemptList(
    strategies: StrategyConfig[], 
    query: string, 
    synonyms: string[]
  ): Array<{strategy: string; endpoint: string; query: string; execute: () => Promise<any>}> {
    const attempts: Array<{strategy: string; endpoint: string; query: string; execute: () => Promise<any>}> = [];
    
    // Ajouter la requête principale avec toutes les stratégies disponibles
    for (const strategy of strategies) {
      if (strategy.isAvailable()) {
        attempts.push({
          strategy: strategy.name,
          endpoint: strategy.name, // Utiliser le nom comme endpoint pour le tracking
          query: query,
          execute: strategy.execute
        });
      }
    }

    // Ajouter les synonymes avec les stratégies principales seulement
    for (const synonym of synonyms) {
      for (const strategy of strategies.slice(0, 2)) { // Seulement les 2 meilleures stratégies
        if (strategy.isAvailable()) {
          attempts.push({
            strategy: `${strategy.name}_synonym`,
            endpoint: strategy.name,
            query: synonym,
            execute: () => strategy.execute() // Adapter l'exécution pour le synonyme si nécessaire
          });
        }
      }
    }

    return attempts;
  }

  private async executeWithProtection(attempt: {
    strategy: string; 
    endpoint: string; 
    query: string; 
    execute: () => Promise<any>
  }): Promise<any> {
    // Protection combinée circuit breaker + rate limit
    return await this.circuitBreaker.execute(attempt.endpoint, async () => {
      return await this.rateLimit.executeWithBackoff(attempt.endpoint, attempt.execute);
    });
  }

  private isValidResult(result: any): boolean {
    if (!result) return false;
    
    // Pour les résultats de recherche d'anime
    if (Array.isArray(result)) {
      return result.length > 0;
    }
    
    // Pour les objets de résultat
    if (typeof result === 'object') {
      return result.success === true || 
             (result.data && result.data.length > 0) ||
             Object.keys(result).length > 0;
    }
    
    return true;
  }

  private async adaptiveDelay(errorCode: string | number, attemptCount: number): Promise<void> {
    let baseDelay = 1000; // 1 seconde de base
    
    // Ajuster selon le type d'erreur
    switch (errorCode) {
      case 403:
        baseDelay = 5000; // 5 secondes pour les 403
        break;
      case 429:
        baseDelay = 10000; // 10 secondes pour les rate limits
        break;
      case 'ECONNREFUSED':
        baseDelay = 3000; // 3 secondes pour les problèmes de connexion
        break;
      case 'TIMEOUT':
        baseDelay = 2000; // 2 secondes pour les timeouts
        break;
    }

    // Augmenter progressivement avec le nombre de tentatives
    const delay = baseDelay * Math.pow(1.5, attemptCount - 1);
    const maxDelay = 15000; // Maximum 15 secondes
    
    const finalDelay = Math.min(delay, maxDelay);
    
    if (finalDelay > 0) {
      console.log(`⏳ Attente adaptative: ${finalDelay}ms avant prochaine tentative`);
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  // Méthodes utilitaires pour la gestion des stratégies

  getRegisteredStrategies(operation?: string): Map<string, StrategyConfig[]> | StrategyConfig[] | undefined {
    if (operation) {
      return this.strategies.get(operation);
    }
    return this.strategies;
  }

  removeStrategy(operation: string, strategyName: string): boolean {
    const strategies = this.strategies.get(operation);
    if (!strategies) return false;

    const index = strategies.findIndex(s => s.name === strategyName);
    if (index !== -1) {
      strategies.splice(index, 1);
      console.log(`🗑️ Stratégie "${strategyName}" supprimée pour l'opération "${operation}"`);
      return true;
    }
    return false;
  }

  clearStrategies(operation?: string): void {
    if (operation) {
      this.strategies.delete(operation);
      console.log(`🧹 Stratégies supprimées pour l'opération "${operation}"`);
    } else {
      this.strategies.clear();
      console.log('🧹 Toutes les stratégies supprimées');
    }
  }

  getStats() {
    const stats = {
      totalOperations: this.strategies.size,
      totalStrategies: 0,
      operationDetails: [] as Array<{
        operation: string;
        strategyCount: number;
        strategies: Array<{name: string; priority: number; available: boolean}>
      }>
    };

    for (const [operation, strategies] of this.strategies.entries()) {
      stats.totalStrategies += strategies.length;
      
      stats.operationDetails.push({
        operation,
        strategyCount: strategies.length,
        strategies: strategies.map(s => ({
          name: s.name,
          priority: s.priority,
          available: s.isAvailable()
        }))
      });
    }

    return stats;
  }

  // Factory methods pour créer des stratégies communes

  static createSearchAnimeStrategies(
    searchMainAPI: (query: string) => Promise<any>,
    searchAlternativeAPI: (query: string) => Promise<any>,
    searchLegacyAPI: (query: string) => Promise<any>,
    searchSeleniumAPI: (query: string) => Promise<any>
  ): StrategyConfig[] {
    return [
      {
        name: 'MainAPI',
        priority: 100,
        timeout: 10000,
        retryCount: 2,
        isAvailable: () => true,
        execute: searchMainAPI
      },
      {
        name: 'AlternativeAPI',
        priority: 80,
        timeout: 15000,
        retryCount: 2,
        isAvailable: () => true,
        execute: searchAlternativeAPI
      },
      {
        name: 'LegacyAPI',
        priority: 60,
        timeout: 20000,
        retryCount: 1,
        isAvailable: () => true,
        execute: searchLegacyAPI
      },
      {
        name: 'SeleniumFallback',
        priority: 40,
        timeout: 30000,
        retryCount: 1,
        isAvailable: () => true,
        execute: searchSeleniumAPI
      }
    ];
  }
}