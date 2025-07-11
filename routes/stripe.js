// routes/stripe.js
const express = require('express');
const router = express.Router();
const StripeController = require('../controllers/stripe.controller');
const authMiddleware = require('../middleware/auth.middleware');
const bodyParser = require('body-parser');
// Instanciation du contrôleur
const stripeController = new StripeController();

/**
 * POST /stripe/create-checkout-session
 * Créer une session de checkout Stripe
 */
router.post('/create-checkout-session', authMiddleware.requireAuth, async (req, res) => {
  try {
    await stripeController.createCheckoutSession(req, res);
  } catch (error) {
    console.error('❌ Erreur route checkout:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * POST /stripe/create-portal-session
 * Créer une session du portail client
 */
router.post('/create-portal-session', authMiddleware.requireAuth, async (req, res) => {
  try {
    await stripeController.createPortalSession(req, res);
  } catch (error) {
    console.error('❌ Erreur route portail:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * POST /stripe/webhook
 * Webhook Stripe pour les événements
 */
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  try {
    await stripeController.handleWebhook(req, res);
  } catch (error) {
    console.error('❌ Erreur route webhook:', error);
    res.status(400).json({
      success: false,
      error: 'Erreur webhook'
    });
  }
});

/**
 * GET /stripe/subscription-status
 * Vérifier le statut d'abonnement
 */
router.get('/subscription-status', authMiddleware.requireAuth, async (req, res) => {
  try {
    await stripeController.getSubscriptionStatus(req, res);
  } catch (error) {
    console.error('❌ Erreur route status:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

/**
 * POST /stripe/cancel-subscription
 * Annuler l'abonnement
 */
router.post('/cancel-subscription', authMiddleware.requireAuth, async (req, res) => {
  try {
    await stripeController.cancelSubscription(req, res);
  } catch (error) {
    console.error('❌ Erreur route cancel:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

module.exports = router;