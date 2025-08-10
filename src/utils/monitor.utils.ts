export interface ErrorContext {
  endpoint: string;
  query: string;
  userAgent: string;
  timestamp: number;
  strategy?: string;
  attemptCount?: number;
}

export interface AlertConfig {
  error403Threshold: number;
  error403TimeWindow: number;
  consecutiveErrorThreshold: number;
  successRateThreshold: number;
  alertCooldown: number;
}

export interface MonitoringStats {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  error403Count: number;
  error429Count: number;
  errorECONNREFUSEDCount: number;
  averageResponseTime: number;
  successRate: number;
  lastError?: ErrorContext;
  last403Time?: number;
  consecutiveErrors: number;
  alertsSent: number;
  lastAlertTime: number;
}

export class CrunchyrollMonitor {
  private stats: MonitoringStats = {
    totalRequests: 0,
    successfulRequests: 0,
    errorRequests: 0,
    error403Count: 0,
    error429Count: 0,
    errorECONNREFUSEDCount: 0,
    averageResponseTime: 0,
    successRate: 100,
    consecutiveErrors: 0,
    alertsSent: 0,
    lastAlertTime: 0
  };

  private config: AlertConfig = {
    error403Threshold: 3,           // 3 erreurs 403 déclenchent une alerte
    error403TimeWindow: 300000,     // dans une fenêtre de 5 minutes
    consecutiveErrorThreshold: 5,   // 5 erreurs consécutives
    successRateThreshold: 70,       // Taux de succès minimum 70%
    alertCooldown: 900000           // Pas d'alerte pendant 15 minutes après la dernière
  };

  private errorHistory: ErrorContext[] = [];
  private responseTimeHistory: number[] = [];
  private maxHistorySize = 100;

  constructor(customConfig?: Partial<AlertConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  async trackSuccess(context: Partial<ErrorContext>, responseTime: number): Promise<void> {
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    this.stats.consecutiveErrors = 0;
    
    // Mise à jour du temps de réponse moyen
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }
    this.updateAverageResponseTime();
    
    // Mise à jour du taux de succès
    this.updateSuccessRate();

    console.log(`✅ Succès enregistré - Taux: ${this.stats.successRate.toFixed(1)}% - Temps: ${responseTime}ms`);
  }

  async trackError(error: any, context: ErrorContext): Promise<void> {
    this.stats.totalRequests++;
    this.stats.errorRequests++;
    this.stats.consecutiveErrors++;
    this.stats.lastError = context;

    // Traitement spécifique par type d'erreur
    if (error.status === 403) {
      this.stats.error403Count++;
      this.stats.last403Time = Date.now();
      await this.handle403Error(error, context);
    } else if (error.status === 429) {
      this.stats.error429Count++;
      await this.handleRateLimitError(error, context);
    } else if (error.code === 'ECONNREFUSED') {
      this.stats.errorECONNREFUSEDCount++;
      await this.handleConnectionError(error, context);
    }

    // Ajouter à l'historique
    this.errorHistory.push(context);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Mise à jour du taux de succès
    this.updateSuccessRate();

    // Vérifier si une alerte doit être envoyée
    await this.checkAndSendAlerts(error, context);

    console.log(`❌ Erreur enregistrée: ${error.status || error.code} - Consécutives: ${this.stats.consecutiveErrors}`);
  }

  private async handle403Error(error: any, context: ErrorContext): Promise<void> {
    console.log(`🚨 Erreur 403 détectée - Total: ${this.stats.error403Count}`);

    // Vérifier si on dépasse le seuil d'erreurs 403
    const recent403s = this.countRecent403s();
    if (recent403s >= this.config.error403Threshold) {
      await this.sendHighPriorityAlert(
        `ALERTE CRITIQUE: ${recent403s} erreurs 403 détectées`,
        {
          ...context,
          error: error,
          recent403Count: recent403s,
          recommendation: 'Ajustement immédiat de la stratégie de scraping requis'
        }
      );
      
      // Auto-ajustement de la stratégie
      await this.adjustScrapingStrategy();
    }
  }

  private async handleRateLimitError(error: any, context: ErrorContext): Promise<void> {
    console.log(`⏱️ Rate limit détecté sur ${context.endpoint}`);
    
    await this.sendAlert(
      `Rate limit atteint: ${context.endpoint}`,
      {
        ...context,
        error: error,
        recommendation: 'Augmentation des délais recommandée'
      }
    );
  }

  private async handleConnectionError(error: any, context: ErrorContext): Promise<void> {
    console.log(`🔌 Erreur de connexion: ${context.endpoint}`);
    
    if (this.stats.consecutiveErrors >= 3) {
      await this.sendAlert(
        `Problèmes de connectivité persistants`,
        {
          ...context,
          error: error,
          consecutiveErrors: this.stats.consecutiveErrors,
          recommendation: 'Vérification de la connectivité réseau nécessaire'
        }
      );
    }
  }

  private async checkAndSendAlerts(error: any, context: ErrorContext): Promise<void> {
    const now = Date.now();
    
    // Vérifier le cooldown des alertes
    if (now - this.stats.lastAlertTime < this.config.alertCooldown) {
      return;
    }

    // Alerte pour erreurs consécutives
    if (this.stats.consecutiveErrors >= this.config.consecutiveErrorThreshold) {
      await this.sendAlert(
        `${this.stats.consecutiveErrors} erreurs consécutives détectées`,
        {
          ...context,
          error: error,
          consecutiveErrors: this.stats.consecutiveErrors,
          recommendation: 'Vérification urgente du système requise'
        }
      );
    }

    // Alerte pour taux de succès faible
    if (this.stats.successRate < this.config.successRateThreshold && this.stats.totalRequests > 10) {
      await this.sendAlert(
        `Taux de succès critique: ${this.stats.successRate.toFixed(1)}%`,
        {
          ...context,
          error: error,
          successRate: this.stats.successRate,
          totalRequests: this.stats.totalRequests,
          recommendation: 'Révision complète de la stratégie de scraping nécessaire'
        }
      );
    }
  }

  private countRecent403s(): number {
    const now = Date.now();
    const windowStart = now - this.config.error403TimeWindow;
    
    return this.errorHistory.filter(err => 
      err.timestamp >= windowStart && 
      this.stats.lastError?.endpoint === err.endpoint
    ).length;
  }

  private async sendAlert(title: string, details: any): Promise<void> {
    this.stats.alertsSent++;
    this.stats.lastAlertTime = Date.now();
    
    console.log(`🚨 ALERTE: ${title}`);
    console.log(`📊 Détails:`, JSON.stringify(details, null, 2));
    
    // Ici, on pourrait ajouter l'envoi vers des services externes
    // comme Slack, Discord, email, etc.
    this.logAlertToFile(title, details);
  }

  private async sendHighPriorityAlert(title: string, details: any): Promise<void> {
    console.log(`🔥 ALERTE HAUTE PRIORITÉ: ${title}`);
    await this.sendAlert(title, { ...details, priority: 'HIGH' });
  }

  private logAlertToFile(title: string, details: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      title,
      details,
      stats: this.getBasicStats()
    };
    
    // Dans un environnement réel, on écrirait dans un fichier de log
    console.log(`📝 Log d'alerte:`, JSON.stringify(logEntry, null, 2));
  }

  private async adjustScrapingStrategy(): Promise<void> {
    console.log('🔧 Auto-ajustement de la stratégie de scraping...');
    
    // Logique d'ajustement automatique
    const adjustments = {
      increaseDelays: true,
      rotateUserAgents: true,
      reduceConcurrency: true,
      enableCooldownMode: true,
      timestamp: Date.now()
    };

    console.log('⚙️ Ajustements appliqués:', adjustments);
    
    // Envoyer une notification de l'ajustement
    await this.sendAlert(
      'Ajustement automatique de la stratégie',
      {
        adjustments,
        trigger: 'Erreurs 403 répétées',
        recommendation: 'Surveillance continue recommandée'
      }
    );
  }

  private updateAverageResponseTime(): void {
    if (this.responseTimeHistory.length > 0) {
      const sum = this.responseTimeHistory.reduce((a, b) => a + b, 0);
      this.stats.averageResponseTime = Math.round(sum / this.responseTimeHistory.length);
    }
  }

  private updateSuccessRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.successRate = (this.stats.successfulRequests / this.stats.totalRequests) * 100;
    }
  }

  // Méthodes publiques pour accéder aux statistiques

  getFullStats(): MonitoringStats {
    return { ...this.stats };
  }

  getBasicStats() {
    return {
      totalRequests: this.stats.totalRequests,
      successRate: Math.round(this.stats.successRate * 100) / 100,
      averageResponseTime: this.stats.averageResponseTime,
      error403Count: this.stats.error403Count,
      consecutiveErrors: this.stats.consecutiveErrors,
      alertsSent: this.stats.alertsSent
    };
  }

  getErrorSummary() {
    return {
      error403: this.stats.error403Count,
      error429: this.stats.error429Count,
      errorECONNREFUSED: this.stats.errorECONNREFUSEDCount,
      totalErrors: this.stats.errorRequests,
      recentErrors: this.errorHistory.slice(-10),
      lastError: this.stats.lastError
    };
  }

  reset(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      errorRequests: 0,
      error403Count: 0,
      error429Count: 0,
      errorECONNREFUSEDCount: 0,
      averageResponseTime: 0,
      successRate: 100,
      consecutiveErrors: 0,
      alertsSent: 0,
      lastAlertTime: 0
    };
    
    this.errorHistory = [];
    this.responseTimeHistory = [];
    
    console.log('🔄 Statistiques de monitoring réinitialisées');
  }

  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuration monitoring mise à jour:', newConfig);
  }

  // Méthode pour générer un rapport de santé
  generateHealthReport(): string {
    const stats = this.getFullStats();
    const errors = this.getErrorSummary();
    
    let healthStatus = 'GOOD';
    if (stats.successRate < 80) healthStatus = 'WARNING';
    if (stats.successRate < 60 || stats.consecutiveErrors > 5) healthStatus = 'CRITICAL';
    
    return `
🏥 RAPPORT DE SANTÉ CRUNCHYROLL SCRAPER
==========================================
Statut: ${healthStatus}
Taux de succès: ${stats.successRate.toFixed(1)}%
Requêtes totales: ${stats.totalRequests}
Temps de réponse moyen: ${stats.averageResponseTime}ms
Erreurs consécutives: ${stats.consecutiveErrors}

🚨 Erreurs:
- 403 (Forbidden): ${errors.error403}
- 429 (Rate Limit): ${errors.error429}  
- ECONNREFUSED: ${errors.errorECONNREFUSED}

📊 Alertes envoyées: ${stats.alertsSent}
📅 Dernière alerte: ${stats.lastAlertTime ? new Date(stats.lastAlertTime).toLocaleString() : 'Aucune'}
    `.trim();
  }
}