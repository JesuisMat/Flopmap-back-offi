// components/ResultsList.js
import { useState } from 'react';
import PlaceCard from './PlaceCard';
import styles from '../styles/ResultsList.module.css';

export default function ResultsList({ results }) {
  const [sortBy, setSortBy] = useState('rating'); // 'rating', 'distance', 'reviewCount'
  const [viewMode, setViewMode] = useState('list'); // 'list', 'grid'

  if (!results || !results.success) {
    return (
      <div className={styles.error}>
        Aucun résultat trouvé
      </div>
    );
  }

  const { searchQuery, results: data } = results;
  const places = data.places || [];

  const sortedPlaces = [...places].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (a.rating || 5) - (b.rating || 5);
      case 'reviewCount':
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      case 'distance':
        // Pour l'instant, on trie par nom (distance nécessiterait un calcul)
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return (
    <div className={styles.resultsContainer}>
      {/* En-tête des résultats */}
      <div className={styles.resultsHeader}>
        <div className={styles.resultsInfo}>
          <h2 className={styles.resultsTitle}>
            🎯 Pires établissements près de "{searchQuery.formatted}"
          </h2>
          <p className={styles.resultsCount}>
            {data.displayCount} établissements trouvés sur {data.totalFound} analysés
          </p>
          <div className={styles.searchMeta}>
            <span className={styles.searchType}>
              📍 {searchQuery.type === 'coordinates' ? 'Coordonnées GPS' : 
                 searchQuery.type === 'postal_code' ? 'Code postal' : 
                 'Ville'}
            </span>
            {results.executionTime && (
              <span className={styles.executionTime}>
                ⚡ {(results.executionTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        {/* Contrôles de tri et vue */}
        <div className={styles.controls}>
          <div className={styles.sortControls}>
            <label className={styles.sortLabel}>Trier par:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="rating">Note (pire en premier)</option>
              <option value="reviewCount">Nombre d'avis</option>
              <option value="distance">Distance</option>
            </select>
          </div>

          <div className={styles.viewControls}>
            <button
              onClick={() => setViewMode('list')}
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              title="Vue liste"
            >
              📋
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              title="Vue grille"
            >
              ⚏
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className={styles.quickStats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {(places.reduce((sum, place) => sum + (place.rating || 0), 0) / places.length).toFixed(1)}
          </span>
          <span className={styles.statLabel}>Note moyenne</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {places.filter(place => place.rating <= 2).length}
          </span>
          <span className={styles.statLabel}>Très mauvais (≤2⭐)</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {places.reduce((sum, place) => sum + (place.reviewCount || 0), 0)}
          </span>
          <span className={styles.statLabel}>Total avis</span>
        </div>
      </div>

      {/* Liste des établissements */}
      {sortedPlaces.length > 0 ? (
        <div className={`${styles.placesList} ${viewMode === 'grid' ? styles.gridView : styles.listView}`}>
          {sortedPlaces.map((place, index) => (
            <PlaceCard
              key={place.id}
              place={place}
              rank={index + 1}
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : (
        <div className={styles.noResults}>
          <div className={styles.noResultsIcon}>😔</div>
          <h3>Aucun établissement trouvé</h3>
          <p>
            Essayez d'élargir votre rayon de recherche ou de modifier les critères
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className={styles.disclaimer}>
        <p>
          ⚠️ Ces données proviennent d'avis publics Google. Les noms dans les avis ont été anonymisés.
        </p>
      </div>
    </div>
  );
}