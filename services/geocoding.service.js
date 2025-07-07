// services/geocoding.service.js
const fetch = require('node-fetch');

class GeocodingService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY non définie dans les variables d\'environnement');
    }
  }

  /**
   * Détecte le type de recherche géographique
   */
  detectLocationType(query) {
    const patterns = {
      // Codes postaux français (75016, 13001, etc.)
      postalCodeFR: /^[0-9]{5}$/,
      // Codes postaux canadiens (H3T W5, H3TW5)
      postalCodeCA: /^[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]$/i,
      // Codes postaux américains (90210, 90210-1234)
      postalCodeUS: /^[0-9]{5}(-[0-9]{4})?$/,
      // Codes postaux britanniques (SW1A 1AA, SW1A1AA)
      postalCodeUK: /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i,
      // Coordonnées GPS (48.8566, 2.3522)
      coordinates: /^-?[0-9]+\.?[0-9]*,\s?-?[0-9]+\.?[0-9]*$/,
      // Ville + Pays (Paris, France)
      cityCountry: /^[^,]+,\s?[^,]+$/
    };

    const trimmed = query.trim();

    // Test des patterns dans l'ordre de spécificité
    if (patterns.coordinates.test(trimmed)) {
      const [lat, lng] = trimmed.split(',').map(coord => parseFloat(coord.trim()));
      return {
        type: 'coordinates',
        data: { lat, lng },
        formatted: `${lat}, ${lng}`,
        country: null
      };
    }

    if (patterns.postalCodeFR.test(trimmed)) {
      return {
        type: 'postal_code',
        country: 'FR',
        data: trimmed,
        formatted: `${trimmed}, France`
      };
    }

    if (patterns.postalCodeCA.test(trimmed)) {
      return {
        type: 'postal_code',
        country: 'CA',
        data: trimmed.toUpperCase().replace(/\s/g, ''),
        formatted: `${trimmed.toUpperCase()}, Canada`
      };
    }

    if (patterns.postalCodeUS.test(trimmed)) {
      return {
        type: 'postal_code',
        country: 'US',
        data: trimmed,
        formatted: `${trimmed}, USA`
      };
    }

    if (patterns.postalCodeUK.test(trimmed)) {
      return {
        type: 'postal_code',
        country: 'UK',
        data: trimmed.toUpperCase(),
        formatted: `${trimmed.toUpperCase()}, UK`
      };
    }

    if (patterns.cityCountry.test(trimmed)) {
      return {
        type: 'city_country',
        data: trimmed,
        formatted: trimmed,
        country: null
      };
    }

    // Par défaut, considérer comme une ville
    return {
      type: 'city',
      data: trimmed,
      formatted: trimmed,
      country: null
    };
  }

  /**
   * Geocode une adresse via Google Maps API
   */
  async geocodeAddress(address) {
    try {
      const url = `${this.baseUrl}?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      
      console.log(`🌍 Géocodage de: ${address}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OVER_QUERY_LIMIT') {
        throw new Error('OVER_QUERY_LIMIT: Limite de requêtes API atteinte');
      }

      if (data.status === 'REQUEST_DENIED') {
        throw new Error('REQUEST_DENIED: Clé API invalide ou restrictions');
      }

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error(`Géocodage échoué: ${data.status}`);
      }

      const result = data.results[0];
      const location = result.geometry.location;

      return {
        success: true,
        coordinates: {
          lat: location.lat,
          lng: location.lng
        },
        formattedAddress: result.formatted_address,
        components: this.extractAddressComponents(result.address_components),
        bounds: result.geometry.bounds || null,
        placeId: result.place_id
      };

    } catch (error) {
      console.error('❌ Erreur géocodage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extrait les composants d'adresse utiles
   */
  extractAddressComponents(components) {
    const extracted = {
      city: null,
      country: null,
      countryCode: null,
      postalCode: null,
      state: null,
      region: null
    };
    
    components.forEach(component => {
      const types = component.types;
      
      if (types.includes('locality')) {
        extracted.city = component.long_name;
      }
      if (types.includes('country')) {
        extracted.country = component.long_name;
        extracted.countryCode = component.short_name;
      }
      if (types.includes('postal_code')) {
        extracted.postalCode = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        extracted.state = component.long_name;
      }
      if (types.includes('administrative_area_level_2')) {
        extracted.region = component.long_name;
      }
    });

    return extracted;
  }

  /**
   * Valide et géocode une requête géographique
   */
  async validateAndGeocode(query) {
    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return {
          success: false,
          error: 'La requête géographique est requise'
        };
      }

      // Détection du type de localisation
      const locationType = this.detectLocationType(query);
      console.log(`📍 Type détecté: ${locationType.type} pour "${query}"`);
      
      // Si c'est des coordonnées, pas besoin de géocoder
      if (locationType.type === 'coordinates') {
        // Validation des coordonnées
        const { lat, lng } = locationType.data;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return {
            success: false,
            error: 'Coordonnées invalides (latitude: -90 à 90, longitude: -180 à 180)'
          };
        }

        return {
          success: true,
          type: locationType.type,
          coordinates: locationType.data,
          formattedAddress: locationType.formatted,
          original: query
        };
      }

      // Géocodage pour les autres types
      const geocodeResult = await this.geocodeAddress(locationType.formatted);
      
      if (!geocodeResult.success) {
        return {
          success: false,
          error: 'Impossible de localiser cette adresse',
          suggestions: this.generateSuggestions(query, locationType.type)
        };
      }

      return {
        success: true,
        type: locationType.type,
        coordinates: geocodeResult.coordinates,
        formattedAddress: geocodeResult.formattedAddress,
        components: geocodeResult.components,
        bounds: geocodeResult.bounds,
        placeId: geocodeResult.placeId,
        original: query
      };

    } catch (error) {
      console.error('❌ Erreur dans validateAndGeocode:', error);
      return {
        success: false,
        error: 'Erreur lors de la validation géographique'
      };
    }
  }

  /**
   * Génère des suggestions en cas d'erreur
   */
  generateSuggestions(query, type) {
    const suggestions = [];
    
    switch (type) {
      case 'city':
        suggestions.push('Essayez d\'ajouter le pays (ex: "Paris, France")');
        suggestions.push('Vérifiez l\'orthographe de la ville');
        suggestions.push('Utilisez un code postal à la place');
        break;
        
      case 'postal_code':
        suggestions.push('Vérifiez le format du code postal');
        suggestions.push('Essayez avec le nom de la ville');
        break;
        
      case 'city_country':
        suggestions.push('Vérifiez l\'orthographe de la ville et du pays');
        suggestions.push('Essayez un format différent (ex: "Paris, FR")');
        break;
        
      default:
        suggestions.push('Vérifiez l\'orthographe');
        suggestions.push('Utilisez un format standard (ville, pays)');
        suggestions.push('Essayez avec des coordonnées GPS');
    }
    
    return suggestions;
  }

  /**
   * Teste la connexion à l'API Google Maps
   */
  async testApiConnection() {
    try {
      const result = await this.geocodeAddress('Paris, France');
      return {
        success: result.success,
        message: result.success ? 'Connexion API OK' : `Erreur: ${result.error}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Erreur de connexion: ${error.message}`
      };
    }
  }
}

module.exports = GeocodingService;