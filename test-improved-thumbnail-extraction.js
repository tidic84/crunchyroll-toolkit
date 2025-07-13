#!/usr/bin/env node

/**
 * Test du fix amélioré d'extraction des thumbnails
 */

async function testImprovedThumbnailExtraction() {
  try {
    console.log('🔧 Test Fix Amélioré - Extraction thumbnails');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Attendre que les images se chargent

    const driver = await scraper.browserManager.getDriver();
    
    // Tester la nouvelle logique d'extraction sur les premiers épisodes
    const testResult = await driver.executeScript(`
      console.log('🔍 Test nouvelle logique thumbnail...');
      
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      const episodeMap = new Map();
      
      // Traiter les 8 premiers liens uniques
      let processed = 0;
      allLinks.forEach((linkEl) => {
        if (processed >= 8) return;
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) return;
        if (episodeMap.has(href)) return;
        
        const text = linkEl.textContent?.trim() || '';
        episodeMap.set(href, { linkEl, text });
        processed++;
      });
      
      const results = [];
      
      episodeMap.forEach((episode, url) => {
        const linkEl = episode.linkEl;
        
        // NOUVELLE LOGIQUE HYBRIDE
        let searchContainers = [];
        
        // Conteneurs spécifiques
        const specificContainer = linkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]');
        if (specificContainer) {
          searchContainers.push({ type: 'specific', container: specificContainer });
        }
        
        // Parents directs
        if (linkEl.parentElement) searchContainers.push({ type: 'parent', container: linkEl.parentElement });
        if (linkEl.parentElement?.parentElement) searchContainers.push({ type: 'grandparent', container: linkEl.parentElement.parentElement });
        if (linkEl.parentElement?.parentElement?.parentElement) searchContainers.push({ type: 'great-grandparent', container: linkEl.parentElement.parentElement.parentElement });
        
        let thumbnail = '';
        let method = 'none';
        
        // PRIORITÉ 1: Images avec classes spécifiques Crunchyroll
        for (const containerInfo of searchContainers) {
          if (thumbnail) break;
          
          const container = containerInfo.container;
          const thumbnailImages = container.querySelectorAll('img[class*="playable-thumbnail"], img[class*="content-image"]');
          
          console.log('  📦 ' + containerInfo.type + ': ' + thumbnailImages.length + ' images thumbnail');
          
          if (thumbnailImages.length > 0) {
            const targetImg = thumbnailImages[thumbnailImages.length - 1];
            const src = targetImg.src || targetImg.getAttribute('data-src') || targetImg.getAttribute('data-lazy');
            
            if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
              thumbnail = src.trim();
              method = 'classe-specifique-' + containerInfo.type;
              console.log('  ✅ Classe spécifique: ' + thumbnail.split('/').pop().split('.')[0] + '.jpg');
              break;
            }
          }
        }
        
        // PRIORITÉ 2: 2ème picture
        if (!thumbnail) {
          for (const containerInfo of searchContainers.slice(0, 2)) {
            if (thumbnail) break;
            
            const container = containerInfo.container;
            const pictureElements = container.querySelectorAll('picture');
            
            if (pictureElements.length >= 2) {
              const normalPicture = pictureElements[1];
              const normalImg = normalPicture.querySelector('img');
              if (normalImg) {
                const normalSrc = normalImg.src || normalImg.getAttribute('data-src') || normalImg.getAttribute('data-lazy');
                if (normalSrc && normalSrc.includes('crunchyroll') && !normalSrc.includes('blur=')) {
                  thumbnail = normalSrc.trim();
                  method = '2eme-picture-' + containerInfo.type;
                  console.log('  ✅ 2ème picture: ' + thumbnail.split('/').pop().split('.')[0] + '.jpg');
                  break;
                }
              }
            }
          }
        }
        
        // PRIORITÉ 3: Toute image valide
        if (!thumbnail) {
          for (const containerInfo of searchContainers) {
            if (thumbnail) break;
            
            const container = containerInfo.container;
            const allImages = container.querySelectorAll('img');
            
            for (const img of allImages) {
              const srcSources = [
                img.src,
                img.getAttribute('data-src'),
                img.getAttribute('data-lazy'),
                img.getAttribute('data-original'),
                img.getAttribute('srcset')?.split(' ')[0]
              ].filter(Boolean);
              
              for (const src of srcSources) {
                if (src && 
                    (src.includes('crunchyroll') || src.includes('imgsrv')) && 
                    !src.includes('blur=') && 
                    !src.includes('placeholder') &&
                    !src.includes('icon') &&
                    !src.includes('logo') &&
                    src.match(/\\.(jpg|jpeg|png|webp)/i)) {
                  thumbnail = src.trim();
                  method = 'image-generale-' + containerInfo.type;
                  console.log('  ✅ Image générale: ' + thumbnail.split('/').pop().split('.')[0] + '.jpg');
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        results.push({
          url: url.substring(url.lastIndexOf('/') + 1),
          text: episode.text.substring(0, 30),
          thumbnail: thumbnail,
          thumbnailId: thumbnail ? thumbnail.split('/').pop().split('.')[0] : 'NONE',
          method: method,
          containersFound: searchContainers.length
        });
      });
      
      return results;
    `);
    
    console.log('\n📺 RÉSULTATS EXTRACTION AMÉLIORÉE:');
    const uniqueThumbnails = new Set();
    
    testResult.forEach((result, i) => {
      console.log(`${i+1}. "${result.text}"`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Thumbnail: ${result.thumbnailId} ${result.thumbnail ? '✅' : '❌'}`);
      console.log(`   Méthode: ${result.method} (${result.containersFound} conteneurs)`);
      console.log('');
      
      if (result.thumbnail) {
        uniqueThumbnails.add(result.thumbnailId);
      }
    });
    
    const withThumbnails = testResult.filter(r => r.thumbnail).length;
    const totalTested = testResult.length;
    
    console.log(`📊 STATISTIQUES AMÉLIORÉES:`);
    console.log(`Épisodes testés: ${totalTested}`);
    console.log(`Avec thumbnails: ${withThumbnails}/${totalTested} (${((withThumbnails/totalTested)*100).toFixed(1)}%)`);
    console.log(`Thumbnails uniques: ${uniqueThumbnails.size}`);
    
    if (withThumbnails >= totalTested * 0.8) {
      console.log('\n✅ SUCCÈS: Taux de thumbnail élevé (≥80%)!');
    } else if (withThumbnails >= totalTested * 0.5) {
      console.log('\n🟡 PARTIEL: Amélioration mais peut mieux faire');
    } else {
      console.log('\n❌ ÉCHEC: Taux de thumbnail encore trop bas');
    }
    
    if (uniqueThumbnails.size === withThumbnails && withThumbnails > 1) {
      console.log('✅ Chaque épisode a un thumbnail unique!');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testImprovedThumbnailExtraction().catch(console.error);