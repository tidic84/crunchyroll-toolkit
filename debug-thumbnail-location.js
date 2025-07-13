#!/usr/bin/env node

/**
 * Debug pour trouver où sont réellement stockés les thumbnails des épisodes
 */

async function debugThumbnailLocation() {
  try {
    console.log('🔍 Debug Localisation Thumbnails - Où sont les images?');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Attendre plus longtemps que les images se chargent

    const driver = await scraper.browserManager.getDriver();
    
    // Analyser TOUTES les images sur la page pour voir lesquelles sont des thumbnails d'épisodes
    const allImagesAnalysis = await driver.executeScript(`
      console.log('🔍 Analyse de TOUTES les images de la page...');
      
      const allImages = document.querySelectorAll('img');
      console.log('Total images trouvées sur la page:', allImages.length);
      
      const imageAnalysis = [];
      
      allImages.forEach((img, index) => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') || 'NO_SRC';
        const alt = img.alt || 'NO_ALT';
        const parent = img.parentElement;
        const parentClasses = parent?.className || 'NO_PARENT_CLASSES';
        const parentTag = parent?.tagName || 'NO_PARENT_TAG';
        
        // Est-ce que cette image semble être un thumbnail d'épisode?
        const isEpisodeThumbnail = (
          src.includes('crunchyroll') && 
          !src.includes('logo') && 
          !src.includes('icon') && 
          !src.includes('placeholder') &&
          src.match(/\\.(jpg|jpeg|png|webp)/i) &&
          (src.includes('catalog') || src.includes('thumbnail') || src.includes('poster'))
        );
        
        // Est-ce qu'il y a un lien vers un épisode près de cette image?
        const nearbyEpisodeLink = img.closest('a[href*="/watch/"]') || 
                                  parent?.querySelector('a[href*="/watch/"]') ||
                                  parent?.parentElement?.querySelector('a[href*="/watch/"]') ||
                                  parent?.parentElement?.parentElement?.querySelector('a[href*="/watch/"]');
        
        if (isEpisodeThumbnail || nearbyEpisodeLink) {
          imageAnalysis.push({
            index: index,
            src: src.substring(0, 100),
            alt: alt.substring(0, 50),
            parentTag: parentTag,
            parentClasses: parentClasses.substring(0, 100),
            isEpisodeThumbnail: isEpisodeThumbnail,
            hasNearbyEpisodeLink: !!nearbyEpisodeLink,
            nearbyEpisodeLinkHref: nearbyEpisodeLink?.href?.substring(nearbyEpisodeLink.href.lastIndexOf('/') + 1) || 'NO_LINK',
            // Analyser le chemin jusqu'au conteneur épisode
            pathToEpisodeContainer: img.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]')?.className || 'NO_EPISODE_CONTAINER'
          });
        }
      });
      
      console.log('Images d\\'épisodes potentielles trouvées:', imageAnalysis.length);
      
      return {
        totalImages: allImages.length,
        episodeImages: imageAnalysis,
        // Analyser aussi la structure DOM générale
        episodeLinksCount: document.querySelectorAll('a[href*="/watch/"]').length
      };
    `);
    
    console.log('\n📊 ANALYSE THUMBNAILS:');
    console.log(`Total images sur la page: ${allImagesAnalysis.totalImages}`);
    console.log(`Liens d'épisodes trouvés: ${allImagesAnalysis.episodeLinksCount}`);
    console.log(`Images d'épisodes potentielles: ${allImagesAnalysis.episodeImages.length}`);
    
    console.log('\n🖼️ DÉTAILS IMAGES ÉPISODES:');
    allImagesAnalysis.episodeImages.slice(0, 10).forEach((img, i) => {
      console.log(`${i+1}. Image ${img.index}:`);
      console.log(`   SRC: ${img.src}`);
      console.log(`   ALT: ${img.alt}`);
      console.log(`   Parent: ${img.parentTag} (${img.parentClasses})`);
      console.log(`   Est thumbnail: ${img.isEpisodeThumbnail ? '✅' : '❌'}`);
      console.log(`   Lien épisode proche: ${img.hasNearbyEpisodeLink ? '✅' : '❌'} (${img.nearbyEpisodeLinkHref})`);
      console.log(`   Conteneur épisode: ${img.pathToEpisodeContainer}`);
      console.log('');
    });
    
    // Analyser spécifiquement la structure autour des liens d'épisodes
    const episodeLinkAnalysis = await driver.executeScript(`
      console.log('🔍 Analyse structure autour des liens d\\'épisodes...');
      
      const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
      const linkAnalysis = [];
      
      // Analyser les 5 premiers liens d'épisodes
      for (let i = 0; i < Math.min(5, episodeLinks.length); i++) {
        const link = episodeLinks[i];
        const href = link.href;
        const text = link.textContent?.trim()?.substring(0, 40) || 'NO_TEXT';
        
        // Chercher des images dans un rayon de plus en plus grand
        const searchRadii = [
          { name: 'same-element', element: link },
          { name: 'parent', element: link.parentElement },
          { name: 'grandparent', element: link.parentElement?.parentElement },
          { name: 'great-grandparent', element: link.parentElement?.parentElement?.parentElement }
        ];
        
        const imagesFound = [];
        
        searchRadii.forEach(radius => {
          if (radius.element) {
            const images = radius.element.querySelectorAll('img');
            images.forEach(img => {
              const src = img.src || img.getAttribute('data-src') || 'NO_SRC';
              if (src.includes('crunchyroll') && src !== 'NO_SRC') {
                imagesFound.push({
                  radius: radius.name,
                  src: src.substring(0, 80),
                  alt: img.alt?.substring(0, 30) || 'NO_ALT'
                });
              }
            });
          }
        });
        
        linkAnalysis.push({
          linkIndex: i,
          href: href.substring(href.lastIndexOf('/') + 1),
          text: text,
          imagesFound: imagesFound
        });
      }
      
      return linkAnalysis;
    `);
    
    console.log('\n🔗 ANALYSE LIENS ÉPISODES:');
    episodeLinkAnalysis.forEach(link => {
      console.log(`Lien ${link.linkIndex + 1}: ${link.href} ("${link.text}")`);
      if (link.imagesFound.length > 0) {
        link.imagesFound.forEach(img => {
          console.log(`  📷 ${img.radius}: ${img.src} (${img.alt})`);
        });
      } else {
        console.log(`  ❌ Aucune image trouvée`);
      }
      console.log('');
    });
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

debugThumbnailLocation().catch(console.error);