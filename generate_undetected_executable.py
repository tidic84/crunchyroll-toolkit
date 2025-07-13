#!/usr/bin/env python3
"""
Script pour générer l'exécutable undetected-chromedriver
selon la méthode ZenRows
"""

import undetected_chromedriver as uc
import os
import shutil
import sys

def generate_undetected_executable():
    print("🔧 Génération de l'exécutable undetected-chromedriver...")
    
    try:
        # Créer une instance temporaire pour forcer le téléchargement/patch
        print("📥 Téléchargement et patch du ChromeDriver...")
        driver = uc.Chrome(version_main=None)
        
        # Récupérer le chemin de l'exécutable créé
        service = driver.service
        executable_path = service.path
        
        print(f"🔍 ChromeDriver trouvé à: {executable_path}")
        
        # Fermer le driver
        driver.quit()
        
        # Copier l'exécutable vers un endroit accessible
        local_path = "./undetected_chromedriver_executable"
        if os.path.exists(executable_path):
            shutil.copy2(executable_path, local_path)
            print(f"✅ Exécutable copié vers: {local_path}")
            
            # Rendre exécutable
            os.chmod(local_path, 0o755)
            print("✅ Permissions exécutable définies")
            
            # Afficher les infos
            print(f"📋 Chemin final: {os.path.abspath(local_path)}")
            print("🎯 Utilisez ce chemin dans votre code Node.js Selenium")
            
            return os.path.abspath(local_path)
        else:
            print(f"❌ Exécutable non trouvé à {executable_path}")
            return None
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return None

if __name__ == "__main__":
    path = generate_undetected_executable()
    if path:
        print(f"\n🚀 Succès! Exécutable généré: {path}")
    else:
        print("\n❌ Échec de la génération")
        sys.exit(1)