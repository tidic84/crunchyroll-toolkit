const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function testCuckoosFixed() {
  console.log('🧪 Test A Couple of Cuckoos - Correction détection saisons');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: true,
    timeout: 30000
  });

  try {
    await scraper.initialize();
    
    console.log('🎯 Test de la méthode extractAllEpisodesSimple() avec A Couple of Cuckoos...');
    
    const allEpisodes = await scraper.extractAllEpisodesSimple('GXJHM39MP');
    
    console.log(`📊 Résultat final: ${allEpisodes.length} épisode(s) total`);
    
    // Analyser les saisons détectées
    const seasonCount = {};
    allEpisodes.forEach(ep => {
      if (!seasonCount[ep.seasonNumber]) {
        seasonCount[ep.seasonNumber] = 0;
      }
      seasonCount[ep.seasonNumber]++;
    });
    
    console.log('\n📊 Distribution par saison:');
    Object.keys(seasonCount).forEach(season => {
      console.log(`  Saison ${season}: ${seasonCount[season]} épisodes`);
    });
    
    // Afficher quelques épisodes de chaque saison pour vérification
    const season1Episodes = allEpisodes.filter(ep => ep.seasonNumber === 1);
    const season2Episodes = allEpisodes.filter(ep => ep.seasonNumber === 2);
    
    if (season1Episodes.length > 0) {
      console.log('\n📺 Quelques épisodes Saison 1:');
      season1Episodes.slice(0, 3).forEach(ep => {
        console.log(`  S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
      if (season1Episodes.length > 3) {
        console.log(`  ... et ${season1Episodes.length - 3} autres`);
      }
    }
    
    if (season2Episodes.length > 0) {
      console.log('\n📺 Quelques épisodes Saison 2:');
      season2Episodes.slice(0, 3).forEach(ep => {
        console.log(`  S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
      if (season2Episodes.length > 3) {
        console.log(`  ... et ${season2Episodes.length - 3} autres`);
      }
    }
    
    // Verdict final
    console.log('\n🎯 ANALYSE FINALE:');
    
    const hasMultipleSeasons = Object.keys(seasonCount).length > 1;
    const totalEpisodes = allEpisodes.length;
    const expectedMinEpisodes = 25; // A Couple of Cuckoos a environ 26 épisodes
    
    console.log(`Episodes totaux: ${totalEpisodes} >= ${expectedMinEpisodes} ? ${totalEpisodes >= expectedMinEpisodes ? '✅' : '❌'}`);
    console.log(`Plusieurs saisons détectées: ${hasMultipleSeasons ? '✅' : '❌'}`);
    console.log(`Saisons trouvées: ${Object.keys(seasonCount).join(', ')}`);
    
    if (hasMultipleSeasons && totalEpisodes >= expectedMinEpisodes) {
      console.log('\n🎉 SUCCÈS! La détection des saisons multiples fonctionne!');
    } else if (!hasMultipleSeasons && totalEpisodes >= expectedMinEpisodes) {
      console.log('\n⚠️ Episodes trouvés mais une seule saison détectée');
    } else {
      console.log('\n❌ Problème détecté - pas assez d\'épisodes ou saisons manquantes');
    }
    
  } catch (error) {
    console.error('❌ Erreur test:', error.message);
  } finally {
    await scraper.close();
  }
}

testCuckoosFixed().catch(console.error);