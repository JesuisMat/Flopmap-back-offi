// controllers/auth.controller.js
const AuthService = require('../services/auth.service');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * POST /auth/signup
   * Inscription d'un nouvel utilisateur
   */
  async signUp(req, res) {
    const startTime = Date.now();
    
    try {
      const { email, password, fullName } = req.body;

      // Validation des données
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email et mot de passe requis'
        });
      }

      console.log(`🔐 Tentative d'inscription: ${email}`);

      const result = await this.authService.signUp({
        email,
        password,
        fullName
      });

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          executionTime
        });
      }

      res.status(201).json({
        success: true,
        message: 'Compte créé avec succès',
        user: result.user,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur dans signUp:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        executionTime
      });
    }
  }

  /**
   * POST /auth/signin
   * Connexion utilisateur
   */
  async signIn(req, res) {
    const startTime = Date.now();
    
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email et mot de passe requis'
        });
      }

      console.log(`🔐 Tentative de connexion: ${email}`);

      const result = await this.authService.signIn({
        email,
        password
      });

      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: result.error,
          executionTime
        });
      }

      res.json({
        success: true,
        message: 'Connexion réussie',
        user: result.user,
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur dans signIn:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        executionTime
      });
    }
  }

  /**
   * GET /auth/me
   * Récupération du profil utilisateur
   */
  async getProfile(req, res) {
    const startTime = Date.now();
    
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token manquant'
        });
      }

      const result = await this.authService.verifyToken(token);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: result.error
        });
      }

      // Vérifier les quotas
      const quotaResult = await this.authService.checkSearchQuota(result.user.id);

      res.json({
        success: true,
        user: result.user,
        quota: quotaResult.success ? {
          remainingSearches: quotaResult.remainingSearches,
          maxSearches: quotaResult.maxSearches,
          tier: quotaResult.tier
        } : null,
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur dans getProfile:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        executionTime
      });
    }
  }

  /**
   * POST /auth/logout
   * Déconnexion (côté client seulement avec JWT)
   */
  async logout(req, res) {
    try {
      // Avec JWT, la déconnexion se fait côté client
      // On pourrait implémenter une blacklist de tokens ici
      
      res.json({
        success: true,
        message: 'Déconnexion réussie'
      });

    } catch (error) {
      console.error('❌ Erreur dans logout:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }
}

module.exports = AuthController;