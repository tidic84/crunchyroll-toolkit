const { CrunchyrollScraper } = require('./lib/scrapers/crunchyroll.scraper.js');

async function testEnhancedScraper() {
    console.log('🧪 Test Enhanced Crunchyroll Scraper');
    
    const scraper = new CrunchyrollScraper({
        headless: true,
        timeout: 30000
    });

    try {
        console.log('📊 Initialisation...');
        await scraper.initialize();
        
        console.log('📊 Rapport de santé initial:');
        console.log(scraper.getHealthReport());
        
        console.log('📊 Statistiques détaillées:');
        const stats = scraper.getDetailedStats();
        console.log('- Monitoring:', JSON.stringify(stats.monitoring, null, 2));
        console.log('- Rate Limit:', JSON.stringify(stats.rateLimit, null, 2));
        console.log('- Circuit Breaker:', JSON.stringify(stats.circuitBreaker, null, 2));
        console.log('- User Agent:', JSON.stringify(stats.userAgent, null, 2));
        
        console.log('🔍 Test recherche avec protection...');
        const result = await scraper.searchAnime('naruto');
        console.log('✅ Résultat recherche:', result.success ? `${result.data.length} animes trouvés` : `Erreur: ${result.error}`);
        
        console.log('📊 Rapport de santé après recherche:');
        console.log(scraper.getHealthReport());
        
        console.log('💡 Action recommandée:', scraper.getRecommendedAction());
        
    } catch (error) {
        console.error('❌ Erreur test:', error.message);
        
        console.log('📊 Rapport de santé après erreur:');
        console.log(scraper.getHealthReport());
        
    } finally {
        await scraper.close();
        console.log('✅ Test terminé');
    }
}

if (require.main === module) {
    testEnhancedScraper().catch(console.error);
}

module.exports = { testEnhancedScraper };