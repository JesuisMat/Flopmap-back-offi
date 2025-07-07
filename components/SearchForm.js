// components/SearchForm.js
import { useState, useEffect } from 'react';
import styles from '../styles/SearchForm.module.css';

export default function SearchForm({ 
  onSearch, 
  isLoading, 
  initialQuery = '', 
  onNewSearch, 
  showNewSearchButton = false 
}) {
  const [query, setQuery] = useState(initialQuery);
  const [radius, setRadius] = useState(5000);
  const [maxResults, setMaxResults] = useState(10);
  const [placeTypes, setPlaceTypes] = useState([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Types d'établissements disponibles
  const availableTypes = [
    { value: 'restaurant', label: '🍽️ Restaurants' },
    { value: 'cafe', label: '☕ Cafés' },
    { value: 'bar', label: '🍺 Bars' },
    { value: 'hotel', label: '🏨 Hôtels' },
    { value: 'store', label: '🏪 Magasins' },
    { value: 'gas_station', label: '⛽ Stations essence' },
    { value: 'pharmacy', label: '💊 Pharmacies' },
    { value: 'bank', label: '🏦 Banques' },
    { value: 'beauty_salon', label: '💄 Salons de beauté' },
    { value: 'hospital', label: '🏥 Hôpitaux' }
  ];

  // Détection automatique du type de recherche
  const detectSearchType = (searchQuery) => {
    const patterns = {
      coordinates: /^-?[0-9]+\.?[0-9]*,\s?-?[0-9]+\.?[0-9]*$/,
      postalCode: /^[0-9]{5}$|^[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]$/i,
      cityCountry: /^[^,]+,\s?[^,]+$/
    };

    if (patterns.coordinates.test(searchQuery.trim())) {
      return 'coordinates';
    }
    if (patterns.postalCode.test(searchQuery.trim())) {
      return 'postalCode';
    }
    if (patterns.cityCountry.test(searchQuery.trim())) {
      return 'cityCountry';
    }
    return 'city';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      alert('Veuillez saisir une localisation');
      return;
    }

    const searchData = {
      query: query.trim(),
      radius: parseInt(radius),
      maxResults: parseInt(maxResults),
      placeTypes: placeTypes,
      searchType: detectSearchType(query)
    };

    onSearch(searchData);
  };

  const handlePlaceTypeChange = (type) => {
    setPlaceTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      alert('La géolocalisation n\'est pas supportée par votre navigateur');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      },
      (error) => {
        console.error('Erreur géolocalisation:', error);
        alert('Impossible d\'obtenir votre position');
      }
    );
  };

  return (
    <div className={styles.searchForm}>
      {showNewSearchButton && (
        <button 
          onClick={onNewSearch}
          className={styles.newSearchButton}
        >
          🔍 Nouvelle recherche
        </button>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.mainSearch}>
          <div className={styles.searchInputContainer}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ville, code postal ou coordonnées GPS..."
              className={styles.searchInput}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={requestGeolocation}
              className={styles.geoButton}
              title="Utiliser ma position"
              disabled={isLoading}
            >
              📍
            </button>
          </div>

          <button
            type="submit"
            className={styles.searchButton}
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? '🔍 Recherche...' : '🔍 Chercher les flops'}
          </button>
        </div>

        {/* Paramètres avancés */}
        <div className={styles.advancedSection}>
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={styles.advancedToggle}
          >
            {isAdvancedOpen ? '▼' : '▶'} Paramètres avancés
          </button>

          {isAdvancedOpen && (
            <div className={styles.advancedOptions}>
              <div className={styles.optionGroup}>
                <label className={styles.optionLabel}>
                  Rayon de recherche: {radius}m
                </label>
                <input
                  type="range"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className={styles.rangeInput}
                />
                <div className={styles.rangeLabels}>
                  <span>1km</span>
                  <span>50km</span>
                </div>
              </div>

              <div className={styles.optionGroup}>
                <label className={styles.optionLabel}>
                  Nombre de résultats: {maxResults}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  className={styles.rangeInput}
                />
                <div className={styles.rangeLabels}>
                  <span>5</span>
                  <span>50</span>
                </div>
              </div>

              <div className={styles.optionGroup}>
                <label className={styles.optionLabel}>
                  Types d'établissements ({placeTypes.length} sélectionnés)
                </label>
                <div className={styles.placeTypesGrid}>
                  {availableTypes.map((type) => (
                    <label key={type.value} className={styles.placeTypeItem}>
                      <input
                        type="checkbox"
                        checked={placeTypes.includes(type.value)}
                        onChange={() => handlePlaceTypeChange(type.value)}
                        className={styles.placeTypeCheckbox}
                      />
                      <span className={styles.placeTypeLabel}>
                        {type.label}
                      </span>
                    </label>
                  ))}
                </div>
                {placeTypes.length === 0 && (
                  <p className={styles.hint}>
                    Aucun type sélectionné = tous les types
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Indicateur de type de recherche */}
        {query && (
          <div className={styles.searchTypeIndicator}>
            Type détecté: <strong>{detectSearchType(query)}</strong>
          </div>
        )}
      </form>
    </div>
  );
}