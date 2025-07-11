// controllers/search.controller.js
const GeocodingService = require('../services/geocoding.service');
const PlacesService = require('../services/places.service');
const AuthService = require('../services/auth.service');

class SearchController {
  constructor() {
    this.geocodingService = new GeocodingService();
    this.placesService = new PlacesService();
    this.authService = new AuthService();
  }

  /**
   * Recherche les établissements les moins bien notés
   */
  async searchWorstRated(req, res) {
    const startTime = Date.now();
    
    try {
      const { query, radius, maxResults, placeTypes } = req.body;

      // Validation des paramètres
      const validation = this.validateSearchParams(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Paramètres invalides',
          details: validation.errors
        });
      }

      console.log(`🔍 Recherche: "${query}" | Rayon: ${radius || 5000}m | Max: ${maxResults || 10}`);

      // Étape 1: Géolocalisation
      const geoResult = await this.geocodingService.validateAndGeocode(query);
      
      if (!geoResult.success) {
        return res.status(400).json({
          success: false,
          error: geoResult.error,
          suggestions: geoResult.suggestions || []
        });
      }

      console.log(`📍 Localisation trouvée: ${geoResult.formattedAddress}`);

      // Étape 2: Recherche des établissements
      const searchParams = {
        coordinates: geoResult.coordinates,
        radius: parseInt(radius) || 5000,
        maxResults: parseInt(maxResults) || 10,
        placeTypes: placeTypes || []
      };

      const placesResult = await this.placesService.searchWorstRatedPlaces(searchParams);

      if (!placesResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de la recherche des établissements',
          details: placesResult.error
        });
      }

      // Étape 3: Formatage de la réponse
      const executionTime = Date.now() - startTime;
      const response = {
        success: true,
        searchQuery: {
          original: query,
          type: geoResult.type,
          formatted: geoResult.formattedAddress,
          coordinates: geoResult.coordinates
        },
        results: {
          places: placesResult.places,
          totalFound: placesResult.totalFound,
          displayCount: placesResult.places.length
        },
        searchParams: searchParams,
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Recherche terminée: ${response.results.displayCount} établissements en ${executionTime}ms`);
      
      res.json(response);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur dans searchWorstRated:', error);

      // Gestion des erreurs spécifiques
      if (error.message.includes('API_KEY')) {
        return res.status(500).json({
          success: false,
          error: 'Configuration API manquante',
          executionTime
        });
      }
      
      if (error.message.includes('OVER_QUERY_LIMIT')) {
        return res.status(429).json({
          success: false,
          error: 'Limite de requêtes API atteinte. Réessayez plus tard.',
          executionTime
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        executionTime
      });
    }
  }

  /**
   * Récupère les suggestions de recherche
   */
  async getSuggestions(req, res) {
    try {
      const { query } = req.query;

      if (!query || query.length < 2) {
        return res.json({
          success: true,
          suggestions: []
        });
      }

      // Suggestions basées sur les patterns courants
      const suggestions = this.generateSearchSuggestions(query);

      res.json({
        success: true,
        suggestions
      });

    } catch (error) {
      console.error('❌ Erreur dans getSuggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération des suggestions'
      });
    }
  }

  /**
   * Valide les paramètres de recherche
   */
  validateSearchParams(params) {
    const errors = [];

    // Vérification de la requête géographique
    if (!params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
      errors.push('La requête géographique est requise');
    }

    // Vérification du rayon
    if (params.radius) {
      const radius = parseInt(params.radius);
      if (isNaN(radius) || radius <= 0 || radius > 50000) {
        errors.push('Le rayon doit être entre 1 et 50000 mètres');
      }
    }

    // Vérification du nombre max de résultats
    if (params.maxResults) {
      const maxResults = parseInt(params.maxResults);
      if (isNaN(maxResults) || maxResults <= 0 || maxResults > 50) {
        errors.push('Le nombre maximum de résultats doit être entre 1 et 50');
      }
    }

    // Vérification des types de lieux
    if (params.placeTypes && !Array.isArray(params.placeTypes)) {
      errors.push('Les types de lieux doivent être un tableau');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Génère des suggestions de recherche
   */
  generateSearchSuggestions(query) {
    const suggestions = [];
    const lowerQuery = query.toLowerCase();

    // Suggestions de villes françaises populaires
    const popularCities = [
      'Paris, France',
      'Lyon, France',
      'Marseille, France',
      'Toulouse, France',
      'Nice, France',
      'Nantes, France',
      'Strasbourg, France',
      'Montpellier, France',
      'Bordeaux, France',
      'Lille, France'
    ];

    // Filtrer les villes qui correspondent
    const cityMatches = popularCities.filter(city => 
      city.toLowerCase().includes(lowerQuery)
    );

    suggestions.push(...cityMatches.slice(0, 5));

    // Suggestions de formats
    if (lowerQuery.length >= 2) {
      // Suggestions de codes postaux français
      if (/^[0-9]{1,4}$/.test(lowerQuery)) {
        const postalPrefix = lowerQuery.padEnd(5, '0');
        suggestions.push(`${postalPrefix} (Code postal)`);
      }

      // Suggestions de coordonnées
      if (lowerQuery.includes(',') || lowerQuery.includes('.')) {
        suggestions.push('Exemple: 48.8566, 2.3522 (Coordonnées GPS)');
      }
    }

    // Suggestions génériques
    if (suggestions.length === 0) {
      suggestions.push(
        'Exemples: "Paris, France"',
        'Exemples: "75001"',
        'Exemples: "48.8566, 2.3522"'
      );
    }

    return suggestions.slice(0, 8);
  }
}

module.exports = SearchController;