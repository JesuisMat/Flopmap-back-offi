// routes/search.js
const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/search.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Instanciation du contrôleur
const searchController = new SearchController();

/**
 * POST /search
 * Recherche des établissements les moins bien notés
 * Authentification optionnelle - quotas différents selon le statut
 */
router.post('/', authMiddleware.optionalAuth, async (req, res) => {
  try {
    // Si utilisateur connecté, vérifier les quotas
    if (req.user) {
      const quotaResult = await searchController.authService.checkSearchQuota(req.user.id);
      
      if (!quotaResult.canSearch) {
        return res.status(429).json({
          success: false,
          error: 'Quota de recherches quotidien atteint',
          quota: {
            remainingSearches: quotaResult.remainingSearches,
            maxSearches: quotaResult.maxSearches,
            tier: quotaResult.tier
          },
          needsUpgrade: quotaResult.tier === 'free'
        });
      }
      
      req.quota = quotaResult;
    }

    await searchController.searchWorstRated(req, res);
  } catch (error) {
    console.error('❌ Erreur dans la route search:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * POST /search/authenticated
 * Recherche réservée aux utilisateurs connectés
 */
router.post('/authenticated', authMiddleware.requireAuth, authMiddleware.checkSearchQuota, async (req, res) => {
  try {
    await searchController.searchWorstRated(req, res);
  } catch (error) {
    console.error('❌ Erreur dans la route search authentifiée:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * GET /search/suggestions
 * Suggestions de recherche géographique
 */
router.get('/suggestions', async (req, res) => {
  try {
    await searchController.getSuggestions(req, res);
  } catch (error) {
    console.error('❌ Erreur dans les suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des suggestions'
    });
  }
});

/**
 * GET /search/health
 * Endpoint de santé pour vérifier l'API
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API FlopMap opérationnelle',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;