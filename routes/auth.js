// routes/auth.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');

// Instanciation du contrôleur
const authController = new AuthController();

/**
 * POST /auth/signup
 * Inscription d'un nouvel utilisateur
 */
router.post('/signup', async (req, res) => {
  try {
    await authController.signUp(req, res);
  } catch (error) {
    console.error('❌ Erreur dans la route signup:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * POST /auth/signin
 * Connexion utilisateur
 */
router.post('/signin', async (req, res) => {
  try {
    await authController.signIn(req, res);
  } catch (error) {
    console.error('❌ Erreur dans la route signin:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * GET /auth/me
 * Récupération du profil utilisateur
 */
router.get('/me', async (req, res) => {
  try {
    await authController.getProfile(req, res);
  } catch (error) {
    console.error('❌ Erreur dans la route me:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * POST /auth/logout
 * Déconnexion utilisateur
 */
router.post('/logout', async (req, res) => {
  try {
    await authController.logout(req, res);
  } catch (error) {
    console.error('❌ Erreur dans la route logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * GET /auth/health
 * Endpoint de santé pour l'authentification
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Auth opérationnelle',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;