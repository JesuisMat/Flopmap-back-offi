// app.js - Mise à jour pour intégrer FlopMap
require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Routes existantes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// Nouvelle route FlopMap
var searchRouter = require('./routes/search');

const cors = require('cors');
var app = express();

// Middleware de base
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour ajouter le timestamp aux requêtes
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/search', searchRouter); // Nouvelle route FlopMap

// Middleware de gestion des erreurs 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Middleware de gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur globale:', err);
  
  // Erreur de parsing JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'JSON invalide dans la requête'
    });
  }
  
  // Erreur générique
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

module.exports = app;