// controllers/user.controller.js
const databaseService = require('../services/database.service');

class UserController {
  constructor() {
    this.db = databaseService.getClient();
  }

  /**
   * Récupérer l'historique de recherches
   */
  async getSearchHistory(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;
      const userTier = req.user.subscription_tier || 'free';
      
      // Limiter l'historique pour les utilisateurs gratuits
      let query = this.db
        .from('searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (userTier === 'free') {
        // Limiter à 7 jours pour les gratuits
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }

      const { data: searches, error } = await query.limit(100);

      if (error) {
        throw error;
      }

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        searches: searches || [],
        count: searches?.length || 0,
        limitedByTier: userTier === 'free',
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur getSearchHistory:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de l\'historique',
        executionTime
      });
    }
  }

  /**
   * Exporter l'historique
   */
  async exportHistory(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;
      const userTier = req.user.subscription_tier || 'free';
      const format = req.query.format || 'csv';

      // Vérifier que l'utilisateur est premium
      if (userTier === 'free') {
        return res.status(403).json({
          success: false,
          error: 'Export réservé aux utilisateurs Premium',
          needsUpgrade: true
        });
      }

      // Récupérer toutes les recherches
      const { data: searches, error } = await this.db
        .from('searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (format === 'csv') {
        // Générer le CSV
        const csv = this.generateCSV(searches);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="flopmap-history-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
        
      } else if (format === 'pdf') {
        // Pour le PDF, on devrait utiliser une lib comme puppeteer ou pdfkit
        // Pour l'instant, on retourne une erreur
        return res.status(501).json({
          success: false,
          error: 'Export PDF en cours de développement'
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Format non supporté'
        });
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur exportHistory:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'export',
        executionTime
      });
    }
  }

  /**
   * Récupérer les statistiques utilisateur
   */
  async getUserStats(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;

      // Compter les recherches totales
      const { count: totalSearches } = await this.db
        .from('searches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Compter les recherches du jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todaySearches } = await this.db
        .from('searches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today.toISOString());

      // Calculer le total d'établissements trouvés
      const { data: searchResults } = await this.db
        .from('searches')
        .select('results_count')
        .eq('user_id', userId);

      const totalPlaces = searchResults?.reduce((sum, search) => sum + (search.results_count || 0), 0) || 0;

      // Top des villes recherchées
      const { data: topCities } = await this.db
        .from('searches')
        .select('query')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      const cityCount = {};
      topCities?.forEach(search => {
        const city = search.query.split(',')[0].trim();
        cityCount[city] = (cityCount[city] || 0) + 1;
      });

      const topCitiesList = Object.entries(cityCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([city, count]) => ({ city, count }));

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        stats: {
          totalSearches: totalSearches || 0,
          todaySearches: todaySearches || 0,
          totalPlacesFound: totalPlaces,
          topCities: topCitiesList,
          memberSince: req.user.created_at,
          currentTier: req.user.subscription_tier || 'free'
        },
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur getUserStats:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        executionTime
      });
    }
  }

  /**
   * Supprimer une recherche
   */
  async deleteSearch(req, res) {
    const startTime = Date.now();
    
    try {
      const userId = req.user.id;
      const searchId = req.params.id;

      // Vérifier que la recherche appartient bien à l'utilisateur
      const { data: search } = await this.db
        .from('searches')
        .select('id')
        .eq('id', searchId)
        .eq('user_id', userId)
        .single();

      if (!search) {
        return res.status(404).json({
          success: false,
          error: 'Recherche non trouvée'
        });
      }

      // Supprimer la recherche
      const { error } = await this.db
        .from('searches')
        .delete()
        .eq('id', searchId);

      if (error) {
        throw error;
      }

      const executionTime = Date.now() - startTime;

      res.json({
        success: true,
        message: 'Recherche supprimée',
        executionTime
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('❌ Erreur deleteSearch:', error);
      
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression',
        executionTime
      });
    }
  }

  /**
   * Générer un CSV à partir des recherches
   */
  generateCSV(searches) {
    const headers = [
      'Date',
      'Lieu',
      'Type',
      'Nombre de résultats',
      'Top 3 pires établissements'
    ];

    const rows = searches.map(search => {
      const date = new Date(search.created_at).toLocaleDateString('fr-FR');
      const lieu = search.query;
      const type = search.location_type || 'ville';
      const nbResultats = search.results_count || 0;
      
      // Extraire le top 3 des pires
      let top3 = '';
      if (search.results_data?.places) {
        top3 = search.results_data.places
          .slice(0, 3)
          .map((place, idx) => `${idx + 1}. ${place.name} (${place.rating}⭐)`)
          .join(' | ');
      }

      return [date, lieu, type, nbResultats, top3];
    });

    // Construire le CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Ajouter le BOM pour l'encodage UTF-8
    return '\ufeff' + csvContent;
  }
}

module.exports = UserController;