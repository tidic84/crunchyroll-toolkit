#!/usr/bin/env node

/**
 * Test final pour vérifier seulement les titres dans le JSON de sortie
 */

async function testFinalResult() {
  try {
    console.log('🎬 Test Final - Vérification des titres');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Test sur seulement 5 épisodes S1
    const episodeResult = await scraper.getEpisodes('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    
    if (episodeResult.success) {
      const s1Episodes = episodeResult.data.filter(ep => ep.seasonNumber === 1).slice(0, 5);
      
      console.log('\\n📺 ÉCHANTILLON DE TITRES S1:');
      s1Episodes.forEach((ep, i) => {
        const hasPrefix = ep.title.match(/^S\d+\s*E\d+\s*[-–]/);
        console.log(`${i+1}. "${ep.title}" ${hasPrefix ? '❌ Encore préfixé' : '✅ Nettoyé'}`);
      });
      
      const withPrefixes = s1Episodes.filter(ep => ep.title.match(/^S\d+\s*E\d+\s*[-–]/)).length;
      console.log(`\\n📊 ${withPrefixes}/${s1Episodes.length} titres ont encore des préfixes`);
      
      if (withPrefixes === 0) {
        console.log('✅ SUCCÈS: Tous les titres sont nettoyés!');
      } else {
        console.log('❌ ÉCHEC: Des préfixes subsistent');
      }
    } else {
      console.log('❌ Erreur extraction épisodes:', episodeResult.error);
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFinalResult().catch(console.error);