#!/usr/bin/env node

/**
 * Test manuel avec URL d'épisode connue pour tester la logique d'extraction
 */

async function testManualEpisodeUrl() {
  let scraper;
  
  try {
    console.log('🚀 Test manuel URL épisode');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Essayer plusieurs URLs possibles pour Fire Force
    const testUrls = [
      'https://www.crunchyroll.com/series/GYQYXMKX6/fire-force',
      'https://www.crunchyroll.com/fr/series/GYQYXMKX6',
      'https://www.crunchyroll.com/series/fire-force',
      'https://www.crunchyroll.com/fr/search?q=Fire+Force'
    ];
    
    for (const testUrl of testUrls) {
      console.log(`\n🎯 Test: ${testUrl}`);
      
      try {
        const detailsResult = await scraper.getAnimeDetails(testUrl);
        if (detailsResult.success && detailsResult.data.title) {
          console.log(`✅ Titre trouvé: ${detailsResult.data.title}`);
          
          // Si on trouve un titre, essayer les épisodes
          const episodesResult = await scraper.getEpisodes(testUrl);
          if (episodesResult.success && episodesResult.data.length > 0) {
            console.log(`✅ ${episodesResult.data.length} épisodes trouvés!`);
            episodesResult.data.slice(0, 2).forEach((ep, i) => {
              console.log(`  ${i+1}. ${ep.title} (S${ep.seasonNumber}E${ep.episodeNumber})`);
            });
            break; // On a trouvé ce qu'on cherchait
          } else {
            console.log(`⚠️ Pas d'épisodes: ${episodesResult.error || 'aucun trouvé'}`);
          }
        } else {
          console.log(`❌ Pas de titre: ${detailsResult.error || 'vide'}`);
        }
      } catch (error) {
        console.log(`❌ Erreur: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur globale:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

testManualEpisodeUrl();