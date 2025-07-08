// middleware/auth.middleware.js
const AuthService = require('../services/auth.service');

class AuthMiddleware {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware pour vérifier l'authentification
   */
  async requireAuth(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token d\'authentification manquant'
        });
      }

      const result = await this.authService.verifyToken(token);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: 'Token invalide'
        });
      }

      // Ajouter l'utilisateur à la requête
      req.user = result.user;
      next();

    } catch (error) {
      console.error('❌ Erreur middleware auth:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Middleware pour vérifier les quotas de recherche
   */
  async checkSearchQuota(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Utilisateur non authentifié'
        });
      }

      const quotaResult = await this.authService.checkSearchQuota(req.user.id);

      if (!quotaResult.success) {
        return res.status(500).json({
          success: false,
          error: quotaResult.error
        });
      }

      if (!quotaResult.canSearch) {
        return res.status(429).json({
          success: false,
          error: 'Quota de recherches quotidien atteint',
          quota: {
            remainingSearches: quotaResult.remainingSearches,
            maxSearches: quotaResult.maxSearches,
            tier: quotaResult.tier
          }
        });
      }

      // Ajouter les infos de quota à la requête
      req.quota = quotaResult;
      next();

    } catch (error) {
      console.error('❌ Erreur middleware quota:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  }

  /**
   * Middleware optionnel pour l'authentification
   * Continue même si pas de token
   */
  async optionalAuth(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        const result = await this.authService.verifyToken(token);
        if (result.success) {
          req.user = result.user;
        }
      }

      next();

    } catch (error) {
      console.error('❌ Erreur middleware optionalAuth:', error);
      next(); // Continue même en cas d'erreur
    }
  }
}

module.exports = new AuthMiddleware();