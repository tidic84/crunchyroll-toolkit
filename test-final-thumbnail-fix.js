#!/usr/bin/env node

/**
 * Test final du fix complet - récupération de quelques épisodes avec thumbnails uniques
 */

async function testFinalThumbnailFix() {
  try {
    console.log('🏁 Test Final - Récupération épisodes avec thumbnails fixes');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Tester seulement les 10 premiers épisodes de S1 pour validation rapide
    const result = await scraper.getEpisodes('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    
    if (result.success) {
      const s1Episodes = result.data.filter(ep => ep.seasonNumber === 1).slice(0, 10);
      
      console.log('\n📺 ÉCHANTILLON ÉPISODES S1:');
      const thumbnailIds = new Set();
      
      s1Episodes.forEach((ep, i) => {
        const hasPrefix = ep.title.match(/^S\d+\s*E\d+\s*[-–]/);
        const thumbId = ep.thumbnail ? ep.thumbnail.split('/').pop().split('.')[0] : 'NONE';
        
        console.log(`${i+1}. "${ep.title}"`);
        console.log(`   S${ep.seasonNumber}E${ep.episodeNumber} | Thumb: ${thumbId} | Titre: ${hasPrefix ? '❌ Préfixé' : '✅ Nettoyé'}`);
        
        if (ep.thumbnail) {
          thumbnailIds.add(thumbId);
        }
      });
      
      const withThumbnails = s1Episodes.filter(ep => ep.thumbnail).length;
      const uniqueThumbnails = thumbnailIds.size;
      
      console.log(`\n📊 STATISTIQUES FINALES:`);
      console.log(`Episodes testés: ${s1Episodes.length}`);
      console.log(`Avec thumbnails: ${withThumbnails}/${s1Episodes.length} (${((withThumbnails/s1Episodes.length)*100).toFixed(1)}%)`);
      console.log(`Thumbnails uniques: ${uniqueThumbnails}`);
      
      // Vérification des titres nettoyés
      const withPrefixes = s1Episodes.filter(ep => ep.title.match(/^S\d+\s*E\d+\s*[-–]/)).length;
      console.log(`Titres avec préfixes: ${withPrefixes}/${s1Episodes.length}`);
      
      if (uniqueThumbnails === withThumbnails && withThumbnails >= s1Episodes.length * 0.7) {
        console.log('\n✅ SUCCÈS TOTAL: Fix complet validé!');
        console.log('  ✅ Chaque épisode a un thumbnail unique');
        console.log('  ✅ Taux de thumbnail acceptable (≥70%)');
        if (withPrefixes === 0) {
          console.log('  ✅ Tous les titres sont nettoyés');
        }
      } else if (uniqueThumbnails < withThumbnails) {
        console.log('\n❌ ÉCHEC: Thumbnails dupliqués détectés');
      } else if (withThumbnails < s1Episodes.length * 0.7) {
        console.log('\n⚠️ AMÉLIORATION NÉCESSAIRE: Taux de thumbnail trop bas');
      } else {
        console.log('\n✅ PARTIEL: Fix fonctionne mais peut être amélioré');
      }
      
    } else {
      console.log('❌ Erreur récupération épisodes:', result.error);
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFinalThumbnailFix().catch(console.error);