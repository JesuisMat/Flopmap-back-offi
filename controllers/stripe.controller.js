// controllers/stripe.controller.js
const StripeService = require('../services/stripe.service');

class StripeController {
  constructor() {
    this.stripeService = new StripeService();
  }

  /**
   * Créer une session de checkout
   */
  async createCheckoutSession(req, res) {
    const startTime = Date.now();
    
    try {
      const { priceId, planId } = req.body;
      const userId = req.user.id;

      if (!priceId || !planId) {
        return res.status(400).json({
          success: false,
          error: 'Prix et plan requis'
        });
      }

      console.log(`💳 Création checkout pour l'utilisateur ${userId}, plan: ${planId}`);

      const result = await this.stripeService.createCheckoutSession(
        userId,
        priceId,
        planId
      );

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          executionTime
        });
      }

      res.json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur createCheckoutSession:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de la session',
        executionTime
      });
    }
  }

  /**
   * Créer une session du portail client
   */
  async createPortalSession(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;

      console.log(`💳 Création portail pour l'utilisateur ${userId}`);

      const result = await this.stripeService.createPortalSession(userId);

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          executionTime
        });
      }

      res.json({
        success: true,
        portalUrl: result.portalUrl,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur createPortalSession:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du portail',
        executionTime
      });
    }
  }

  /**
   * Gérer les webhooks Stripe
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: 'Signature manquante'
        });
      }

      const result = await this.stripeService.handleWebhook(
        req.body,
        signature
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('❌ Erreur handleWebhook:', error);
      
      res.status(400).json({
        success: false,
        error: 'Erreur webhook'
      });
    }
  }

  /**
   * Vérifier le statut d'abonnement
   */
  async getSubscriptionStatus(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;

      const result = await this.stripeService.checkSubscriptionStatus(userId);

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error,
          executionTime
        });
      }

      res.json({
        success: true,
        hasSubscription: result.hasSubscription,
        tier: result.tier,
        subscription: result.subscription,
        expired: result.expired,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur getSubscriptionStatus:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification',
        executionTime
      });
    }
  }

  /**
   * Annuler l'abonnement
   */
  async cancelSubscription(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;

      console.log(`💳 Annulation abonnement pour l'utilisateur ${userId}`);

      const result = await this.stripeService.cancelSubscription(userId);

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          executionTime
        });
      }

      res.json({
        success: true,
        message: result.message,
        endsAt: result.endsAt,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur cancelSubscription:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'annulation',
        executionTime
      });
    }
  }
}

module.exports = StripeController;