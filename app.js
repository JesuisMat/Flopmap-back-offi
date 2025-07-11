// app.js - Mise à jour complète pour intégrer FlopMap avec Auth et Sécurité
require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Routes existantes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var stripeRouter = require('./routes/stripe');
// Routes FlopMap
var searchRouter = require('./routes/search');
var authRouter = require('./routes/auth');

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Initialisation base de données
const databaseService = require('./services/database.service');

var app = express();

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://maps.googleapis.com", "https://*.supabase.co"]
    }
  }
}));

// Configuration CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:3001',
      'http://localhost:3000',
      'https://flopmap.vercel.app' // Domaine de production
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requêtes par IP
  message: {
    success: false,
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ignorer rate limit pour les assets statiques
    return req.path.startsWith('/public/') || req.path.startsWith('/images/');
  }
});

// Rate limiting spécifique pour l'API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requêtes par IP pour l'API
  message: {
    success: false,
    error: 'Trop de requêtes API, veuillez réessayer plus tard'
  }
});

// Rate limiting pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 80, // 5 tentatives de connexion par IP
  message: {
    success: false,
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard'
  }
});

// Middleware de base
app.use(cors(corsOptions));
app.use(globalLimiter);
app.use(logger('dev'));
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Stocker le raw body pour les webhooks Stripe
    if (req.path === '/api/webhooks/stripe') {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour ajouter le timestamp et l'ID de requête
app.use((req, res, next) => {
  req.startTime = Date.now();
  req.requestId = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Middleware de logging des requêtes
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    const executionTime = Date.now() - req.startTime;
    
    // Log des requêtes lentes (>2s)
    if (executionTime > 2000) {
      console.warn(`⚠️ Requête lente [${req.requestId}]: ${req.method} ${req.path} - ${executionTime}ms`);
    }
    
    // Log des erreurs
    if (res.statusCode >= 400) {
      console.error(`❌ Erreur [${req.requestId}]: ${req.method} ${req.path} - ${res.statusCode} - ${executionTime}ms`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Routes avec rate limiting spécifique
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/search', apiLimiter, searchRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/stripe', stripeRouter);


// Test endpoint pour vérifier la santé de l'API
app.get('/api/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test de la base de données
    const dbHealth = await databaseService.testConnection();
    
    const healthCheck = {
      success: true,
      message: 'API FlopMap opérationnelle',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: dbHealth,
      responseTime: Date.now() - startTime
    };
    
    res.json(healthCheck);
  } catch (error) {
    console.error('❌ Erreur health check:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de santé de l\'API',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour vérifier les variables d'environnement (dev seulement)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/env', (req, res) => {
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? '✅ Définie' : '❌ Manquante',
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Définie' : '❌ Manquante',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Définie' : '❌ Manquante',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Définie' : '❌ Manquante',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✅ Définie' : '❌ Manquante'
    });
  });
}

// Middleware de gestion des erreurs 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Middleware de gestion des erreurs CORS
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Accès interdit par CORS',
      origin: req.headers.origin,
      requestId: req.requestId
    });
  }
  next(err);
});

// Middleware de gestion des erreurs globales
app.use((err, req, res, next) => {
  const executionTime = Date.now() - req.startTime;
  
  console.error(`❌ Erreur globale [${req.requestId}]:`, {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    executionTime
  });
  
  // Erreur de parsing JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'JSON invalide dans la requête',
      requestId: req.requestId,
      executionTime
    });
  }
  
  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Données invalides',
      details: err.details || err.message,
      requestId: req.requestId,
      executionTime
    });
  }
  
  // Erreur de base de données
  if (err.code === 'PGRST116' || err.code === '23505') {
    return res.status(400).json({
      success: false,
      error: 'Erreur de base de données',
      requestId: req.requestId,
      executionTime
    });
  }
  
  // Erreur générique
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : err.message,
    requestId: req.requestId,
    executionTime,
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      details: err.details 
    })
  });
});

// Gestion des erreurs non catchées
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM reçu, arrêt gracieux du serveur');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT reçu, arrêt gracieux du serveur');
  process.exit(0);
});

module.exports = app;