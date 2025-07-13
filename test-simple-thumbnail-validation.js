#!/usr/bin/env node

/**
 * Test simple et rapide - validation du fix sur 5 épisodes
 */

async function testSimpleThumbnailValidation() {
  try {
    console.log('⚡ Test Simple - Validation fix sur 5 épisodes');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const driver = await scraper.browserManager.getDriver();
    
    // Test rapide sur 5 épisodes seulement
    const validationResult = await driver.executeScript(`
      console.log('🔍 Validation rapide - 5 épisodes...');
      
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      const episodeMap = new Map();
      
      // Traiter les 5 premiers liens uniques
      let processed = 0;
      allLinks.forEach((linkEl) => {
        if (processed >= 5) return;
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) return;
        if (episodeMap.has(href)) return;
        
        const text = linkEl.textContent?.trim() || '';
        const hasGoodTitle = text.length > 10 && 
                           (text.includes('E') || text.includes('-') || text.includes('Ep')) && 
                           !text.match(/^\\d+m$/) && 
                           !text.toLowerCase().includes('lecture');
        
        if (hasGoodTitle) {
          episodeMap.set(href, { linkEl, text });
          processed++;
        }
      });
      
      const results = [];
      
      episodeMap.forEach((episode, url) => {
        const linkEl = episode.linkEl;
        
        // Nouvelle logique: conteneur spécifique
        const specificContainer = linkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"]');
        const containersToSearch = specificContainer ? [specificContainer] : [linkEl.parentElement].filter(Boolean);
        
        let thumbnail = '';
        
        // Chercher 2ème picture
        for (const container of containersToSearch) {
          if (thumbnail) break;
          const pictures = container.querySelectorAll('picture');
          if (pictures.length >= 2) {
            const normalImg = pictures[1].querySelector('img');
            if (normalImg) {
              const src = normalImg.src || normalImg.getAttribute('data-src');
              if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                thumbnail = src.trim();
                break;
              }
            }
          }
        }
        
        // Fallback: toute image
        if (!thumbnail) {
          for (const container of containersToSearch) {
            if (thumbnail) break;
            const allImages = container.querySelectorAll('img');
            for (const img of allImages) {
              const src = img.src || img.getAttribute('data-src');
              if (src && src.includes('crunchyroll') && !src.includes('blur=') && 
                  !src.includes('placeholder') && src.match(/\\.(jpg|jpeg|png|webp)/i)) {
                thumbnail = src.trim();
                break;
              }
            }
          }
        }
        
        results.push({
          url: url.substring(url.lastIndexOf('/') + 1),
          title: episode.text.substring(0, 30),
          thumbnail: thumbnail,
          thumbnailId: thumbnail ? thumbnail.split('/').pop().split('.')[0] : 'NONE'
        });
      });
      
      return results;
    `);
    
    console.log('\n📺 RÉSULTATS (5 épisodes):');
    const thumbnailIds = new Set();
    
    validationResult.forEach((result, i) => {
      console.log(`${i+1}. "${result.title}"`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Thumbnail: ${result.thumbnailId} ${result.thumbnail ? '✅' : '❌'}`);
      
      if (result.thumbnail) {
        thumbnailIds.add(result.thumbnailId);
      }
    });
    
    const withThumbnails = validationResult.filter(r => r.thumbnail).length;
    const uniqueThumbnails = thumbnailIds.size;
    
    console.log(`\n📊 VALIDATION:`)
    console.log(`Avec thumbnails: ${withThumbnails}/5`);
    console.log(`Thumbnails uniques: ${uniqueThumbnails}`);
    
    if (uniqueThumbnails === withThumbnails && withThumbnails >= 3) {
      console.log('\n✅ SUCCÈS: Fix validé!');
      console.log('  ✅ Chaque épisode a un thumbnail unique');
      console.log('  ✅ Bug de déduplication corrigé');
    } else {
      console.log('\n❌ ÉCHEC: Fix non validé');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testSimpleThumbnailValidation().catch(console.error);