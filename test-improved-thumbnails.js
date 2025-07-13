#!/usr/bin/env node

/**
 * Test de la nouvelle logique d'extraction des thumbnails
 */

async function testImprovedThumbnails() {
  try {
    console.log('🖼️ Test Nouvelle Logique Thumbnails');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Test de la nouvelle logique d'extraction
    const thumbnailResults = await driver.executeScript(`
      console.log('🖼️ Test nouvelle logique thumbnails...');
      
      const results = [];
      const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
      
      // Tester les 10 premiers épisodes
      for (let i = 0; i < Math.min(10, episodeLinks.length); i++) {
        const linkEl = episodeLinks[i];
        const href = linkEl.href;
        const title = linkEl.textContent?.trim() || 'Episode ' + (i+1);
        
        let thumbnail = '';
        let thumbnailMethod = 'none';
        
        // Reproduire la nouvelle logique
        const possibleContainers = [
          linkEl.closest('[class*="episode"]'),
          linkEl.closest('[class*="card"]'), 
          linkEl.closest('[class*="item"]'),
          linkEl.closest('[role="listitem"]'),
          linkEl.closest('[class*="playable"]'),
          linkEl.parentElement,
          linkEl.parentElement?.parentElement
        ].filter(Boolean);
        
        console.log('📦 Episode ' + (i+1) + ': ' + possibleContainers.length + ' conteneurs');
        
        // PRIORITÉ 1: Chercher 2ème picture
        for (const container of possibleContainers) {
          if (thumbnail) break;
          
          const pictures = container.querySelectorAll('picture');
          if (pictures.length >= 2) {
            const normalImg = pictures[1].querySelector('img');
            if (normalImg) {
              const src = normalImg.src || normalImg.getAttribute('data-src') || normalImg.getAttribute('data-lazy');
              if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                thumbnail = src;
                thumbnailMethod = '2nd-picture';
                break;
              }
            }
          }
        }
        
        // PRIORITÉ 2: Toute image Crunchyroll
        if (!thumbnail) {
          for (const container of possibleContainers) {
            if (thumbnail) break;
            
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
                  thumbnail = src;
                  thumbnailMethod = 'direct-image';
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        // PRIORITÉ 3: Fallback même flouté
        if (!thumbnail) {
          for (const container of possibleContainers) {
            if (thumbnail) break;
            
            const allImages = container.querySelectorAll('img');
            for (const img of allImages) {
              const srcSources = [
                img.src,
                img.getAttribute('data-src'),
                img.getAttribute('data-lazy'),
                img.getAttribute('data-original')
              ].filter(Boolean);
              
              for (const src of srcSources) {
                if (src && 
                    (src.includes('crunchyroll') || src.includes('imgsrv')) && 
                    !src.includes('placeholder') &&
                    !src.includes('icon') &&
                    src.match(/\\.(jpg|jpeg|png|webp)/i)) {
                  thumbnail = src;
                  thumbnailMethod = 'fallback';
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        results.push({
          index: i + 1,
          title: title.substring(0, 40),
          thumbnail: thumbnail,
          method: thumbnailMethod,
          hasThumbnail: !!thumbnail,
          containerCount: possibleContainers.length
        });
        
        if (thumbnail) {
          console.log('✅ Episode ' + (i+1) + ': ' + thumbnailMethod + ' - ' + thumbnail.substring(0, 60));
        } else {
          console.log('❌ Episode ' + (i+1) + ': Aucun thumbnail');
        }
      }
      
      return results;
    `);
    
    console.log('\\n📊 RÉSULTATS AMÉLIORÉS:');
    thumbnailResults.forEach(result => {
      console.log(`${result.index}. "${result.title}"`);
      console.log(`   Thumbnail: ${result.hasThumbnail ? '✅' : '❌'} (${result.method})`);
      console.log(`   Conteneurs: ${result.containerCount}`);
      if (result.thumbnail) {
        console.log(`   URL: ${result.thumbnail.substring(0, 80)}...`);
      }
    });
    
    const withThumbnails = thumbnailResults.filter(r => r.hasThumbnail).length;
    console.log(`\\n📈 AMÉLIORATION: ${withThumbnails}/${thumbnailResults.length} épisodes avec thumbnails (${((withThumbnails/thumbnailResults.length)*100).toFixed(1)}%)`);
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testImprovedThumbnails().catch(console.error);