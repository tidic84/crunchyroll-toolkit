const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function debugCuckoosSeasons() {
  console.log('🐛 Debug A Couple of Cuckoos - Extraction par saisons');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: false, // Mode visible pour debug
    timeout: 30000
  });

  try {
    await scraper.initialize();
    
    const driver = await scraper.browserManager.getDriver();
    
    // Navigation vers A Couple of Cuckoos
    const animeUrl = 'https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos';
    console.log('🎯 Navigation vers:', animeUrl);
    await driver.get(animeUrl);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔍 ÉTAPE 1: Test extraction saison 1 seule');
    const season1Episodes = await scraper.extractCurrentSeasonEpisodes(driver, 1);
    console.log(`  Résultat: ${season1Episodes.length} épisodes`);
    season1Episodes.slice(0, 5).forEach((ep, i) => {
      console.log(`    ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title.substring(0, 40)}...`);
    });
    
    console.log('\n🔍 ÉTAPE 2: Navigation vers saison 2');
    const nextSuccess = await scraper.tryNextSeasonButton(driver);
    console.log(`  Navigation réussie: ${nextSuccess}`);
    
    if (nextSuccess) {
      console.log('  ⏱️ Attente du chargement...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n🔍 ÉTAPE 3: Test extraction saison 2 seule');
      const season2Episodes = await scraper.extractCurrentSeasonEpisodes(driver, 2);
      console.log(`  Résultat: ${season2Episodes.length} épisodes`);
      season2Episodes.slice(0, 5).forEach((ep, i) => {
        console.log(`    ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title.substring(0, 40)}...`);
      });
      
      console.log('\n📊 ANALYSE COMPARATIVE:');
      console.log(`  Saison 1: ${season1Episodes.length} épisodes extraits initialement`);
      console.log(`  Saison 2: ${season2Episodes.length} épisodes extraits après navigation`);
      
      if (season1Episodes.length === 0) {
        console.log('  ❌ PROBLÈME: Aucun épisode extrait pour la saison 1');
        console.log('  💡 La page initiale pourrait ne pas charger les épisodes immédiatement');
      }
      
      if (season2Episodes.length > 0 && season1Episodes.length === 0) {
        console.log('  🤔 La saison 2 fonctionne mais pas la saison 1 - problème de chargement initial');
      }
    }
    
    // Test : retour à la saison 1 pour re-essayer
    console.log('\n🔍 ÉTAPE 4: Test retour à la saison 1');
    await driver.get(animeUrl);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre plus longtemps
    
    const season1Retry = await scraper.extractCurrentSeasonEpisodes(driver, 1);
    console.log(`  Retry saison 1: ${season1Retry.length} épisodes`);
    
    if (season1Retry.length > 0) {
      console.log('  ✅ La saison 1 fonctionne avec plus de temps d\'attente');
      season1Retry.slice(0, 3).forEach((ep, i) => {
        console.log(`    ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title.substring(0, 40)}...`);
      });
    }
    
    // Attendre en mode visible
    console.log('\n⏸️ Debug terminé - Appuyez sur Ctrl+C pour fermer...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Erreur debug:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

debugCuckoosSeasons().catch(console.error);