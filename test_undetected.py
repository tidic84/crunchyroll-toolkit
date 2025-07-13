#!/usr/bin/env python3
"""
Test direct avec undetected-chromedriver
"""

import undetected_chromedriver as uc
import time
import json
import sys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_undetected_crunchyroll(query="Fire Force"):
    print(f"🔧 Test undetected-chromedriver avec: {query}")
    
    # Configuration options
    options = uc.ChromeOptions()
    
    # Mode headless optionnel
    if '--headless' in sys.argv:
        options.add_argument('--headless')
        print("🔇 Mode headless")
    else:
        print("🖥️ Mode visible")
    
    # Arguments stealth
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--exclude-switches=enable-automation')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1366,768')
    
    driver = None
    try:
        # Créer le driver
        driver = uc.Chrome(options=options, version_main=None)
        print("✅ Driver créé avec succès")
        
        # Test de navigation
        search_url = f"https://www.crunchyroll.com/fr/search?q={query.replace(' ', '%20')}"
        print(f"🌐 Navigation vers: {search_url}")
        
        driver.get(search_url)
        
        # Attendre un peu
        time.sleep(5)
        
        # Récupérer les infos de base
        title = driver.title
        current_url = driver.current_url
        page_source = driver.page_source
        
        print(f"📄 Titre: '{title}'")
        print(f"🔗 URL: {current_url}")
        print(f"📏 Taille HTML: {len(page_source)}B")
        
        # Vérifier le challenge Cloudflare
        is_challenge = "Un instant" in title or "challenge" in page_source.lower() or "cloudflare" in page_source.lower()
        has_results = "search-item" in page_source or "series" in page_source
        
        print(f"🚨 Challenge détecté: {'OUI' if is_challenge else 'NON'}")
        print(f"📋 Résultats potentiels: {'OUI' if has_results else 'NON'}")
        
        # Sauvegarder pour debug
        with open(f'debug_undetected_{query.replace(" ", "_")}.html', 'w', encoding='utf-8') as f:
            f.write(page_source)
        print(f"💾 Page sauvegardée: debug_undetected_{query.replace(' ', '_')}.html")
        
        # Chercher des résultats
        results = []
        try:
            # Chercher les liens de séries
            series_links = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/series/"]')
            print(f"🔗 Liens série trouvés: {len(series_links)}")
            
            for i, link in enumerate(series_links[:5]):  # Maximum 5 premiers
                try:
                    href = link.get_attribute('href')
                    text = link.text.strip()
                    
                    if href and text and len(text) > 0:
                        results.append({
                            "title": text,
                            "url": href
                        })
                        print(f"  {i+1}. {text} -> {href}")
                        
                except Exception as e:
                    print(f"  ⚠️ Erreur lien {i}: {e}")
                    
        except Exception as e:
            print(f"⚠️ Erreur recherche liens: {e}")
        
        # Résultat final
        result = {
            "success": not is_challenge and len(results) > 0,
            "challenge_detected": is_challenge,
            "title": title,
            "url": current_url,
            "results_count": len(results),
            "results": results,
            "method": "undetected-chromedriver-python",
            "query": query
        }
        
        print("\n📋 RÉSULTAT:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        return result
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return {
            "success": False,
            "error": str(e),
            "method": "undetected-chromedriver-python",
            "query": query
        }
        
    finally:
        if driver:
            driver.quit()
            print("✅ Driver fermé")

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else "Fire Force"
    test_undetected_crunchyroll(query)