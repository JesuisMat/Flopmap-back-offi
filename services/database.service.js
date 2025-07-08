// services/database.service.js
const { createClient } = require('@supabase/supabase-js');

class DatabaseService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('Variables d\'environnement Supabase manquantes');
    }

    // Client admin pour le backend avec service role key
    this.client = createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ Connexion Supabase initialisée');
  }

  /**
   * Teste la connexion à la base de données
   */
  async testConnection() {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('count')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // Table doesn't exist yet
        throw error;
      }

      return {
        success: true,
        message: 'Connexion DB OK'
      };
    } catch (error) {
      console.error('❌ Erreur connexion DB:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Getter pour le client Supabase
   */
  getClient() {
    return this.client;
  }

  /**
   * Utilitaire pour créer les tables si elles n'existent pas
   */
  async initializeTables() {
    const tables = [
      // Table users
      `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE NOT NULL,
        password_hash VARCHAR NOT NULL,
        full_name VARCHAR,
        subscription_tier VARCHAR DEFAULT 'free',
        daily_searches_used INTEGER DEFAULT 0,
        last_search_reset TIMESTAMP DEFAULT NOW(),
        stripe_customer_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      `,
      
      // Table searches
      `
      CREATE TABLE IF NOT EXISTS searches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        query VARCHAR NOT NULL,
        location_type VARCHAR,
        coordinates JSONB,
        results_count INTEGER DEFAULT 0,
        api_cost DECIMAL(10,4) DEFAULT 0,
        results_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      `,

      // Table subscriptions
      `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id VARCHAR UNIQUE,
        stripe_price_id VARCHAR,
        status VARCHAR DEFAULT 'active',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      `,

      // Table cached_places
      `
      CREATE TABLE IF NOT EXISTS cached_places (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_place_id VARCHAR UNIQUE NOT NULL,
        name VARCHAR NOT NULL,
        location JSONB,
        rating DECIMAL(3,2),
        reviews_count INTEGER DEFAULT 0,
        cached_reviews JSONB,
        photos JSONB,
        address VARCHAR,
        types JSONB,
        price_level INTEGER,
        is_open BOOLEAN,
        website VARCHAR,
        phone_number VARCHAR,
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      `,

      // Index pour améliorer les performances
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
      `CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_cached_places_google_id ON cached_places(google_place_id);`,
      `CREATE INDEX IF NOT EXISTS idx_cached_places_location ON cached_places USING GIN(location);`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);`
    ];

    for (const sql of tables) {
      try {
        await this.client.rpc('exec_sql', { sql });
        console.log('✅ Table/Index créé');
      } catch (error) {
        console.error('❌ Erreur création table:', error);
      }
    }
  }
}

module.exports = new DatabaseService();