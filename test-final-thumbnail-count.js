#!/usr/bin/env node

/**
 * Test final rapide - vérifier le nombre de thumbnails extraits par le scraper amélioré
 */

async function testFinalThumbnailCount() {
  try {
    console.log('🏁 Test Final - Comptage thumbnails scraper amélioré');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 20000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const driver = await scraper.browserManager.getDriver();
    
    // Extraire quelques épisodes seulement avec le scraper amélioré
    const episodeResult = await driver.executeScript(`
      console.log('🔍 Extraction avec scraper amélioré...');
      
      // Utiliser exactement la même logique que dans extractAllEpisodesSimple
      const episodeList = [];
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🔍 Total éléments potentiels: ' + allLinks.length);
      
      const episodeMap = new Map();
      
      allLinks.forEach((linkEl, index) => {
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) {
          return;
        }
        
        const text = linkEl.textContent?.trim() || '';
        const hasGoodTitle = text.length > 10 && 
                           (text.includes('E') || text.includes('-') || text.includes('Ep')) && 
                           !text.match(/^\\d+m$/) && 
                           !text.match(/^\\d+$/) &&
                           !text.toLowerCase().includes('lecture') &&
                           text !== 'NO_TEXT';
        
        const hasBetterTitle = hasGoodTitle && text.length > 15;
        
        // NOUVELLE LOGIQUE DE DÉDUPLICATION
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
          
          // Préserver le linkEl avec thumbnail
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
      
      console.log('🔍 Episodes uniques détectés: ' + episodeMap.size);
      
      // Traiter seulement les 15 premiers pour un test rapide
      let processed = 0;
      episodeMap.forEach((episode) => {
        if (processed >= 15) return;
        
        const linkEl = episode.linkEl;
        const href = episode.href;
        let title = episode.text;
        let thumbnail = '';
        let episodeNumber = processed + 1;
        
        // Nettoyer le titre
        if (title) {
          title = title.replace(/^S\\d+\\s*E\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Episode\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Ep\\s*\\d+\\s*[-–]\\s*/i, '').trim();
        }
        
        // EXTRACTION THUMBNAIL AMÉLIORÉE
        let searchContainers = [];
        const specificContainer = linkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"], [class*="playable"]');
        if (specificContainer) searchContainers.push({ type: 'specific', container: specificContainer });
        if (linkEl.parentElement) searchContainers.push({ type: 'parent', container: linkEl.parentElement });
        if (linkEl.parentElement?.parentElement) searchContainers.push({ type: 'grandparent', container: linkEl.parentElement.parentElement });
        
        // PRIORITÉ 1: Classes spécifiques Crunchyroll
        for (const containerInfo of searchContainers) {
          if (thumbnail) break;
          
          const container = containerInfo.container;
          const thumbnailImages = container.querySelectorAll('img[class*="playable-thumbnail"], img[class*="content-image"]');
          
          if (thumbnailImages.length > 0) {
            const targetImg = thumbnailImages[thumbnailImages.length - 1];
            const src = targetImg.src || targetImg.getAttribute('data-src') || targetImg.getAttribute('data-lazy');
            
            if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
              thumbnail = src.trim();
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
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        // PRIORITÉ 3: Liens alternatifs
        if (!thumbnail && episode.alternativeLinks && episode.alternativeLinks.length > 0) {
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
                  break;
                }
              }
            }
          }
        }
        
        if (!title || title.length < 3) {
          title = 'Episode ' + episodeNumber;
        }
        
        episodeList.push({
          id: href.split('/watch/')[1]?.split('/')[0] || 'ep' + episodeNumber,
          title: title,
          episodeNumber: episodeNumber,
          seasonNumber: 1,
          thumbnail: thumbnail || undefined,
          duration: '23m',
          url: href
        });
        
        processed++;
      });
      
      return episodeList;
    `, 'GYQWNXPZY');
    
    console.log('\n📺 ÉCHANTILLON ÉPISODES AMÉLIORÉS:');
    const uniqueThumbnails = new Set();
    
    episodeResult.forEach((ep, i) => {
      const thumbId = ep.thumbnail ? ep.thumbnail.split('/').pop().split('.')[0] : 'NONE';
      console.log(`${i+1}. "${ep.title}"`);
      console.log(`   Thumbnail: ${thumbId} ${ep.thumbnail ? '✅' : '❌'}`);
      
      if (ep.thumbnail) {
        uniqueThumbnails.add(thumbId);
      }
    });
    
    const withThumbnails = episodeResult.filter(ep => ep.thumbnail).length;
    const totalTested = episodeResult.length;
    
    console.log(`\n📊 RÉSULTATS FINAUX:`);
    console.log(`Épisodes testés: ${totalTested}`);
    console.log(`Avec thumbnails: ${withThumbnails}/${totalTested} (${((withThumbnails/totalTested)*100).toFixed(1)}%)`);
    console.log(`Thumbnails uniques: ${uniqueThumbnails.size}`);
    
    if (withThumbnails >= totalTested * 0.9) {
      console.log('\n🎉 OBJECTIF ATTEINT: Taux excellent (≥90%)!');
      console.log('✅ Le scraper peut maintenant récupérer les thumbnails de chaque épisode!');
    } else if (withThumbnails >= totalTested * 0.7) {
      console.log('\n✅ PROCHE DE L\'OBJECTIF: Bon taux (≥70%)');
    } else {
      console.log('\n❌ OBJECTIF NON ATTEINT: Taux encore insuffisant');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testFinalThumbnailCount().catch(console.error);