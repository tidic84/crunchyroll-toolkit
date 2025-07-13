#!/usr/bin/env node

/**
 * Test spécifique pour vérifier l'extraction des thumbnails
 */

async function testThumbnailExtraction() {
  let scraper;
  
  try {
    console.log('🖼️ Test Extraction Thumbnails Fire Force');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Naviguer directement vers Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();

    // Test de l'extraction des thumbnails depuis la page actuelle
    const thumbnailTest = await driver.executeScript(`
      console.log('🔍 Analyse des thumbnails sur la page...');
      
      const episodes = [];
      const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
      
      console.log('🎯 ' + episodeLinks.length + ' liens d\\'épisodes trouvés');
      
      // Analyser les 5 premiers épisodes
      for (let i = 0; i < Math.min(5, episodeLinks.length); i++) {
        const link = episodeLinks[i];
        const container = link.closest('[class*="playable"], [class*="episode"], [class*="card"]');
        
        if (container) {
          const title = link.textContent?.trim() || 'Episode ' + (i+1);
          
          // Chercher les balises picture
          const pictures = container.querySelectorAll('picture');
          console.log('📺 Episode ' + (i+1) + ': ' + pictures.length + ' balises picture trouvées');
          
          let thumbnail = null;
          let thumbnailType = 'none';
          
          // PRIORITÉ 1: Deuxième picture (normale)
          if (pictures.length >= 2) {
            const normalImg = pictures[1].querySelector('img');
            if (normalImg) {
              const src = normalImg.src || normalImg.getAttribute('data-src');
              if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                thumbnail = src;
                thumbnailType = '2nd-picture-normal';
              }
            }
          }
          
          // PRIORITÉ 2: Première picture si deuxième pas disponible
          if (!thumbnail && pictures.length >= 1) {
            const firstImg = pictures[0].querySelector('img');
            if (firstImg) {
              const src = firstImg.src || firstImg.getAttribute('data-src');
              if (src && src.includes('crunchyroll')) {
                thumbnail = src;
                thumbnailType = src.includes('blur=') ? '1st-picture-blurred' : '1st-picture-normal';
              }
            }
          }
          
          // PRIORITÉ 3: Toute image Crunchyroll
          if (!thumbnail) {
            const allImages = container.querySelectorAll('img');
            for (const img of allImages) {
              const src = img.src || img.getAttribute('data-src');
              if (src && src.includes('crunchyroll')) {
                thumbnail = src;
                thumbnailType = 'fallback-image';
                break;
              }
            }
          }
          
          episodes.push({
            index: i + 1,
            title: title.substring(0, 50),
            url: link.href,
            thumbnail: thumbnail,
            thumbnailType: thumbnailType,
            pictureCount: pictures.length
          });
          
          console.log('  📺 ' + (i+1) + '. ' + title.substring(0, 30));
          console.log('  🖼️ Type: ' + thumbnailType);
          console.log('  🔗 URL: ' + (thumbnail ? thumbnail.substring(0, 80) : 'AUCUN'));
        }
      }
      
      return episodes;
    `);
    
    console.log('\n📊 RÉSULTATS THUMBNAILS:');
    thumbnailTest.forEach(ep => {
      console.log(`\n${ep.index}. ${ep.title}`);
      console.log(`   Pictures: ${ep.pictureCount}`);
      console.log(`   Type: ${ep.thumbnailType}`);
      console.log(`   Thumbnail: ${ep.thumbnail ? '✅' : '❌'}`);
      if (ep.thumbnail) {
        console.log(`   URL: ${ep.thumbnail}`);
      }
    });
    
    const withThumbnails = thumbnailTest.filter(ep => ep.thumbnail).length;
    const normalThumbnails = thumbnailTest.filter(ep => ep.thumbnailType === '2nd-picture-normal').length;
    const blurredThumbnails = thumbnailTest.filter(ep => ep.thumbnailType.includes('blurred')).length;
    
    console.log('\n📈 STATISTIQUES:');
    console.log(`Total épisodes analysés: ${thumbnailTest.length}`);
    console.log(`Avec thumbnails: ${withThumbnails}/${thumbnailTest.length}`);
    console.log(`Thumbnails normaux (2ème picture): ${normalThumbnails}`);
    console.log(`Thumbnails floutés: ${blurredThumbnails}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

testThumbnailExtraction().catch(console.error);