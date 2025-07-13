#!/usr/bin/env node

/**
 * Debug détaillé de la structure des thumbnails
 */

async function debugThumbnailStructure() {
  let scraper;
  
  try {
    console.log('🔍 Debug Structure Thumbnails');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Naviguer directement vers Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Attendre plus longtemps pour le chargement

    const driver = await scraper.browserManager.getDriver();

    // Analyser la structure DOM en détail
    const domAnalysis = await driver.executeScript(`
      console.log('🔍 Analyse complète de la structure DOM...');
      
      const analysis = {
        totalEpisodeLinks: 0,
        episodeContainers: [],
        pictureElements: [],
        imageElements: [],
        thumbnailCandidates: []
      };
      
      // 1. Compter tous les liens d'épisodes
      const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
      analysis.totalEpisodeLinks = episodeLinks.length;
      console.log('🎯 ' + analysis.totalEpisodeLinks + ' liens d\\'épisodes trouvés');
      
      // 2. Analyser les premiers épisodes en détail
      for (let i = 0; i < Math.min(3, episodeLinks.length); i++) {
        const link = episodeLinks[i];
        const title = link.textContent?.trim() || 'Episode ' + (i+1);
        
        console.log('\\n📺 Episode ' + (i+1) + ': ' + title);
        
        // Chercher tous les conteneurs possibles
        const containers = [
          link.closest('[class*="playable"]'),
          link.closest('[class*="episode"]'),
          link.closest('[class*="card"]'),
          link.closest('[role="listitem"]'),
          link.parentElement,
          link.parentElement?.parentElement
        ].filter(Boolean);
        
        console.log('📦 ' + containers.length + ' conteneurs trouvés');
        
        const containerAnalysis = {
          episodeIndex: i + 1,
          title: title,
          containers: [],
          pictures: [],
          images: [],
          thumbnailFound: false,
          thumbnailUrl: null
        };
        
        // Analyser chaque conteneur
        containers.forEach((container, idx) => {
          if (!container) return;
          
          const containerInfo = {
            index: idx,
            tagName: container.tagName,
            className: container.className,
            id: container.id || '',
            pictureCount: container.querySelectorAll('picture').length,
            imageCount: container.querySelectorAll('img').length
          };
          
          console.log('  📦 Conteneur ' + idx + ': ' + container.tagName + ' (pictures: ' + containerInfo.pictureCount + ', images: ' + containerInfo.imageCount + ')');
          
          // Analyser les pictures dans ce conteneur
          const pictures = container.querySelectorAll('picture');
          pictures.forEach((picture, pIdx) => {
            const imgs = picture.querySelectorAll('img');
            console.log('    🖼️ Picture ' + pIdx + ': ' + imgs.length + ' images');
            
            imgs.forEach((img, imgIdx) => {
              const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
              console.log('      📷 Image ' + imgIdx + ': ' + (src ? src.substring(0, 80) : 'NO_SRC'));
              
              if (src && src.includes('crunchyroll')) {
                const isBlurred = src.includes('blur=');
                console.log('        ' + (isBlurred ? '🌫️ FLOUTÉE' : '✨ NORMALE') + ': ' + src.substring(0, 80));
                
                if (!containerAnalysis.thumbnailFound || !isBlurred) {
                  containerAnalysis.thumbnailFound = true;
                  containerAnalysis.thumbnailUrl = src;
                  if (!isBlurred) {
                    console.log('        ✅ MEILLEUR THUMBNAIL TROUVÉ');
                  }
                }
              }
            });
          });
          
          // Si pas de pictures, chercher des images directes
          if (containerInfo.pictureCount === 0 && containerInfo.imageCount > 0) {
            const directImages = container.querySelectorAll('img');
            directImages.forEach((img, imgIdx) => {
              const src = img.src || img.getAttribute('data-src');
              if (src && src.includes('crunchyroll')) {
                console.log('    📷 Image directe ' + imgIdx + ': ' + src.substring(0, 80));
                if (!containerAnalysis.thumbnailFound) {
                  containerAnalysis.thumbnailFound = true;
                  containerAnalysis.thumbnailUrl = src;
                }
              }
            });
          }
          
          containerAnalysis.containers.push(containerInfo);
        });
        
        analysis.episodeContainers.push(containerAnalysis);
      }
      
      return analysis;
    `);
    
    console.log('\n📊 ANALYSE COMPLÈTE:');
    console.log(`Total liens d'épisodes: ${domAnalysis.totalEpisodeLinks}`);
    
    domAnalysis.episodeContainers.forEach(episode => {
      console.log(`\n📺 ${episode.title}`);
      console.log(`  Conteneurs analysés: ${episode.containers.length}`);
      console.log(`  Thumbnail trouvé: ${episode.thumbnailFound ? '✅' : '❌'}`);
      if (episode.thumbnailUrl) {
        console.log(`  URL: ${episode.thumbnailUrl}`);
        console.log(`  Type: ${episode.thumbnailUrl.includes('blur=') ? 'Floutée' : 'Normale'}`);
      }
    });
    
    const withThumbnails = domAnalysis.episodeContainers.filter(ep => ep.thumbnailFound).length;
    console.log(`\n📈 Résumé: ${withThumbnails}/${domAnalysis.episodeContainers.length} épisodes avec thumbnails`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

debugThumbnailStructure().catch(console.error);