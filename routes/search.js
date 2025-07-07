// routes/search.js
const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/search.controller');

// Instanciation du contrôleur
const searchController = new SearchController();

/**
 * POST /search
 * Recherche des établissements les moins bien notés
 */
router.post('/', async (req, res) => {
  try {
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