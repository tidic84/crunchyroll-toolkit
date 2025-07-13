#!/usr/bin/env node

/**
 * Test direct avec une URL d'anime connue
 */

async function testDirectUrl() {
  let scraper;
  
  try {
    console.log('🚀 Test direct URL');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // URL directe Fire Force (exemple)
    const testUrl = 'https://www.crunchyroll.com/fr/series/GYQYXMKX6/fire-force';
    
    console.log(`🎯 Test URL directe: ${testUrl}`);
    
    // Test 1: Récupérer les détails
    console.log('📋 Récupération détails...');
    const detailsResult = await scraper.getAnimeDetails(testUrl);
    if (detailsResult.success) {
      console.log(`✅ Titre: ${detailsResult.data.title}`);
      console.log(`🆔 ID: ${detailsResult.data.id}`);
    } else {
      console.log(`❌ Erreur détails: ${detailsResult.error}`);
    }

    // Test 2: Récupérer les épisodes
    console.log('📺 Récupération épisodes...');
    const episodesResult = await scraper.getEpisodes(testUrl);
    if (episodesResult.success) {
      console.log(`✅ ${episodesResult.data.length} épisodes trouvés`);
      episodesResult.data.slice(0, 3).forEach((ep, i) => {
        console.log(`  ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber} - ${ep.title}`);
      });
    } else {
      console.log(`❌ Erreur épisodes: ${episodesResult.error}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

testDirectUrl();