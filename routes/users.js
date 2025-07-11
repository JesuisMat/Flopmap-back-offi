// routes/user.js
const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Instanciation du contrôleur
const userController = new UserController();

/**
 * GET /user/history
 * Récupérer l'historique de recherches
 */
router.get('/history', authMiddleware.requireAuth, async (req, res) => {
  try {
    await userController.getSearchHistory(req, res);
  } catch (error) {
    console.error('❌ Erreur route history:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * GET /user/export-history
 * Exporter l'historique en CSV/PDF
 */
router.get('/export-history', authMiddleware.requireAuth, async (req, res) => {
  try {
    await userController.exportHistory(req, res);
  } catch (error) {
    console.error('❌ Erreur route export:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * GET /user/stats
 * Récupérer les statistiques utilisateur
 */
router.get('/stats', authMiddleware.requireAuth, async (req, res) => {
  try {
    await userController.getUserStats(req, res);
  } catch (error) {
    console.error('❌ Erreur route stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * DELETE /user/history/:id
 * Supprimer une recherche de l'historique
 */
router.delete('/history/:id', authMiddleware.requireAuth, async (req, res) => {
  try {
    await userController.deleteSearch(req, res);
  } catch (error) {
    console.error('❌ Erreur route delete:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;