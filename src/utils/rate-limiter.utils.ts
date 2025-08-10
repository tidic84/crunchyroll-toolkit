export interface RateLimitConfig {
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  successReduction: number;
  maxRequestsPerMinute: number;
}

export interface EndpointStats {
  requestCount: number;
  successCount: number;
  errorCount: number;
  lastError: number;
  currentDelay: number;
  lastRequest: number;
  consecutiveErrors: number;
  windowStart: number;
}

export class AdaptiveRateLimit {
  private endpointStats: Map<string, EndpointStats> = new Map();
  private globalRequestCount = 0;
  private globalWindowStart = Date.now();
  private readonly windowDuration = 60000; // 1 minute

  private config: RateLimitConfig = {
    initialDelay: 1000,      // 1 seconde
    maxDelay: 30000,         // 30 secondes max
    backoffMultiplier: 2,    // Double le délai à chaque erreur
    successReduction: 0.5,   // Réduit le délai de moitié en cas de succès
    maxRequestsPerMinute: 20 // Limite globale
  };

  constructor(customConfig?: Partial<RateLimitConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  async executeWithBackoff<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const stats = this.getOrCreateStats(endpoint);
    
    // Vérifier les limites globales
    await this.enforceGlobalRateLimit();
    
    // Vérifier les limites par endpoint
    await this.enforceEndpointRateLimit(endpoint, stats);

    const startTime = Date.now();
    
    try {
      const result = await fn();
      
      // Succès - réduire le délai
      this.handleSuccess(endpoint, stats);
      
      return result;
    } catch (error: any) {
      // Échec - augmenter le délai
      this.handleError(endpoint, stats, error);
      
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.updateRequestStats(endpoint, stats, duration);
    }
  }

  private getOrCreateStats(endpoint: string): EndpointStats {
    if (!this.endpointStats.has(endpoint)) {
      this.endpointStats.set(endpoint, {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        lastError: 0,
        currentDelay: this.config.initialDelay,
        lastRequest: 0,
        consecutiveErrors: 0,
        windowStart: Date.now()
      });
    }
    return this.endpointStats.get(endpoint)!;
  }

  private async enforceGlobalRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.globalWindowStart > this.windowDuration) {
      this.globalRequestCount = 0;
      this.globalWindowStart = now;
    }

    // Check global limit
    if (this.globalRequestCount >= this.config.maxRequestsPerMinute) {
      const timeToWait = this.windowDuration - (now - this.globalWindowStart);
      if (timeToWait > 0) {
        console.log(`⏳ Limite globale atteinte, attente ${timeToWait}ms`);
        await this.delay(timeToWait);
        // Reset window after waiting
        this.globalRequestCount = 0;
        this.globalWindowStart = Date.now();
      }
    }

    this.globalRequestCount++;
  }

  private async enforceEndpointRateLimit(endpoint: string, stats: EndpointStats): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - stats.lastRequest;

    // Si le délai minimum n'est pas respecté, attendre
    if (timeSinceLastRequest < stats.currentDelay) {
      const waitTime = stats.currentDelay - timeSinceLastRequest;
      console.log(`⏳ Rate limit endpoint ${this.shortenEndpoint(endpoint)}: attente ${waitTime}ms`);
      await this.delay(waitTime);
    }

    // Protection contre les erreurs consécutives
    if (stats.consecutiveErrors >= 3) {
      const errorCooldown = Math.min(stats.consecutiveErrors * 5000, 30000); // Max 30s
      const timeSinceLastError = now - stats.lastError;
      
      if (timeSinceLastError < errorCooldown) {
        const waitTime = errorCooldown - timeSinceLastError;
        console.log(`🚫 Cooldown erreurs consécutives pour ${this.shortenEndpoint(endpoint)}: attente ${waitTime}ms`);
        await this.delay(waitTime);
      }
    }
  }

  private handleSuccess(endpoint: string, stats: EndpointStats): void {
    stats.successCount++;
    stats.consecutiveErrors = 0;
    
    // Réduire le délai en cas de succès
    stats.currentDelay = Math.max(
      stats.currentDelay * this.config.successReduction,
      this.config.initialDelay
    );

    console.log(`✅ Succès ${this.shortenEndpoint(endpoint)} - nouveau délai: ${stats.currentDelay}ms`);
  }

  private handleError(endpoint: string, stats: EndpointStats, error: any): void {
    stats.errorCount++;
    stats.consecutiveErrors++;
    stats.lastError = Date.now();

    // Augmenter le délai selon le type d'erreur
    let multiplier = this.config.backoffMultiplier;
    
    if (error.status === 403) {
      multiplier = 3; // Plus agressif pour les erreurs 403
      console.log(`🚫 Erreur 403 détectée pour ${this.shortenEndpoint(endpoint)}`);
    } else if (error.status === 429) {
      multiplier = 4; // Très agressif pour rate limiting
      console.log(`⏱️ Rate limit détecté pour ${this.shortenEndpoint(endpoint)}`);
    } else if (error.code === 'ECONNREFUSED') {
      multiplier = 2.5; // Problème de connectivité
      console.log(`🔌 Erreur connexion pour ${this.shortenEndpoint(endpoint)}`);
    }

    stats.currentDelay = Math.min(
      stats.currentDelay * multiplier,
      this.config.maxDelay
    );

    console.log(`❌ Erreur ${this.shortenEndpoint(endpoint)} - nouveau délai: ${stats.currentDelay}ms`);
  }

  private updateRequestStats(endpoint: string, stats: EndpointStats, duration: number): void {
    stats.requestCount++;
    stats.lastRequest = Date.now();
    
    // Reset window if needed
    if (Date.now() - stats.windowStart > this.windowDuration) {
      stats.windowStart = Date.now();
      // Don't reset counters completely, just reduce them
      stats.requestCount = Math.floor(stats.requestCount * 0.1);
      stats.successCount = Math.floor(stats.successCount * 0.1);
      stats.errorCount = Math.floor(stats.errorCount * 0.1);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shortenEndpoint(endpoint: string): string {
    if (endpoint.length > 50) {
      return endpoint.substring(0, 30) + '...' + endpoint.substring(endpoint.length - 17);
    }
    return endpoint;
  }

  getEndpointStats(endpoint?: string): Map<string, EndpointStats> | EndpointStats | undefined {
    if (endpoint) {
      return this.endpointStats.get(endpoint);
    }
    return this.endpointStats;
  }

  getGlobalStats() {
    return {
      globalRequestCount: this.globalRequestCount,
      globalWindowStart: this.globalWindowStart,
      endpointCount: this.endpointStats.size,
      totalRequests: Array.from(this.endpointStats.values()).reduce((sum, stats) => sum + stats.requestCount, 0),
      totalErrors: Array.from(this.endpointStats.values()).reduce((sum, stats) => sum + stats.errorCount, 0),
      config: this.config
    };
  }

  resetEndpoint(endpoint: string): void {
    this.endpointStats.delete(endpoint);
    console.log(`🔄 Stats réinitialisées pour ${this.shortenEndpoint(endpoint)}`);
  }

  resetAll(): void {
    this.endpointStats.clear();
    this.globalRequestCount = 0;
    this.globalWindowStart = Date.now();
    console.log('🔄 Tous les stats de rate limiting réinitialisés');
  }

  // Méthode pour ajuster dynamiquement la configuration
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuration rate limiting mise à jour:', newConfig);
  }

  // Vérifier si un endpoint est dans un état de cooldown
  isEndpointInCooldown(endpoint: string): boolean {
    const stats = this.endpointStats.get(endpoint);
    if (!stats) return false;

    const now = Date.now();
    const timeSinceLastRequest = now - stats.lastRequest;
    const timeSinceLastError = now - stats.lastError;

    return timeSinceLastRequest < stats.currentDelay || 
           (stats.consecutiveErrors >= 3 && timeSinceLastError < 15000);
  }
}