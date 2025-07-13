#!/usr/bin/env node

/**
 * Test final pour vérifier les thumbnails sur un échantillon d'épisodes
 */

async function testFinalThumbnails() {
  let scraper;
  
  try {
    console.log('🎬 Test Final - Extraction Thumbnails Multi-Saisons');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 20000
    });

    // Rechercher Fire Force
    const searchResult = await scraper.searchAnime('Fire Force');
    
    if (searchResult.success && searchResult.data.length > 0) {
      const anime = searchResult.data[0];
      console.log(`✅ Trouvé: ${anime.title}`);
      
      // Extraire seulement les premiers épisodes de chaque saison pour tester rapidement
      console.log('📺 Extraction d\'échantillons d\'épisodes...');
      
      // Navigation manuelle vers chaque saison
      await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      const driver = await scraper.browserManager.getDriver();
      
      // Extraire quelques épisodes S1
      console.log('\n=== SAISON 1 ===');
      const s1Episodes = await extractSampleEpisodes(driver, 1, 3);
      
      // Naviguer vers S2
      await clickNextSeason(driver);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n=== SAISON 2 ===');
      const s2Episodes = await extractSampleEpisodes(driver, 2, 3);
      
      const allSampleEpisodes = [...s1Episodes, ...s2Episodes];
      
      // Statistiques
      const withThumbnails = allSampleEpisodes.filter(ep => ep.thumbnail).length;
      const normalThumbnails = allSampleEpisodes.filter(ep => ep.thumbnail && !ep.thumbnail.includes('blur=')).length;
      
      console.log('\n📊 RÉSULTATS FINAUX:');
      console.log(`Total échantillons: ${allSampleEpisodes.length}`);
      console.log(`Avec thumbnails: ${withThumbnails}/${allSampleEpisodes.length}`);
      console.log(`Thumbnails normaux (sans blur): ${normalThumbnails}`);
      console.log(`Taux de réussite: ${((withThumbnails/allSampleEpisodes.length)*100).toFixed(1)}%`);
      
      // Montrer quelques exemples
      console.log('\n🖼️ EXEMPLES DE THUMBNAILS:');
      allSampleEpisodes.forEach(ep => {
        if (ep.thumbnail) {
          console.log(`✅ ${ep.season}E${ep.episode}: ${ep.title}`);
          console.log(`   ${ep.thumbnail.substring(0, 100)}...`);
        }
      });
      
    } else {
      console.log('❌ Erreur recherche Fire Force');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

async function extractSampleEpisodes(driver, seasonNum, count) {
  const episodes = await driver.executeScript(`
    const episodes = [];
    const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
    
    let found = 0;
    for (let i = 0; i < episodeLinks.length && found < ${count}; i++) {
      const link = episodeLinks[i];
      const title = link.textContent?.trim() || '';
      
      // Vérifier que c'est bien un épisode de la saison actuelle
      if (title.includes('S${seasonNum}') || (${seasonNum} === 1 && title.includes('S1')) || title.includes('Episode')) {
        const container = link.closest('[class*="playable"], [class*="episode"], [class*="card"]');
        
        let thumbnail = null;
        if (container) {
          const pictures = container.querySelectorAll('picture');
          
          // Priorité: deuxième picture (normale)
          if (pictures.length >= 2) {
            const normalImg = pictures[1].querySelector('img');
            if (normalImg) {
              const src = normalImg.src || normalImg.getAttribute('data-src');
              if (src && src.includes('crunchyroll')) {
                thumbnail = src;
              }
            }
          }
          
          // Fallback: première picture
          if (!thumbnail && pictures.length >= 1) {
            const firstImg = pictures[0].querySelector('img');
            if (firstImg) {
              const src = firstImg.src || firstImg.getAttribute('data-src');
              if (src && src.includes('crunchyroll')) {
                thumbnail = src;
              }
            }
          }
        }
        
        episodes.push({
          season: 'S${seasonNum}',
          episode: found + 1,
          title: title.substring(0, 40),
          thumbnail: thumbnail,
          url: link.href
        });
        
        found++;
      }
    }
    
    return episodes;
  `);
  
  return episodes;
}

async function clickNextSeason(driver) {
  await driver.executeScript(`
    const buttons = document.querySelectorAll('div.cta-wrapper');
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || '';
      if (text.includes('Saison suivante') || text.includes('Suivante')) {
        if (!btn.classList.contains('state-disabled')) {
          btn.click();
          return;
        }
      }
    }
  `);
}

testFinalThumbnails().catch(console.error);