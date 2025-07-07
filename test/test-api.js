// test/test-api.js - Script pour tester l'API FlopMap
const fetch = require('node-fetch');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';

async function testApi() {
  console.log('🧪 Test de l\'API FlopMap\n');

  // Test 1: Health check
  console.log('1️⃣ Test de santé de l\'API...');
  try {
    const response = await fetch(`${BASE_URL}/api/search/health`);
    const data = await response.json();
    console.log('✅ Health check:', data.message);
  } catch (error) {
    console.error('❌ Health check échoué:', error.message);
    return;
  }

  // Test 2: Recherche par ville
  console.log('\n2️⃣ Test de recherche par ville...');
  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Paris, France',
        radius: 2000,
        maxResults: 5
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Recherche réussie:');
      console.log(`   - Localisation: ${data.searchQuery.formatted}`);
      console.log(`   - Établissements trouvés: ${data.results.displayCount}/${data.results.totalFound}`);
      console.log(`   - Temps d'exécution: ${data.executionTime}ms`);
      
      if (data.results.places.length > 0) {
        const firstPlace = data.results.places[0];
        console.log(`   - Premier résultat: ${firstPlace.name} (${firstPlace.rating}⭐)`);
      }
    } else {
      console.error('❌ Recherche échouée:', data.error);
    }
  } catch (error) {
    console.error('❌ Erreur de recherche:', error.message);
  }

  // Test 3: Recherche par code postal
  console.log('\n3️⃣ Test de recherche par code postal...');
  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '75001',
        radius: 1000,
        maxResults: 3
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Recherche par code postal réussie:');
      console.log(`   - Type détecté: ${data.searchQuery.type}`);
      console.log(`   - Établissements: ${data.results.displayCount}`);
    } else {
      console.error('❌ Recherche par code postal échouée:', data.error);
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  // Test 4: Recherche avec coordonnées
  console.log('\n4️⃣ Test de recherche avec coordonnées GPS...');
  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '48.8566, 2.3522',
        radius: 1500,
        maxResults: 3,
        placeTypes: ['restaurant', 'cafe']
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Recherche par coordonnées réussie:');
      console.log(`   - Coordonnées: ${data.searchQuery.coordinates.lat}, ${data.searchQuery.coordinates.lng}`);
      console.log(`   - Établissements: ${data.results.displayCount}`);
    } else {
      console.error('❌ Recherche par coordonnées échouée:', data.error);
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  // Test 5: Suggestions
  console.log('\n5️⃣ Test des suggestions...');
  try {
    const response = await fetch(`${BASE_URL}/api/search/suggestions?query=Par`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Suggestions récupérées:');
      data.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
    } else {
      console.error('❌ Suggestions échouées:', data.error);
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  // Test 6: Validation des erreurs
  console.log('\n6️⃣ Test de validation des erreurs...');
  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '', // Requête vide pour tester la validation
        radius: 'invalid'
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      console.log('✅ Validation des erreurs fonctionne:');
      console.log(`   - Erreur: ${data.error}`);
      if (data.details) {
        data.details.forEach(detail => console.log(`   - ${detail}`));
      }
    } else {
      console.error('❌ La validation devrait échouer');
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  console.log('\n🎉 Tests terminés !');
}

// Vérifier les variables d'environnement
if (!process.env.GOOGLE_MAPS_API_KEY) {
  console.error('❌ GOOGLE_MAPS_API_KEY manquante dans .env');
  console.log('💡 Créez un fichier .env avec votre clé API Google Maps');
  process.exit(1);
}

// Lancer les tests
testApi().catch(console.error);