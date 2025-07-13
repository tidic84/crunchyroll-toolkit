#!/usr/bin/env node

/**
 * Test rapide pour vérifier les améliorations sans timeout
 */

async function quickTest() {
  let scraper;
  
  try {
    console.log('🚀 Test Rapide - Vérification Améliorations');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    // Test avec Fire Force
    const result = await scraper.searchAnime('Fire Force');
    
    if (result.success && result.data.length > 0) {
      const anime = result.data[0];
      console.log(`✅ Trouvé: ${anime.title}`);
      
      // Récupérer seulement quelques épisodes pour tester rapidement
      const episodeResult = await scraper.getEpisodes(anime.url);
      
      if (episodeResult.success) {
        const episodes = episodeResult.data;
        console.log(`📺 ${episodes.length} épisodes extraits`);
        
        // Compter les thumbnails
        const withThumbnails = episodes.filter(ep => ep.thumbnail && ep.thumbnail !== '').length;
        console.log(`🖼️ ${withThumbnails} épisodes avec thumbnails`);
        
        // Vérifier les saisons
        const seasons = [...new Set(episodes.map(ep => ep.seasonNumber))].sort();
        console.log(`🎬 Saisons trouvées: ${seasons.join(', ')}`);
        
        // Montrer quelques exemples
        console.log('\n📋 Exemples d\'épisodes:');
        episodes.slice(0, 5).forEach((ep, i) => {
          console.log(`  ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber} - ${ep.title.substring(0, 40)}`);
          console.log(`     Thumbnail: ${ep.thumbnail ? '✅ Oui' : '❌ Non'}`);
          console.log(`     Durée: ${ep.duration || 'N/A'}`);
        });
        
      } else {
        console.log('❌ Erreur épisodes:', episodeResult.error);
      }
    } else {
      console.log('❌ Erreur recherche:', result.error);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

quickTest().catch(console.error);