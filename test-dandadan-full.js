const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function testDanDaDanFull() {
  console.log('🧪 Test complet DAN DA DAN - Via extractAllEpisodesSimple()');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: true, // Mode rapide
    timeout: 30000
  });

  try {
    await scraper.initialize();
    
    // Utiliser la méthode normale d'extraction d'épisodes
    console.log('🎯 Test de la méthode extractAllEpisodesSimple() avec DAN DA DAN...');
    
    const allEpisodes = await scraper.extractAllEpisodesSimple('GG5H5XQ0D');
    
    console.log(`📊 Résultat final: ${allEpisodes.length} épisode(s) total`);
    
    // Analyser les saisons détectées
    const seasonCount = {};
    allEpisodes.forEach(ep => {
      if (!seasonCount[ep.seasonNumber]) {
        seasonCount[ep.seasonNumber] = 0;
      }
      seasonCount[ep.seasonNumber]++;
    });
    
    console.log('📊 Distribution par saison:');
    Object.keys(seasonCount).forEach(season => {
      console.log(`  Saison ${season}: ${seasonCount[season]} épisodes`);
    });
    
    // Afficher quelques épisodes de chaque saison pour vérification
    const season1Episodes = allEpisodes.filter(ep => ep.seasonNumber === 1);
    const season2Episodes = allEpisodes.filter(ep => ep.seasonNumber === 2);
    
    if (season1Episodes.length > 0) {
      console.log('\n📺 Premiers épisodes Saison 1:');
      season1Episodes.slice(0, 3).forEach(ep => {
        console.log(`  S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
    }
    
    if (season2Episodes.length > 0) {
      console.log('\n📺 Premiers épisodes Saison 2:');
      season2Episodes.slice(0, 3).forEach(ep => {
        console.log(`  S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
    }
    
    // Verdict final
    if (allEpisodes.length >= 15 && season1Episodes.length >= 10 && season2Episodes.length >= 3) {
      console.log('\n🎉 SUCCÈS TOTAL: Les deux saisons de DAN DA DAN sont correctement extraites!');
    } else {
      console.log('\n⚠️ PROBLÈME: Extraction incomplète détectée');
      console.log(`Attendu: S1 ≥ 10, S2 ≥ 3, Total ≥ 15`);
      console.log(`Obtenu: S1 = ${season1Episodes.length}, S2 = ${season2Episodes.length}, Total = ${allEpisodes.length}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur test complet:', error.message);
  } finally {
    await scraper.close();
  }
}

testDanDaDanFull().catch(console.error);