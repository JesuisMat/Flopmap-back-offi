// services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const databaseService = require('./database.service');

class AuthService {
  constructor() {
    this.db = databaseService.getClient();
    this.jwtSecret = process.env.JWT_SECRET || 'flopmap-secret-key-2024';
  }

  /**
   * Inscription d'un nouvel utilisateur
   */
  async signUp(userData) {
    try {
      const { email, password, fullName } = userData;

      // Validation
      if (!email || !password) {
        return {
          success: false,
          error: 'Email et mot de passe requis'
        };
      }

      if (password.length < 6) {
        return {
          success: false,
          error: 'Le mot de passe doit contenir au moins 6 caractères'
        };
      }

      // Vérifier si l'utilisateur existe déjà
      const { data: existingUser } = await this.db
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return {
          success: false,
          error: 'Un compte avec cet email existe déjà'
        };
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(password, 12);

      // Créer l'utilisateur
      const { data: user, error } = await this.db
        .from('users')
        .insert([{
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          full_name: fullName || '',
          subscription_tier: 'free',
          daily_searches_used: 0,
          last_search_reset: new Date()
        }])
        .select('id, email, full_name, subscription_tier, daily_searches_used, created_at')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Générer le token JWT
      const token = this.generateToken(user.id);

      console.log(`✅ Nouvel utilisateur inscrit: ${user.email}`);

      return {
        success: true,
        user: {
          ...user,
          token
        }
      };

    } catch (error) {
      console.error('❌ Erreur signup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Connexion utilisateur
   */
  async signIn(credentials) {
    try {
      const { email, password } = credentials;

      if (!email || !password) {
        return {
          success: false,
          error: 'Email et mot de passe requis'
        };
      }

      // Récupérer l'utilisateur avec son mot de passe
      const { data: user, error } = await this.db
        .from('users')
        .select('id, email, password_hash, full_name, subscription_tier, daily_searches_used, last_search_reset')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !user) {
        return {
          success: false,
          error: 'Email ou mot de passe incorrect'
        };
      }

      // Vérifier le mot de passe
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Email ou mot de passe incorrect'
        };
      }

      // Générer le token JWT
      const token = this.generateToken(user.id);

      // Retourner les données sans le hash du mot de passe
      const { password_hash, ...userWithoutPassword } = user;

      console.log(`✅ Utilisateur connecté: ${user.email}`);

      return {
        success: true,
        user: {
          ...userWithoutPassword,
          token
        }
      };

    } catch (error) {
      console.error('❌ Erreur signin:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Vérification du token JWT
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Récupérer les données utilisateur actuelles
      const { data: user, error } = await this.db
        .from('users')
        .select('id, email, full_name, subscription_tier, daily_searches_used, last_search_reset')
        .eq('id', decoded.userId)
        .single();

      if (error || !user) {
        throw new Error('Utilisateur introuvable');
      }

      return {
        success: true,
        user
      };

    } catch (error) {
      return {
        success: false,
        error: 'Token invalide'
      };
    }
  }

  /**
   * Génération du token JWT
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  /**
   * Vérification des quotas de recherche
   */
  async checkSearchQuota(userId) {
    try {
      const { data: user, error } = await this.db
        .from('users')
        .select('subscription_tier, daily_searches_used, last_search_reset')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('Utilisateur introuvable');
      }

      const now = new Date();
      const lastReset = new Date(user.last_search_reset);
      const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

      // Reset quotas si nouveau jour
      if (daysSinceReset >= 1) {
        await this.db
          .from('users')
          .update({
            daily_searches_used: 0,
            last_search_reset: now
          })
          .eq('id', userId);
        
        user.daily_searches_used = 0;
      }

      // Quotas par tier
      const quotas = {
        free: 5,
        premium: 50,
        pro: 200
      };

      const maxSearches = quotas[user.subscription_tier] || 5;
      const remainingSearches = maxSearches - user.daily_searches_used;

      return {
        success: true,
        canSearch: remainingSearches > 0,
        remainingSearches,
        maxSearches,
        tier: user.subscription_tier
      };

    } catch (error) {
      console.error('❌ Erreur checkSearchQuota:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Incrémenter le compteur de recherches
   */
  async incrementSearchCount(userId) {
    try {
      await this.db
        .from('users')
        .update({
          daily_searches_used: this.db.raw('daily_searches_used + 1')
        })
        .eq('id', userId);

      return { success: true };

    } catch (error) {
      console.error('❌ Erreur incrementSearchCount:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enregistrer une recherche dans l'historique
   */
  async saveSearch(userId, searchData) {
    try {
      const { data, error } = await this.db
        .from('searches')
        .insert([{
          user_id: userId,
          query: searchData.query,
          location_type: searchData.type,
          coordinates: searchData.coordinates,
          results_count: searchData.resultsCount || 0,
          api_cost: searchData.apiCost || 0,
          results_data: searchData.results || null
        }])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        search: data
      };

    } catch (error) {
      console.error('❌ Erreur saveSearch:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AuthService;