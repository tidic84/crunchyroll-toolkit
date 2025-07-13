#!/usr/bin/env python3
"""
Helper Python script pour undetected-chromedriver
Démarre un serveur WebDriver qui peut être utilisé par Node.js
"""

import undetected_chromedriver as uc
import time
import sys
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.chrome.service import Service
import signal
import json

def create_undetected_driver():
    """Crée une instance d'undetected ChromeDriver"""
    print("🔧 Initialisation undetected-chromedriver Python...")
    
    # Options pour undetected-chromedriver
    options = uc.ChromeOptions()
    
    # Arguments stealth similaires à ceux utilisés dans le code
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--exclude-switches=enable-automation')
    options.add_argument('--disable-extensions')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-plugins-discovery')
    options.add_argument('--disable-features=VizDisplayCompositor')
    options.add_argument('--no-first-run')
    options.add_argument('--no-service-autorun')
    options.add_argument('--no-default-browser-check')
    options.add_argument('--disable-default-apps')
    options.add_argument('--disable-component-update')
    options.add_argument('--disable-web-security')
    options.add_argument('--disable-site-isolation-trials')
    options.add_argument('--disable-features=TranslateUI,BlinkGenPropertyTrees')
    options.add_argument('--disable-ipc-flooding-protection')
    options.add_argument('--memory-pressure-off')
    options.add_argument('--disable-back-forward-cache')
    options.add_argument('--disable-backgrounding-occluded-windows')
    options.add_argument('--disable-renderer-backgrounding')
    options.add_argument('--disable-background-timer-throttling')
    options.add_argument('--disable-gpu-sandbox')
    options.add_argument('--disable-software-rasterizer')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1366,768')
    options.add_argument('--disable-infobars')
    options.add_argument('--disable-notifications')
    options.add_argument('--aggressive-cache-discard')
    options.add_argument('--disable-domain-reliability')
    options.add_argument('--disable-background-networking')
    options.add_argument('--disable-automation')
    options.add_argument('--disable-save-password-bubble')
    options.add_argument('--disable-single-click-autofill')
    
    # Mode headless optionnel
    if len(sys.argv) > 1 and sys.argv[1] == '--headless':
        options.add_argument('--headless')
        print("🔇 Mode headless activé")
    else:
        print("🖥️ Mode visible activé")
    
    # Créer le driver undetected
    try:
        driver = uc.Chrome(options=options, version_main=None)
        print("✅ Undetected ChromeDriver démarré avec succès")
        
        # Afficher les infos de connexion
        driver_url = getattr(driver.command_executor, '_url', None) or getattr(driver.command_executor, 'url', f'http://localhost:{driver.command_executor._remote_server_addr[1] if hasattr(driver.command_executor, "_remote_server_addr") else "4444"}')
        print(f"🌐 Driver URL: {driver_url}")
        print(f"📋 Session ID: {driver.session_id}")
        
        # Exporter les infos pour Node.js
        connection_info = {
            "command_executor_url": driver_url,
            "session_id": driver.session_id,
            "capabilities": driver.capabilities
        }
        
        with open('driver_connection.json', 'w') as f:
            json.dump(connection_info, f, indent=2)
        
        print("📁 Infos de connexion sauvegardées dans driver_connection.json")
        
        return driver
        
    except Exception as e:
        print(f"❌ Erreur lors de la création du driver: {e}")
        return None

def signal_handler(sig, frame):
    """Gestionnaire pour fermer proprement le driver"""
    print("\n🛑 Arrêt du driver...")
    if 'driver' in globals():
        driver.quit()
    sys.exit(0)

if __name__ == "__main__":
    # Configurer le gestionnaire de signal
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Créer le driver
    driver = create_undetected_driver()
    
    if driver:
        print("🚀 Driver prêt ! Utilisez Ctrl+C pour arrêter.")
        print("💡 Vous pouvez maintenant vous connecter depuis Node.js")
        
        try:
            # Garder le driver en vie
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Arrêt demandé...")
        finally:
            driver.quit()
            print("✅ Driver fermé proprement")
    else:
        print("❌ Impossible de démarrer le driver")
        sys.exit(1)