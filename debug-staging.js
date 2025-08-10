const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function debugStaging() {
  console.log('🐛 Debug staging des épisodes DAN DA DAN');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: false, // Mode visible pour debug
    timeout: 30000
  });

  try {
    await scraper.initialize();
    
    const driver = await scraper.browserManager.getDriver();
    
    // Navigation vers DAN DA DAN
    const animeUrl = 'https://www.crunchyroll.com/fr/series/GG5H5XQ0D/dan-da-dan';
    console.log('🎯 Navigation vers:', animeUrl);
    await driver.get(animeUrl);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🔍 ÉTAPE 1: Extraction saison courante (devrait être S1)');
    const season1Episodes = await scraper.extractCurrentSeasonEpisodes(driver);
    console.log(`  Résultat: ${season1Episodes.length} épisodes`);
    season1Episodes.forEach((ep, i) => {
      console.log(`    ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title.substring(0, 40)}...`);
    });
    
    console.log('\n🔍 ÉTAPE 2: Navigation vers saison suivante');
    const nextSuccess = await scraper.tryNextSeasonButton(driver);
    console.log(`  Navigation réussie: ${nextSuccess}`);
    
    if (nextSuccess) {
      console.log('  ⏱️ Attente du chargement...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n🔍 ÉTAPE 3: Extraction après navigation (devrait être S2)');
      const season2Episodes = await scraper.extractCurrentSeasonEpisodes(driver);
      console.log(`  Résultat: ${season2Episodes.length} épisodes`);
      season2Episodes.forEach((ep, i) => {
        console.log(`    ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title.substring(0, 40)}...`);
      });
      
      console.log('\n📊 ANALYSE:');
      console.log(`  Saison 1: ${season1Episodes.length} épisodes`);
      console.log(`  Saison 2: ${season2Episodes.length} épisodes`);
      console.log(`  Total: ${season1Episodes.length + season2Episodes.length} épisodes`);
      
      // Vérifier les overlaps
      const s1URLs = season1Episodes.map(ep => ep.url);
      const s2URLs = season2Episodes.map(ep => ep.url);
      const overlaps = s1URLs.filter(url => s2URLs.includes(url));
      
      if (overlaps.length > 0) {
        console.log(`  ⚠️ Overlaps détectés: ${overlaps.length} URLs en commun`);
        overlaps.forEach(url => console.log(`    - ${url}`));
      } else {
        console.log(`  ✅ Aucun overlap détecté`);
      }
      
      // Correction des numéros de saison
      console.log('\n🔧 CORRECTION: Assigner S2 aux épisodes de saison 2');
      const correctedS2Episodes = season2Episodes.map(ep => ({
        ...ep,
        seasonNumber: 2
      }));
      
      const allEpisodes = [...season1Episodes, ...correctedS2Episodes];
      console.log(`📊 Final: ${allEpisodes.length} épisodes total`);
      
      const s1Count = allEpisodes.filter(ep => ep.seasonNumber === 1).length;
      const s2Count = allEpisodes.filter(ep => ep.seasonNumber === 2).length;
      console.log(`  S1: ${s1Count}, S2: ${s2Count}`);
    }
    
    // Attendre en mode visible
    console.log('\n⏸️ Debug terminé - Appuyez sur Ctrl+C pour fermer...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ Erreur debug:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

debugStaging().catch(console.error);