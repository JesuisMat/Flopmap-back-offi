// components/PlaceCard.js
import { useState } from 'react';
import styles from '../styles/PlaceCard.module.css';

export default function PlaceCard({ place, rank, viewMode }) {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const {
    name,
    rating,
    reviewCount,
    address,
    types,
    priceLevel,
    isOpen,
    photos,
    website,
    phoneNumber,
    crunchyReviews
  } = place;

  // Génération du badge de classement
  const getRankBadge = () => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  // Couleur en fonction de la note
  const getRatingColor = (rating) => {
    if (rating <= 1.5) return '#ff4444';
    if (rating <= 2.5) return '#ff8800';
    if (rating <= 3.5) return '#ffaa00';
    return '#888';
  };

  // Génération des étoiles
  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className={styles.stars}>
        {'★'.repeat(fullStars)}
        {hasHalfStar && '☆'}
        {'☆'.repeat(emptyStars)}
      </div>
    );
  };

  // Formatage des types d'établissement
  const formatTypes = (types) => {
    const typeTranslations = {
      restaurant: '🍽️ Restaurant',
      cafe: '☕ Café',
      bar: '🍺 Bar',
      hotel: '🏨 Hôtel',
      store: '🏪 Magasin',
      gas_station: '⛽ Station essence',
      pharmacy: '💊 Pharmacie',
      bank: '🏦 Banque',
      beauty_salon: '💄 Salon de beauté',
      hospital: '🏥 Hôpital'
    };

    return types
      .slice(0, 2)
      .map(type => typeTranslations[type] || type)
      .join(', ');
  };

  // Génération du niveau de prix
  const renderPriceLevel = (level) => {
    if (!level) return null;
    return '€'.repeat(level) + '€'.repeat(4 - level).split('').map(e => '○').join('');
  };

  const displayReviews = showAllReviews 
    ? crunchyReviews 
    : crunchyReviews.slice(0, 2);

  return (
    <div className={`${styles.placeCard} ${viewMode === 'grid' ? styles.gridCard : styles.listCard}`}>
      {/* Badge de classement */}
      <div className={styles.rankBadge}>
        {getRankBadge()}
      </div>

      {/* Photos */}
      {photos && photos.length > 0 && (
        <div className={styles.photoSection}>
          <img
            src={photos[currentPhotoIndex].url}
            alt={name}
            className={styles.photo}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          {photos.length > 1 && (
            <div className={styles.photoNavigation}>
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`${styles.photoNavDot} ${
                    index === currentPhotoIndex ? styles.active : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Informations principales */}
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.name}>{name}</h3>
          <div className={styles.status}>
            {isOpen !== undefined && (
              <span className={`${styles.openStatus} ${isOpen ? styles.open : styles.closed}`}>
                {isOpen ? '🟢 Ouvert' : '🔴 Fermé'}
              </span>
            )}
          </div>
        </div>

        {/* Note et avis */}
        <div className={styles.ratingSection}>
          <div className={styles.ratingMain}>
            <span 
              className={styles.ratingNumber}
              style={{ color: getRatingColor(rating) }}
            >
              {rating?.toFixed(1) || 'N/A'}
            </span>
            {renderStars(rating || 0)}
            <span className={styles.reviewCount}>
              ({reviewCount || 0} avis)
            </span>
          </div>
          
          {priceLevel && (
            <div className={styles.priceLevel}>
              {renderPriceLevel(priceLevel)}
            </div>
          )}
        </div>

        {/* Informations secondaires */}
        <div className={styles.metaInfo}>
          <div className={styles.types}>
            {formatTypes(types || [])}
          </div>
          <div className={styles.address}>
            📍 {address}
          </div>
        </div>

        {/* Contact */}
        {(website || phoneNumber) && (
          <div className={styles.contact}>
            {website && (
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.contactLink}
              >
                🌐 Site web
              </a>
            )}
            {phoneNumber && (
              <a 
                href={`tel:${phoneNumber}`}
                className={styles.contactLink}
              >
                📞 {phoneNumber}
              </a>
            )}
          </div>
        )}

        {/* Avis croustillants */}
        {crunchyReviews && crunchyReviews.length > 0 && (
          <div className={styles.reviewsSection}>
            <h4 className={styles.reviewsTitle}>
              🌶️ Avis croustillants ({crunchyReviews.length})
            </h4>
            
            <div className={styles.reviews}>
              {displayReviews.map((review, index) => (
                <div key={index} className={styles.review}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewRating}>
                      {renderStars(review.rating)}
                    </div>
                    <div className={styles.reviewTime}>
                      {review.timeAgo}
                    </div>
                  </div>
                  <p className={styles.reviewText}>
                    "{review.text}"
                  </p>
                </div>
              ))}
            </div>

            {crunchyReviews.length > 2 && (
              <button
                onClick={() => setShowAllReviews(!showAllReviews)}
                className={styles.toggleReviews}
              >
                {showAllReviews 
                  ? '▲ Voir moins d\'avis' 
                  : `▼ Voir ${crunchyReviews.length - 2} avis de plus`
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}