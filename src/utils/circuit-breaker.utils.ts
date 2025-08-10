export enum CircuitState {
  CLOSED = 'CLOSED',       // Circuit fermé - requêtes normales
  OPEN = 'OPEN',           // Circuit ouvert - toutes requêtes bloquées
  HALF_OPEN = 'HALF_OPEN'  // Circuit semi-ouvert - test de récupération
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Nombre d'échecs pour ouvrir le circuit
  recoveryTimeout: number;      // Temps d'attente avant test de récupération
  successThreshold: number;     // Nombre de succès pour fermer le circuit
  monitoringWindow: number;     // Fenêtre de surveillance des erreurs
}

export interface EndpointState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  windowStart: number;
  totalRequests: number;
  blockedRequests: number;
}

export class EndpointCircuitBreaker {
  private endpointStates: Map<string, EndpointState> = new Map();
  
  private config: CircuitBreakerConfig = {
    failureThreshold: 5,        // 5 échecs consécutifs
    recoveryTimeout: 300000,    // 5 minutes
    successThreshold: 3,        // 3 succès pour fermer
    monitoringWindow: 600000    // 10 minutes de surveillance
  };

  constructor(customConfig?: Partial<CircuitBreakerConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  async execute<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getOrCreateState(endpoint);
    
    // Vérifier si on peut exécuter la requête
    if (!this.canExecute(endpoint, state)) {
      state.blockedRequests++;
      throw new Error(`Circuit breaker OPEN pour ${this.shortenEndpoint(endpoint)} - endpoint temporairement indisponible`);
    }

    state.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess(endpoint, state);
      return result;
    } catch (error) {
      this.onFailure(endpoint, state, error);
      throw error;
    }
  }

  isEndpointAvailable(endpoint: string): boolean {
    const state = this.endpointStates.get(endpoint);
    if (!state) return true;
    
    return this.canExecute(endpoint, state);
  }

  private canExecute(endpoint: string, state: EndpointState): boolean {
    const now = Date.now();
    
    switch (state.state) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        // Vérifier si on peut passer en HALF_OPEN
        if (now - state.lastFailureTime >= this.config.recoveryTimeout) {
          console.log(`🔄 Circuit breaker ${this.shortenEndpoint(endpoint)}: passage OPEN -> HALF_OPEN`);
          state.state = CircuitState.HALF_OPEN;
          state.successCount = 0;
          return true;
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        return true;
        
      default:
        return false;
    }
  }

  private onSuccess(endpoint: string, state: EndpointState): void {
    const now = Date.now();
    state.lastSuccessTime = now;
    state.successCount++;

    switch (state.state) {
      case CircuitState.HALF_OPEN:
        if (state.successCount >= this.config.successThreshold) {
          console.log(`✅ Circuit breaker ${this.shortenEndpoint(endpoint)}: fermeture (HALF_OPEN -> CLOSED)`);
          state.state = CircuitState.CLOSED;
          state.failureCount = 0;
          state.windowStart = now;
        }
        break;
        
      case CircuitState.CLOSED:
        // Reset failure count on success
        if (state.failureCount > 0) {
          state.failureCount = Math.max(0, state.failureCount - 1);
        }
        break;
    }
  }

  private onFailure(endpoint: string, state: EndpointState, error: any): void {
    const now = Date.now();
    state.lastFailureTime = now;
    state.failureCount++;

    // Reset window if needed
    if (now - state.windowStart > this.config.monitoringWindow) {
      state.windowStart = now;
      state.failureCount = 1; // Reset but count current failure
    }

    // Vérifier les conditions critiques
    const isCriticalError = this.isCriticalError(error);
    const shouldOpen = state.failureCount >= this.config.failureThreshold || isCriticalError;

    switch (state.state) {
      case CircuitState.CLOSED:
        if (shouldOpen) {
          console.log(`🚫 Circuit breaker ${this.shortenEndpoint(endpoint)}: ouverture (${state.failureCount} échecs)`);
          state.state = CircuitState.OPEN;
        }
        break;
        
      case CircuitState.HALF_OPEN:
        console.log(`❌ Circuit breaker ${this.shortenEndpoint(endpoint)}: retour OPEN (échec pendant test)`);
        state.state = CircuitState.OPEN;
        state.successCount = 0;
        break;
    }
  }

  private isCriticalError(error: any): boolean {
    // Erreurs critiques qui ouvrent immédiatement le circuit
    if (error.status === 403) return true;  // Forbidden
    if (error.status === 429) return true;  // Too Many Requests
    if (error.code === 'ECONNREFUSED') return true; // Connection refused
    if (error.code === 'ENOTFOUND') return true;    // DNS errors
    if (error.code === 'TIMEOUT') return true;      // Timeout
    
    return false;
  }

  private getOrCreateState(endpoint: string): EndpointState {
    if (!this.endpointStates.has(endpoint)) {
      this.endpointStates.set(endpoint, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        windowStart: Date.now(),
        totalRequests: 0,
        blockedRequests: 0
      });
    }
    return this.endpointStates.get(endpoint)!;
  }

  private shortenEndpoint(endpoint: string): string {
    if (endpoint.length > 50) {
      return endpoint.substring(0, 30) + '...' + endpoint.substring(endpoint.length - 17);
    }
    return endpoint;
  }

  // Méthodes publiques pour monitoring et gestion

  getEndpointState(endpoint: string): EndpointState | undefined {
    return this.endpointStates.get(endpoint);
  }

  getAllStates(): Map<string, EndpointState> {
    return new Map(this.endpointStates);
  }

  getStats() {
    const stats = {
      totalEndpoints: this.endpointStates.size,
      closedCircuits: 0,
      openCircuits: 0,
      halfOpenCircuits: 0,
      totalRequests: 0,
      totalBlocked: 0,
      endpointDetails: [] as Array<{
        endpoint: string;
        state: CircuitState;
        failureCount: number;
        successCount: number;
        availability: number;
        lastActivity: number;
      }>
    };

    for (const [endpoint, state] of this.endpointStates.entries()) {
      switch (state.state) {
        case CircuitState.CLOSED: stats.closedCircuits++; break;
        case CircuitState.OPEN: stats.openCircuits++; break;
        case CircuitState.HALF_OPEN: stats.halfOpenCircuits++; break;
      }

      stats.totalRequests += state.totalRequests;
      stats.totalBlocked += state.blockedRequests;

      const availability = state.totalRequests > 0 
        ? ((state.totalRequests - state.blockedRequests) / state.totalRequests) * 100 
        : 100;

      stats.endpointDetails.push({
        endpoint: this.shortenEndpoint(endpoint),
        state: state.state,
        failureCount: state.failureCount,
        successCount: state.successCount,
        availability: Math.round(availability * 100) / 100,
        lastActivity: Math.max(state.lastFailureTime, state.lastSuccessTime)
      });
    }

    return stats;
  }

  forceOpen(endpoint: string): void {
    const state = this.getOrCreateState(endpoint);
    state.state = CircuitState.OPEN;
    state.lastFailureTime = Date.now();
    console.log(`🔒 Circuit breaker ${this.shortenEndpoint(endpoint)}: ouverture forcée`);
  }

  forceClose(endpoint: string): void {
    const state = this.getOrCreateState(endpoint);
    state.state = CircuitState.CLOSED;
    state.failureCount = 0;
    state.successCount = 0;
    state.windowStart = Date.now();
    console.log(`🔓 Circuit breaker ${this.shortenEndpoint(endpoint)}: fermeture forcée`);
  }

  reset(endpoint?: string): void {
    if (endpoint) {
      this.endpointStates.delete(endpoint);
      console.log(`🔄 Circuit breaker réinitialisé pour ${this.shortenEndpoint(endpoint)}`);
    } else {
      this.endpointStates.clear();
      console.log('🔄 Tous les circuit breakers réinitialisés');
    }
  }

  // Méthode pour ajuster la configuration
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuration circuit breaker mise à jour:', newConfig);
  }

  // Vérification périodique et nettoyage
  cleanup(): void {
    const now = Date.now();
    const staleTimeout = this.config.monitoringWindow * 2; // 2x la fenêtre de surveillance

    for (const [endpoint, state] of this.endpointStates.entries()) {
      const lastActivity = Math.max(state.lastFailureTime, state.lastSuccessTime);
      
      if (now - lastActivity > staleTimeout) {
        this.endpointStates.delete(endpoint);
        console.log(`🧹 Nettoyage circuit breaker inactif: ${this.shortenEndpoint(endpoint)}`);
      }
    }
  }
}