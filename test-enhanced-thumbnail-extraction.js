#!/usr/bin/env node

/**
 * Test de l'extraction améliorée avec déduplication intelligente et liens alternatifs
 */

async function testEnhancedThumbnailExtraction() {
  try {
    console.log('🚀 Test Extraction Améliorée - Déduplication intelligente');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 20000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Attendre le chargement complet

    const driver = await scraper.browserManager.getDriver();
    
    // Simuler la nouvelle logique d'extraction sur les premiers épisodes
    const enhancedResult = await driver.executeScript(`
      console.log('🔍 Test logique améliorée...');
      
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('Total liens:', allLinks.length);
      
      // Nouvelle logique de déduplication intelligente
      const episodeMap = new Map();
      
      allLinks.forEach((linkEl, index) => {
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) return;
        
        const text = linkEl.textContent?.trim() || '';
        const hasGoodTitle = text.length > 10 && 
                           (text.includes('E') || text.includes('-') || text.includes('Ep')) && 
                           !text.match(/^\\d+m$/) && 
                           !text.match(/^\\d+$/) &&
                           !text.toLowerCase().includes('lecture') &&
                           text !== 'NO_TEXT';
        
        const hasBetterTitle = hasGoodTitle && text.length > 15;
        
        // Nouvelle logique de déduplication
        if (!episodeMap.has(href)) {
          episodeMap.set(href, {
            linkEl: linkEl,
            text: text,
            href: href,
            index: index,
            hasGoodTitle: hasGoodTitle,
            titleQuality: hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1),
            alternativeLinks: []
          });
        } else {
          const existing = episodeMap.get(href);
          
          // Mise à jour du titre si meilleur
          if ((hasBetterTitle && !existing.hasGoodTitle) ||
              (hasGoodTitle && existing.text === 'NO_TEXT') ||
              (text.length > existing.text.length && hasGoodTitle)) {
            existing.text = text;
            existing.hasGoodTitle = hasGoodTitle;
            existing.titleQuality = hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1);
          }
          
          // Préserver le linkEl avec le plus de chances d'avoir un thumbnail
          const currentHasThumbnailContainer = linkEl.closest('[class*="playable"], [class*="thumbnail"], [class*="image"]') ||
                                             linkEl.parentElement?.querySelector('img, picture');
          const existingHasThumbnailContainer = existing.linkEl.closest('[class*="playable"], [class*="thumbnail"], [class*="image"]') ||
                                              existing.linkEl.parentElement?.querySelector('img, picture');
          
          if (currentHasThumbnailContainer && !existingHasThumbnailContainer) {
            existing.linkEl = linkEl;
            existing.index = index;
          }
          
          existing.alternativeLinks.push(linkEl);
        }
      });
      
      console.log('Episodes uniques après déduplication:', episodeMap.size);
      
      // Traiter les 10 premiers épisodes
      const results = [];
      let processed = 0;
      
      episodeMap.forEach((episode) => {
        if (processed >= 10) return;
        
        const linkEl = episode.linkEl;
        let thumbnail = '';
        let method = 'none';
        
        // Extraction principale
        let searchContainers = [];
        const specificContainer = linkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]');
        if (specificContainer) searchContainers.push({ type: 'specific', container: specificContainer });
        if (linkEl.parentElement) searchContainers.push({ type: 'parent', container: linkEl.parentElement });
        if (linkEl.parentElement?.parentElement) searchContainers.push({ type: 'grandparent', container: linkEl.parentElement.parentElement });
        
        // PRIORITÉ 1: Classes spécifiques
        for (const containerInfo of searchContainers) {
          if (thumbnail) break;
          
          const container = containerInfo.container;
          const thumbnailImages = container.querySelectorAll('img[class*="playable-thumbnail"], img[class*="content-image"]');
          
          if (thumbnailImages.length > 0) {
            const targetImg = thumbnailImages[thumbnailImages.length - 1];
            const src = targetImg.src || targetImg.getAttribute('data-src') || targetImg.getAttribute('data-lazy');
            
            if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
              thumbnail = src.trim();
              method = 'classe-specifique-' + containerInfo.type;
              break;
            }
          }
        }
        
        // PRIORITÉ 2: Images générales
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
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        // PRIORITÉ 3: Liens alternatifs
        if (!thumbnail && episode.alternativeLinks && episode.alternativeLinks.length > 0) {
          console.log('  🔄 Tentative ' + episode.alternativeLinks.length + ' liens alternatifs');
          
          for (const altLinkEl of episode.alternativeLinks) {
            if (thumbnail) break;
            
            const altContainers = [];
            const altSpecificContainer = altLinkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]');
            if (altSpecificContainer) altContainers.push({ type: 'alt-specific', container: altSpecificContainer });
            if (altLinkEl.parentElement) altContainers.push({ type: 'alt-parent', container: altLinkEl.parentElement });
            
            for (const containerInfo of altContainers) {
              if (thumbnail) break;
              
              const container = containerInfo.container;
              const thumbnailImages = container.querySelectorAll('img[class*="playable-thumbnail"], img[class*="content-image"]');
              
              if (thumbnailImages.length > 0) {
                const targetImg = thumbnailImages[thumbnailImages.length - 1];
                const src = targetImg.src || targetImg.getAttribute('data-src') || targetImg.getAttribute('data-lazy');
                
                if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                  thumbnail = src.trim();
                  method = 'alternatif-' + containerInfo.type;
                  break;
                }
              }
            }
          }
        }
        
        results.push({
          url: episode.href.substring(episode.href.lastIndexOf('/') + 1),
          text: episode.text.substring(0, 40),
          thumbnail: thumbnail,
          thumbnailId: thumbnail ? thumbnail.split('/').pop().split('.')[0] : 'NONE',
          method: method,
          alternativeLinksCount: episode.alternativeLinks.length
        });
        
        processed++;
      });
      
      return results;
    `);
    
    console.log('\n📺 RÉSULTATS EXTRACTION AMÉLIORÉE:');
    const uniqueThumbnails = new Set();
    
    enhancedResult.forEach((result, i) => {
      console.log(`${i+1}. "${result.text}"`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Thumbnail: ${result.thumbnailId} ${result.thumbnail ? '✅' : '❌'}`);
      console.log(`   Méthode: ${result.method} | Alternatifs: ${result.alternativeLinksCount}`);
      console.log('');
      
      if (result.thumbnail) {
        uniqueThumbnails.add(result.thumbnailId);
      }
    });
    
    const withThumbnails = enhancedResult.filter(r => r.thumbnail).length;
    const totalTested = enhancedResult.length;
    
    console.log(`📊 STATISTIQUES AMÉLIORÉES:`);
    console.log(`Épisodes testés: ${totalTested}`);
    console.log(`Avec thumbnails: ${withThumbnails}/${totalTested} (${((withThumbnails/totalTested)*100).toFixed(1)}%)`);
    console.log(`Thumbnails uniques: ${uniqueThumbnails.size}`);
    console.log(`Utilisation liens alternatifs: ${enhancedResult.filter(r => r.method.includes('alternatif')).length}`);
    
    if (withThumbnails >= totalTested * 0.9) {
      console.log('\n🎉 EXCELLENT: Taux très élevé (≥90%)!');
    } else if (withThumbnails >= totalTested * 0.7) {
      console.log('\n✅ BON: Taux élevé (≥70%)');
    } else if (withThumbnails >= totalTested * 0.5) {
      console.log('\n🟡 MOYEN: Amélioration nécessaire');
    } else {
      console.log('\n❌ FAIBLE: Problème à résoudre');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testEnhancedThumbnailExtraction().catch(console.error);