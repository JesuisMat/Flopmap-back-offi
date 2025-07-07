// pages/search.js
import { useState } from 'react';
import Head from 'next/head';
import SearchForm from '../components/SearchForm';
import ResultsList from '../components/ResultsList';
import LoadingSpinner from '../components/LoadingSpinner';
import styles from '../styles/Search.module.css';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (searchData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Recherche:', searchData);
      
      // Appel à l'API backend
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la recherche');
      }

      setSearchResults(data);
      setSearchQuery(searchData.query);
      
    } catch (err) {
      console.error('❌ Erreur recherche:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSearch = () => {
    setSearchResults(null);
    setSearchQuery('');
    setError(null);
  };

  return (
    <>
      <Head>
        <title>FlopMap - Découvrez les pires établissements</title>
        <meta name="description" content="Découvrez les établissements les moins bien notés près de chez vous" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            🗺️ <span className={styles.titleBrand}>FlopMap</span>
          </h1>
          <p className={styles.subtitle}>
            Découvrez les établissements les moins bien notés et leurs avis croustillants
          </p>
        </header>

        <main className={styles.main}>
          {/* Formulaire de recherche */}
          <div className={styles.searchSection}>
            <SearchForm 
              onSearch={handleSearch} 
              isLoading={isLoading}
              initialQuery={searchQuery}
              onNewSearch={handleNewSearch}
              showNewSearchButton={!!searchResults}
            />
          </div>

          {/* Gestion des états */}
          {error && (
            <div className={styles.errorContainer}>
              <div className={styles.errorMessage}>
                ❌ {error}
              </div>
            </div>
          )}

          {isLoading && (
            <div className={styles.loadingContainer}>
              <LoadingSpinner />
              <p>Recherche des pires établissements en cours...</p>
            </div>
          )}

          {/* Résultats */}
          {searchResults && !isLoading && (
            <div className={styles.resultsSection}>
              <ResultsList results={searchResults} />
            </div>
          )}

          {/* État vide */}
          {!searchResults && !isLoading && !error && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>🔍</div>
              <h2>Prêt à découvrir les pires établissements ?</h2>
              <p>
                Entrez une ville, un code postal ou des coordonnées GPS pour commencer
              </p>
              <div className={styles.examples}>
                <span>Exemples :</span>
                <code>Paris, France</code>
                <code>75001</code>
                <code>48.8566, 2.3522</code>
              </div>
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          <p>
            Made with ❤️ pour découvrir les pires expériences client
          </p>
        </footer>
      </div>
    </>
  );
}