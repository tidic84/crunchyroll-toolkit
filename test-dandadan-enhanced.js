const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function testDanDaDanEnhanced() {
  console.log('🧪 Test Enhanced DAN DA DAN - Vérification saisons 1 et 2');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: false, // Mode visible pour debug
    timeout: 30000
  });

  try {
    await scraper.initialize();
    
    // Aller directement à la page DAN DA DAN
    const danDaDanUrl = 'https://www.crunchyroll.com/fr/series/GG5H5XQ0D/dan-da-dan';
    console.log('🎯 Navigation vers:', danDaDanUrl);
    
    const driver = await scraper.browserManager.getDriver();
    await driver.get(danDaDanUrl);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📺 Test de la nouvelle méthode extractCurrentSeasonEpisodes()...');
    
    // Test: extraire les épisodes de la saison courante
    const currentSeasonEpisodes = await scraper.extractCurrentSeasonEpisodes(driver);
    console.log(`✅ Saison courante: ${currentSeasonEpisodes.length} épisode(s) extraits`);
    
    currentSeasonEpisodes.forEach((ep, i) => {
      console.log(`  ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
    });
    
    console.log('🔄 Test du bouton "Saison suivante"...');
    
    // Test: chercher et cliquer sur le bouton "Saison suivante"
    const nextSeasonSuccess = await scraper.tryNextSeasonButton(driver);
    console.log(`${nextSeasonSuccess ? '✅' : '❌'} Bouton "Saison suivante": ${nextSeasonSuccess ? 'Cliqué avec succès' : 'Échec'}`);
    
    if (nextSeasonSuccess) {
      console.log('⏱️ Attente du chargement de la saison 2...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test: extraire les épisodes de la saison 2
      const season2Episodes = await scraper.extractCurrentSeasonEpisodes(driver);
      console.log(`✅ Saison 2: ${season2Episodes.length} épisode(s) extraits`);
      
      season2Episodes.forEach((ep, i) => {
        console.log(`  ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
      
      // Résumé final
      const totalEpisodes = currentSeasonEpisodes.length + season2Episodes.length;
      console.log('');
      console.log('📊 RÉSUMÉ FINAL:');
      console.log(`  Saison 1: ${currentSeasonEpisodes.length} épisodes`);
      console.log(`  Saison 2: ${season2Episodes.length} épisodes`);
      console.log(`  Total: ${totalEpisodes} épisodes`);
      
      if (currentSeasonEpisodes.length >= 12 && season2Episodes.length >= 3) {
        console.log('🎉 SUCCÈS: Les deux saisons ont été correctement extraites!');
      } else {
        console.log('⚠️ PROBLÈME: Nombre d\'épisodes insuffisant dans une des saisons');
      }
    }
    
    // Attendre un peu en mode visible
    if (!scraper.browserManager.options.headless) {
      console.log('⏸️ Test terminé - Appuyez sur Ctrl+C pour fermer...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
  } finally {
    await scraper.close();
  }
}

testDanDaDanEnhanced().catch(console.error);