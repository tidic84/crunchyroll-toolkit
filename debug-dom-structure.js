#!/usr/bin/env node

/**
 * Debug de la structure DOM pour comprendre où sont les thumbnails
 */

async function debugDomStructure() {
  try {
    console.log('🔍 Debug Structure DOM - Analyse détaillée');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Analyse détaillée de la structure DOM
    const domAnalysis = await driver.executeScript(`
      console.log('🔍 Analyse DOM détaillée...');
      
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('Total liens trouvés:', allLinks.length);
      
      // Analyser le premier lien en détail
      if (allLinks.length > 0) {
        const firstLink = allLinks[0];
        const analysis = {
          linkText: firstLink.textContent?.trim(),
          linkHref: firstLink.href,
          linkClasses: firstLink.className,
          parentElement: {
            tagName: firstLink.parentElement?.tagName,
            classes: firstLink.parentElement?.className,
            id: firstLink.parentElement?.id
          },
          closestContainers: [],
          imagesFound: [],
          picturesFound: []
        };
        
        // Chercher les conteneurs possibles
        const containerSelectors = [
          '[class*="episode"]',
          '[class*="card"]', 
          '[role="listitem"]',
          '[class*="item"]',
          '[class*="playable"]'
        ];
        
        containerSelectors.forEach(selector => {
          const container = firstLink.closest(selector);
          if (container) {
            analysis.closestContainers.push({
              selector: selector,
              tagName: container.tagName,
              classes: container.className,
              id: container.id || 'NO_ID'
            });
          }
        });
        
        // Analyser les images dans les conteneurs trouvés
        analysis.closestContainers.forEach((containerInfo, index) => {
          const container = firstLink.closest(containerInfo.selector);
          if (container) {
            const images = container.querySelectorAll('img');
            const pictures = container.querySelectorAll('picture');
            
            analysis.imagesFound.push({
              containerIndex: index,
              containerSelector: containerInfo.selector,
              imageCount: images.length,
              imageDetails: Array.from(images).map((img, i) => ({
                index: i,
                src: img.src || 'NO_SRC',
                dataSrc: img.getAttribute('data-src') || 'NO_DATA_SRC',
                alt: img.alt || 'NO_ALT',
                classes: img.className
              }))
            });
            
            analysis.picturesFound.push({
              containerIndex: index,
              containerSelector: containerInfo.selector,
              pictureCount: pictures.length,
              pictureDetails: Array.from(pictures).map((pic, i) => {
                const img = pic.querySelector('img');
                return {
                  index: i,
                  hasImg: !!img,
                  imgSrc: img?.src || 'NO_IMG',
                  imgDataSrc: img?.getAttribute('data-src') || 'NO_DATA_SRC'
                };
              })
            });
          }
        });
        
        // Si pas de conteneurs spécifiques, analyser le parent direct
        if (analysis.closestContainers.length === 0) {
          const parent = firstLink.parentElement;
          if (parent) {
            const images = parent.querySelectorAll('img');
            const pictures = parent.querySelectorAll('picture');
            
            analysis.imagesFound.push({
              containerIndex: -1,
              containerSelector: 'parentElement',
              imageCount: images.length,
              imageDetails: Array.from(images).map((img, i) => ({
                index: i,
                src: img.src || 'NO_SRC',
                dataSrc: img.getAttribute('data-src') || 'NO_DATA_SRC',
                alt: img.alt || 'NO_ALT',
                classes: img.className
              }))
            });
          }
        }
        
        return analysis;
      }
      
      return { error: 'Aucun lien trouvé' };
    `);
    
    console.log('\n📊 ANALYSE DOM DÉTAILLÉE:');
    console.log(JSON.stringify(domAnalysis, null, 2));
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

debugDomStructure().catch(console.error);