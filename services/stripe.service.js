// services/stripe.service.js
const Stripe = require('stripe');
const databaseService = require('./database.service');

class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.db = databaseService.getClient();
    
    // Prix IDs configurés dans Stripe
    this.priceIds = {
      premium: process.env.STRIPE_PREMIUM_PRICE_ID,
      pro: process.env.STRIPE_PRO_PRICE_ID
    };
    
    // Webhook secret pour vérifier les signatures
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Créer une session de checkout Stripe
   */
  async createCheckoutSession(userId, priceId, planId) {
    try {
      // Récupérer l'utilisateur
      const { data: user, error: userError } = await this.db
        .from('users')
        .select('email, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Créer ou récupérer le customer Stripe
      let customerId = user.stripe_customer_id;
      
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          metadata: {
            userId: userId
          }
        });
        
        customerId = customer.id;
        
        // Sauvegarder le customer ID
        await this.db
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
      }

      // Créer la session de checkout
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription?canceled=true`,
        metadata: {
          userId: userId,
          planId: planId
        },
        subscription_data: {
          metadata: {
            userId: userId,
            planId: planId
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        locale: 'fr'
      });

      console.log(`✅ Session checkout créée pour l'utilisateur ${userId}`);

      return {
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id
      };

    } catch (error) {
      console.error('❌ Erreur création checkout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Créer une session du portail client Stripe
   */
  async createPortalSession(userId) {
    try {
      // Récupérer le customer ID
      const { data: user, error } = await this.db
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (error || !user || !user.stripe_customer_id) {
        throw new Error('Customer Stripe non trouvé');
      }

      // Créer la session du portail
      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${process.env.FRONTEND_URL}/subscription`,
        locale: 'fr'
      });

      return {
        success: true,
        portalUrl: session.url
      };

    } catch (error) {
      console.error('❌ Erreur création portail:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Traiter les webhooks Stripe
   */
  async handleWebhook(payload, signature) {
    let event;

    try {
      // Vérifier la signature du webhook
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (err) {
      console.error('❌ Erreur signature webhook:', err);
      return {
        success: false,
        error: 'Signature webhook invalide'
      };
    }

    // Traiter les différents types d'événements
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        default:
          console.log(`Event non géré: ${event.type}`);
      }

      return {
        success: true,
        message: `Event ${event.type} traité`
      };

    } catch (error) {
      console.error('❌ Erreur traitement webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gérer la complétion du checkout
   */
  async handleCheckoutCompleted(session) {
    const userId = session.metadata.userId;
    const planId = session.metadata.planId;

    console.log(`✅ Checkout complété pour l'utilisateur ${userId}, plan: ${planId}`);

    // L'abonnement sera géré par l'event subscription.created
  }

  /**
   * Gérer la mise à jour d'un abonnement
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const userId = subscription.metadata.userId;
      const planId = subscription.metadata.planId;
      
      // Déterminer le tier basé sur le prix
      let tier = 'free';
      if (subscription.items.data[0].price.id === this.priceIds.premium) {
        tier = 'premium';
      } else if (subscription.items.data[0].price.id === this.priceIds.pro) {
        tier = 'pro';
      }

      // Mettre à jour l'utilisateur
      const { error: userError } = await this.db
        .from('users')
        .update({
          subscription_tier: tier,
          updated_at: new Date()
        })
        .eq('id', userId);

      if (userError) throw userError;

      // Mettre à jour ou créer l'enregistrement d'abonnement
      const { data: existingSub } = await this.db
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      if (existingSub) {
        // Mettre à jour
        await this.db
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            updated_at: new Date()
          })
          .eq('stripe_subscription_id', subscription.id);
      } else {
        // Créer
        await this.db
          .from('subscriptions')
          .insert([{
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000)
          }]);
      }

      console.log(`✅ Abonnement mis à jour: ${userId} -> ${tier}`);

    } catch (error) {
      console.error('❌ Erreur mise à jour abonnement:', error);
      throw error;
    }
  }

  /**
   * Gérer la suppression d'un abonnement
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const userId = subscription.metadata.userId;

      // Repasser l'utilisateur en free
      await this.db
        .from('users')
        .update({
          subscription_tier: 'free',
          updated_at: new Date()
        })
        .eq('id', userId);

      // Mettre à jour le statut de l'abonnement
      await this.db
        .from('subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', subscription.id);

      console.log(`✅ Abonnement annulé pour l'utilisateur ${userId}`);

    } catch (error) {
      console.error('❌ Erreur suppression abonnement:', error);
      throw error;
    }
  }

  /**
   * Gérer un paiement réussi
   */
  async handlePaymentSucceeded(invoice) {
    console.log(`✅ Paiement réussi: ${invoice.id} - ${invoice.amount_paid / 100}€`);
    
    // Optionnel: envoyer un email de confirmation
    // Optionnel: logger la transaction
  }

  /**
   * Gérer un paiement échoué
   */
  async handlePaymentFailed(invoice) {
    console.log(`❌ Paiement échoué: ${invoice.id}`);
    
    // Optionnel: envoyer un email d'alerte
    // Optionnel: suspendre temporairement l'accès après X échecs
  }

  /**
   * Vérifier le statut d'abonnement d'un utilisateur
   */
  async checkSubscriptionStatus(userId) {
    try {
      const { data: subscription, error } = await this.db
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error || !subscription) {
        return {
          success: true,
          hasSubscription: false,
          tier: 'free'
        };
      }

      // Vérifier si l'abonnement est toujours valide
      const now = new Date();
      const endDate = new Date(subscription.current_period_end);
      
      if (endDate < now) {
        return {
          success: true,
          hasSubscription: false,
          tier: 'free',
          expired: true
        };
      }

      return {
        success: true,
        hasSubscription: true,
        subscription: subscription,
        tier: subscription.status === 'active' ? 
          (subscription.stripe_price_id === this.priceIds.premium ? 'premium' : 'pro') : 
          'free'
      };

    } catch (error) {
      console.error('❌ Erreur vérification abonnement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Annuler un abonnement
   */
  async cancelSubscription(userId) {
    try {
      // Récupérer l'abonnement actif
      const { data: subscription, error } = await this.db
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error || !subscription) {
        throw new Error('Aucun abonnement actif trouvé');
      }

      // Annuler via Stripe (à la fin de la période)
      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true
        }
      );

      return {
        success: true,
        message: 'Abonnement annulé, actif jusqu\'à la fin de la période',
        endsAt: new Date(updatedSubscription.current_period_end * 1000)
      };

    } catch (error) {
      console.error('❌ Erreur annulation abonnement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = StripeService;