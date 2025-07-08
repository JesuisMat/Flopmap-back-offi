// services/places.service.js
const fetch = require('node-fetch');

class PlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY non définie dans les variables d\'environnement');
    }
  }

  /**
   * Recherche les établissements les moins bien notés dans une zone
   */
  async searchWorstRatedPlaces(params) {
    const { coordinates, radius = 5000, maxResults = 10, placeTypes = [] } = params;
    
    try {
      console.log(`🔍 Recherche dans un rayon de ${radius}m autour de ${coordinates.lat}, ${coordinates.lng}`);
      
      // Étape 1: Recherche générale dans la zone
      const nearbyPlaces = await this.searchNearbyPlaces({
        location: coordinates,
        radius,
        types: placeTypes
      });

      if (!nearbyPlaces || nearbyPlaces.length === 0) {
        console.log('❌ Aucun établissement trouvé dans la recherche nearby');
        return {
          success: true,
          places: [],
          totalFound: 0,
          message: 'Aucun établissement trouvé dans cette zone'
        };
      }

      console.log(`📍 ${nearbyPlaces.length} établissements trouvés avant récupération des détails`);

      // Étape 2: Récupération des détails avec avis
      const placesWithDetails = await this.getPlacesDetails(nearbyPlaces);
      console.log(`📋 ${placesWithDetails.length} établissements avec détails récupérés`);

      // Étape 3: Filtrage et tri des moins bien notés
      const worstRated = this.filterAndSortWorstRated(placesWithDetails, maxResults);

      return {
        success: true,
        places: worstRated,
        totalFound: nearbyPlaces.length,
        searchParams: params
      };

    } catch (error) {
      console.error('❌ Erreur dans searchWorstRatedPlaces:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Recherche des établissements à proximité
   */
  async searchNearbyPlaces(params) {
    const { location, radius, types = [] } = params;
    const allPlaces = [];

    // Types d'établissements par défaut
    const defaultTypes = [
      'restaurant', 'cafe', 'bar', 'hotel', 'store',
      'gas_station', 'pharmacy', 'bank', 'beauty_salon', 'hospital'
    ];

    const searchTypes = types.length > 0 ? types : defaultTypes;

    // Recherche par type pour avoir plus de résultats variés
    for (const type of searchTypes.slice(0, 6)) { // Limite à 6 types pour éviter trop de requêtes
      try {
        const url = `${this.baseUrl}/nearbysearch/json?` +
          `location=${location.lat},${location.lng}&` +
          `radius=${radius}&` +
          `type=${type}&` +
          `key=${this.apiKey}`;

        console.log(`🔍 Recherche ${type}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`❌ Erreur HTTP ${response.status} pour ${type}`);
          continue;
        }

        const data = await response.json();

        if (data.status === 'OVER_QUERY_LIMIT') {
          console.error('⚠️ Limite de requêtes API atteinte');
          break;
        }

        if (data.status === 'OK' && data.results) {
          console.log(`   └─ ${data.results.length} résultats trouvés pour ${type}`);
          
          // Éviter les doublons
          let addedCount = 0;
          data.results.forEach(place => {
            if (!allPlaces.find(p => p.place_id === place.place_id)) {
              allPlaces.push({
                ...place,
                search_type: type // Garder trace du type de recherche
              });
              addedCount++;
            }
          });
          console.log(`   └─ ${addedCount} nouveaux établissements ajoutés`);
        } else {
          console.log(`   └─ Aucun résultat pour ${type}: ${data.status}`);
          if (data.error_message) {
            console.log(`   └─ Message d'erreur: ${data.error_message}`);
          }
        }

        // Pause pour respecter les rate limits
        await this.sleep(200);

      } catch (error) {
        console.error(`❌ Erreur recherche ${type}:`, error.message);
        continue;
      }
    }

    console.log(`🏪 Total unique d'établissements trouvés: ${allPlaces.length}`);
    return allPlaces;
  }

  /**
   * Récupère les détails complets des établissements
   */
  async getPlacesDetails(places) {
    const placesWithDetails = [];
    const batchSize = 5; // Traiter par batches pour éviter les rate limits

    console.log(`📋 Récupération des détails pour ${places.length} établissements...`);

    for (let i = 0; i < places.length; i += batchSize) {
      const batch = places.slice(i, i + batchSize);
      console.log(`   📦 Batch ${Math.floor(i/batchSize) + 1}: ${batch.length} établissements`);
      
      const batchPromises = batch.map(place => this.getPlaceDetails(place.place_id));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        
        let successCount = 0;
        batchResults.forEach((details, index) => {
          if (details.success) {
            placesWithDetails.push({
              ...batch[index],
              details: details.data
            });
            successCount++;
          } else {
            console.log(`   ❌ Échec détails pour ${batch[index].name}: ${details.error}`);
          }
        });
        
        console.log(`   ✅ ${successCount}/${batch.length} détails récupérés`);

        // Pause entre les batches
        if (i + batchSize < places.length) {
          await this.sleep(500);
        }

      } catch (error) {
        console.error(`❌ Erreur batch ${i}-${i + batchSize}:`, error);
        continue;
      }
    }

    return placesWithDetails;
  }

  /**
   * Récupère les détails d'un établissement spécifique
   */
  async getPlaceDetails(placeId) {
    const fields = [
      'place_id', 'name', 'rating', 'user_ratings_total',
      'reviews', 'formatted_address', 'geometry',
      'photos', 'website', 'formatted_phone_number',
      'opening_hours', 'price_level', 'types'
    ].join(',');

    const url = `${this.baseUrl}/details/json?` +
      `place_id=${placeId}&` +
      `fields=${fields}&` +
      `language=fr&` +
      `key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK') {
        return {
          success: true,
          data: data.result
        };
      } else {
        return {
          success: false,
          error: data.status
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Filtre et trie les établissements les moins bien notés
   */
  filterAndSortWorstRated(places, maxResults) {
    console.log(`🔍 Filtrage de ${places.length} établissements...`);
    
    // Debug: voir ce qu'on a avant filtrage
    places.forEach((place, index) => {
      const rating = place.details?.rating;
      const reviewCount = place.details?.user_ratings_total || 0;
      const name = place.details?.name || place.name;
      console.log(`   ${index + 1}. ${name}: ${rating ? rating + '⭐' : 'Pas de note'} (${reviewCount} avis)`);
    });
    
    const filtered = places
      // Filtrer ceux qui ont une note ET suffisamment d'avis
      .filter(place => {
        const rating = place.details?.rating;
        const reviewCount = place.details?.user_ratings_total || 0;
        
        // Conditions plus souples pour voir des résultats de démo
        const hasRating = rating !== undefined && rating !== null;
        const hasMinReviews = reviewCount >= 1; // Changé de 3 à 1 pour voir plus de résultats
        
        return hasRating && hasMinReviews;
      })
      // Trier par note croissante (les pires en premier)
      .sort((a, b) => {
        const ratingA = a.details.rating || 5;
        const ratingB = b.details.rating || 5;
        
        // Si même note, prioriser ceux avec plus d'avis (plus fiable)
        if (Math.abs(ratingA - ratingB) < 0.1) {
          return (b.details.user_ratings_total || 0) - (a.details.user_ratings_total || 0);
        }
        
        return ratingA - ratingB;
      })
      // Prendre les N premiers
      .slice(0, maxResults)
      // Formater pour l'affichage
      .map(place => this.formatPlaceForDisplay(place));
      
    console.log(`✅ ${filtered.length} établissements après filtrage`);
    
    if (filtered.length > 0) {
      console.log('🏆 Top des pires établissements:');
      filtered.forEach((place, index) => {
        console.log(`   ${index + 1}. ${place.name}: ${place.rating}⭐ (${place.reviewCount} avis)`);
      });
    }
    
    return filtered;
  }

  /**
   * Formate un établissement pour l'affichage
   */
  formatPlaceForDisplay(place) {
    const details = place.details || {};
    
    return {
      id: place.place_id,
      name: details.name || place.name,
      rating: details.rating,
      reviewCount: details.user_ratings_total || 0,
      address: details.formatted_address,
      location: {
        lat: details.geometry?.location?.lat || place.geometry?.location?.lat,
        lng: details.geometry?.location?.lng || place.geometry?.location?.lng
      },
      types: details.types || place.types || [],
      priceLevel: details.price_level,
      isOpen: details.opening_hours?.open_now,
      photos: this.formatPhotos(details.photos),
      website: details.website,
      phoneNumber: details.formatted_phone_number,
      crunchyReviews: this.extractCrunchyReviews(details.reviews),
      searchType: place.search_type // Type de recherche qui a trouvé cet établissement
    };
  }

  /**
   * Extrait les avis les plus "croustillants"
   */
  extractCrunchyReviews(reviews = []) {
  if (!reviews || reviews.length === 0) return [];

  return reviews
    // Prendre les avis jusqu'à 3 étoiles (plus de contenu)
    .filter(review => review.rating <= 3)
    // Trier par pertinence (score de "croustillant")
    .sort((a, b) => {
      const scoreA = this.calculateCrunchinessScore(a);
      const scoreB = this.calculateCrunchinessScore(b);
      return scoreB - scoreA;
    })
    // Prendre les 5 meilleurs (au lieu de 3)
    .slice(0, 5)
    // Anonymiser et formater
    .map(review => ({
      rating: review.rating,
      text: this.anonymizeReview(review.text),
      timeAgo: this.formatTimeAgo(review.time),
      useful: review.useful || false,
      crunchinessScore: this.calculateCrunchinessScore(review)
    }));
}

/**
 * Calcule le score de "croustillant" d'un avis - VERSION AMÉLIORÉE
 */
calculateCrunchinessScore(review) {
  let score = 0;
  const text = (review.text || '').toLowerCase();
  
  // Bonus inversé pour la note (1 étoile = 50 points, 2 = 40, 3 = 30)
  score += (4 - review.rating) * 25;
  
  // Bonus pour la longueur (plus c'est long, plus c'est juteux)
  score += Math.min(text.length / 10, 50);
  
  // Mots-clés négatifs français ÉTENDUS
  const negativeKeywords = [
    // Mots forts existants
    'horrible', 'atroce', 'dégueulasse', 'sale', 'répugnant',
    'pire', 'catastrophe', 'scandale', 'fuyez', 'évitez',
    'jamais', 'inadmissible', 'inacceptable', 'honteux',
    'dégoûtant', 'immonde', 'pourri', 'nul', 'minable',
    'catastrophique', 'lamentable', 'pitoyable', 'abject',
    
    // NOUVEAUX mots-clés courants
    'arnaque', 'voleur', 'escroquerie', 'piège', 'attrape-touriste',
    'décevant', 'déception', 'bof', 'pas terrible', 'mouais',
    'à fuir', 'à éviter', 'passez votre chemin', 'allez ailleurs',
    'infect', 'infâme', 'ignoble', 'insipide', 'fade',
    'froid', 'réchauffé', 'surgelé', 'industriel', 'caoutchouc',
    'malade', 'intoxication', 'vomi', 'gerbe', 'diarrhée',
    'malpoli', 'désagréable', 'odieux', 'méprisant', 'hautain',
    'attente interminable', 'oublié', 'ignoré', 'transparent',
    'cher pour rien', 'prix exorbitant', 'trop cher', 'pas donné'
  ];
  
  // Expressions négatives (bonus plus élevé)
  const negativeExpressions = [
    'ne vaut pas', 'perte de temps', 'perte d\'argent',
    'plus jamais', 'première et dernière fois',
    'je déconseille', 'je ne recommande pas',
    'grosse déception', 'très déçu', 'extrêmement déçu',
    'rapport qualité prix', 'qualité prix médiocre',
    'pas frais', 'pas bon', 'pas propre',
    'service déplorable', 'accueil glacial'
  ];
  
  // Calcul du score pour mots simples
  negativeKeywords.forEach(keyword => {
    const matches = (text.match(new RegExp(keyword, 'gi')) || []).length;
    score += matches * 15;
  });
  
  // Calcul du score pour expressions (bonus plus élevé)
  negativeExpressions.forEach(expr => {
    if (text.includes(expr)) {
      score += 30;
    }
  });
  
  // Bonus pour les mots d'intensité
  const intensityWords = [
    'très', 'extrêmement', 'complètement', 'totalement',
    'vraiment', 'absolument', 'particulièrement', 'trop',
    'beaucoup trop', 'ultra', 'super', 'hyper', 'méga'
  ];
  
  intensityWords.forEach(word => {
    const matches = (text.match(new RegExp(word, 'gi')) || []).length;
    score += matches * 8;
  });
  
  // Bonus pour les émojis négatifs
  const negativeEmojis = ['😠', '😡', '🤮', '💩', '👎', '😤', '🙄', '😒', '😑', '🤢', '😖', '😣'];
  negativeEmojis.forEach(emoji => {
    if (text.includes(emoji)) {
      score += 20;
    }
  });
  
  // Bonus pour les majuscules (cris)
  const capsWords = text.match(/[A-Z]{3,}/g) || [];
  score += capsWords.length * 10;
  
  // Bonus pour les points d'exclamation multiples
  const exclamationMatches = text.match(/!{2,}/g) || [];
  score += exclamationMatches.length * 15;
  
  // Bonus pour les points de suspension (dépit)
  const suspensionMatches = text.match(/\.{3,}/g) || [];
  score += suspensionMatches.length * 5;
  
  // Bonus si l'avis mentionne des problèmes de santé
  const healthKeywords = ['malade', 'vomi', 'hôpital', 'médecin', 'intoxication', 'allergie'];
  healthKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      score += 40;
    }
  });
  
  // Bonus si mention de remboursement/litige
  const disputeKeywords = ['remboursement', 'litige', 'plainte', 'avocat', 'tribunal', 'police'];
  disputeKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      score += 35;
    }
  });
  
  return score;
}

  /**
   * Anonymise un avis en supprimant les noms
   */
  anonymizeReview(text) {
    if (!text) return '';
    
    // Patterns pour détecter les noms
    const namePatterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Prénom Nom
      /\bM\.\s+[A-Z][a-z]+\b/g, // M. Nom
      /\bMme\s+[A-Z][a-z]+\b/g, // Mme Nom
      /\bMr\s+[A-Z][a-z]+\b/g, // Mr Nom
      /\bMonsieur\s+[A-Z][a-z]+\b/g, // Monsieur Nom
      /\bMadame\s+[A-Z][a-z]+\b/g, // Madame Nom
    ];

    let anonymized = text;
    
    namePatterns.forEach(pattern => {
      anonymized = anonymized.replace(pattern, '[Nom supprimé]');
    });

    // Supprimer les numéros de téléphone
    anonymized = anonymized.replace(/\b\d{2}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{2}[.\s]?\d{2}\b/g, '[Téléphone supprimé]');
    
    // Supprimer les emails
    anonymized = anonymized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[Email supprimé]');

    return anonymized;
  }

  /**
   * Formate les photos d'un établissement
   */
  formatPhotos(photos = []) {
    if (!photos || photos.length === 0) return [];
    
    return photos.slice(0, 3).map(photo => ({
      url: `${this.baseUrl}/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${this.apiKey}`,
      thumbnailUrl: `${this.baseUrl}/photo?maxwidth=150&photoreference=${photo.photo_reference}&key=${this.apiKey}`,
      width: photo.width,
      height: photo.height,
      attributions: photo.html_attributions
    }));
  }

  /**
   * Formate le temps relatif
   */
  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Date inconnue';
    
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 3600) return 'Il y a moins d\'1h';
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} jours`;
    if (diff < 2592000) return `Il y a ${Math.floor(diff / 604800)} semaines`;
    if (diff < 31536000) return `Il y a ${Math.floor(diff / 2592000)} mois`;
    return `Il y a ${Math.floor(diff / 31536000)} ans`;
  }

  /**
   * Pause pour respecter les rate limits
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calcule la distance entre deux coordonnées (en mètres)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convertit les degrés en radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Teste la connexion à l'API Google Places
   */
  async testApiConnection() {
    try {
      const url = `${this.baseUrl}/nearbysearch/json?` +
        `location=48.8566,2.3522&` +
        `radius=1000&` +
        `type=restaurant&` +
        `key=${this.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        return {
          success: true,
          message: 'Connexion API Places OK',
          resultsCount: data.results.length
        };
      } else {
        return {
          success: false,
          message: `Erreur API: ${data.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erreur de connexion: ${error.message}`
      };
    }
  }

  /**
   * Obtient les statistiques d'utilisation pour monitoring
   */
  getUsageStats() {
    return {
      timestamp: new Date().toISOString(),
      apiEndpoint: this.baseUrl,
      hasApiKey: !!this.apiKey,
      keyPreview: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'Non définie'
    };
  }
}

module.exports = PlacesService;