#!/usr/bin/env node

/**
 * Debug du bug de déduplication des thumbnails
 * Analyse pourquoi tous les épisodes ont le même thumbnail
 */

async function debugThumbnailBug() {
  try {
    console.log('🐛 Debug Thumbnail Bug - Analyse de la déduplication');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Test pour analyser la logique de déduplication
    const analysisResult = await driver.executeScript(`
      console.log('🔍 Analyse de la déduplication...');
      
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('Total liens trouvés:', allLinks.length);
      
      // Simuler la logique de déduplication du code original
      const episodeMap = new Map();
      const uniqueUrls = new Set();
      const uniqueThumbnails = new Set();
      
      allLinks.forEach((linkEl, index) => {
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        
        // Éviter musicvideos, movies, etc.
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) {
          return;
        }
        
        const text = linkEl.textContent?.trim() || '';
        uniqueUrls.add(href);
        
        // Recherche de thumbnail pour CHAQUE lien individuellement
        let thumbnail = '';
        const possibleContainers = [
          linkEl.closest('[class*="episode"]'),
          linkEl.closest('[class*="card"]'), 
          linkEl.closest('[class*="item"]'),
          linkEl.closest('[role="listitem"]'),
          linkEl.closest('[class*="playable"]'),
          linkEl.parentElement,
          linkEl.parentElement?.parentElement
        ].filter(Boolean);
        
        // Chercher 2ème picture
        for (const container of possibleContainers) {
          if (thumbnail) break;
          
          const pictures = container.querySelectorAll('picture');
          if (pictures.length >= 2) {
            const normalImg = pictures[1].querySelector('img');
            if (normalImg) {
              const src = normalImg.src || normalImg.getAttribute('data-src') || normalImg.getAttribute('data-lazy');
              if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                thumbnail = src;
                break;
              }
            }
          }
        }
        
        // Chercher toute image si pas de 2ème picture
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
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        if (thumbnail) {
          uniqueThumbnails.add(thumbnail);
        }
        
        // Logique de déduplication comme dans le code original
        const hasGoodTitle = text.length > 10 && 
                           (text.includes('E') || text.includes('-') || text.includes('Ep')) && 
                           !text.match(/^\\d+m$/) && 
                           !text.match(/^\\d+$/) &&
                           !text.toLowerCase().includes('lecture') &&
                           text !== 'NO_TEXT';
        
        const hasBetterTitle = hasGoodTitle && text.length > 15;
        
        // LE PROBLÈME EST ICI: on remplace l'entrée entière dans la Map
        // mais on peut perdre le thumbnail unique de chaque lien!
        if (!episodeMap.has(href) || 
            (hasBetterTitle && !episodeMap.get(href)?.hasGoodTitle) ||
            (hasGoodTitle && episodeMap.get(href)?.text === 'NO_TEXT')) {
          episodeMap.set(href, {
            linkEl: linkEl,
            text: text,
            href: href,
            index: index,
            hasGoodTitle: hasGoodTitle,
            titleQuality: hasBetterTitle ? 3 : (hasGoodTitle ? 2 : 1),
            // PROBLÈME: le thumbnail est attaché à l'entrée de la Map
            // Si on remplace l'entrée, on perd le thumbnail précédent
            thumbnail: thumbnail
          });
        }
      });
      
      return {
        totalLinks: allLinks.length,
        uniqueUrls: uniqueUrls.size,
        uniqueThumbnails: uniqueThumbnails.size,
        episodeMapSize: episodeMap.size,
        episodeMapEntries: Array.from(episodeMap.entries()).slice(0, 5).map(([url, data]) => ({
          url: url.substring(url.lastIndexOf('/') + 1),
          text: data.text.substring(0, 30),
          thumbnail: data.thumbnail ? data.thumbnail.substring(data.thumbnail.lastIndexOf('/') + 1) : 'NONE'
        }))
      };
    `);
    
    console.log('\n📊 ANALYSE DÉDUPLICATION:');
    console.log('Total liens trouvés:', analysisResult.totalLinks);
    console.log('URLs uniques:', analysisResult.uniqueUrls);
    console.log('Thumbnails uniques trouvés:', analysisResult.uniqueThumbnails);
    console.log('Entrées dans episodeMap:', analysisResult.episodeMapSize);
    
    console.log('\n🔍 ÉCHANTILLON episodeMap:');
    analysisResult.episodeMapEntries.forEach((entry, i) => {
      console.log(`${i+1}. ${entry.url} -> "${entry.text}" | Thumb: ${entry.thumbnail}`);
    });
    
    if (analysisResult.uniqueThumbnails > analysisResult.uniqueUrls) {
      console.log('\n✅ DIAGNOSTIC: Il y a plus de thumbnails uniques que d\'URLs uniques');
      console.log('   -> Le problème est bien dans la logique de déduplication');
      console.log('   -> Plusieurs liens différents pointent vers le même épisode mais ont des thumbnails différents');
      console.log('   -> La déduplication ne preserve que le dernier thumbnail trouvé');
    } else if (analysisResult.uniqueThumbnails === 1) {
      console.log('\n❌ DIAGNOSTIC: Un seul thumbnail unique trouvé!');
      console.log('   -> Soit la recherche de thumbnails ne fonctionne pas');
      console.log('   -> Soit tous les épisodes ont vraiment le même thumbnail (improbable)');
    } else {
      console.log('\n🔍 DIAGNOSTIC: Problème autre à investiguer');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

debugThumbnailBug().catch(console.error);