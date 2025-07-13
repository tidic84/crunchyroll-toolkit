#!/usr/bin/env node

/**
 * Test final pour valider que les corrections fonctionnent
 */

async function testFinalFix() {
  try {
    console.log('🏁 Test final - validation des corrections');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    console.log('1️⃣ Test recherche Fire Force...');
    const searchResult = await scraper.searchAnime('Fire Force');
    
    if (!searchResult.success || searchResult.data.length === 0) {
      console.log('❌ Recherche échouée');
      return;
    }
    
    console.log(`✅ Animé trouvé: ${searchResult.data[0].title}`);
    
    console.log('2️⃣ Test extraction épisodes saison 1...');
    
    // Aller directement sur Fire Force S1
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extraire les épisodes de S1 seulement
    const episodes = await scraper.extractAllEpisodesSimple('GYQWNXPZY');
    
    console.log(`✅ Episodes extraits: ${episodes.length}`);
    
    // Analyser les résultats
    const seasonCounts = episodes.reduce((acc, ep) => {
      acc[ep.seasonNumber] = (acc[ep.seasonNumber] || 0) + 1;
      return acc;
    }, {});
    
    const withThumbnails = episodes.filter(ep => ep.thumbnail).length;
    const uniqueUrls = new Set(episodes.map(ep => ep.url)).size;
    
    console.log('\n📊 RÉSULTATS:');
    console.log(`Total épisodes: ${episodes.length}`);
    console.log(`Episodes par saison:`, seasonCounts);
    console.log(`Avec thumbnails: ${withThumbnails}/${episodes.length} (${((withThumbnails/episodes.length)*100).toFixed(1)}%)`);
    console.log(`URLs uniques: ${uniqueUrls} (${uniqueUrls === episodes.length ? '✅' : '❌'})`);
    
    // Échantillon d'épisodes
    console.log('\n📋 Échantillon épisodes:');
    episodes.slice(0, 5).forEach((ep, i) => {
      const thumbStatus = ep.thumbnail ? '🖼️' : '❌';
      console.log(`  ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber} - "${ep.title.substring(0, 35)}" ${thumbStatus}`);
    });
    
    // Validation
    console.log('\n🔍 VALIDATION:');
    
    if (episodes.length >= 20) {
      console.log('✅ Extraction épisodes: BON (≥20 épisodes)');
    } else {
      console.log('❌ Extraction épisodes: MAUVAIS (<20 épisodes)');
    }
    
    if (withThumbnails >= episodes.length * 0.8) {
      console.log('✅ Thumbnails: BON (≥80%)');
    } else {
      console.log('❌ Thumbnails: MAUVAIS (<80%)');
    }
    
    if (uniqueUrls === episodes.length) {
      console.log('✅ Déduplication: BON (pas de doublons)');
    } else {
      console.log('❌ Déduplication: MAUVAIS (doublons détectés)');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFinalFix().catch(console.error);