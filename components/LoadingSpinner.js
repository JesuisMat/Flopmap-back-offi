// components/LoadingSpinner.js - Enhanced with Bento Design
import { useState, useEffect } from 'react';
import styles from '../styles/LoadingSpinner.module.css';

export default function LoadingSpinner({ steps = [] }) {
  const [currentStep, setCurrentStep] = useState(0);
  
  const defaultSteps = [
    "🌍 Géolocalisation en cours...",
    "🔍 Recherche des établissements...",
    "⭐ Récupération des avis...",
    "🌶️ Sélection des avis croustillants...",
    "📊 Finalisation des résultats..."
  ];

  const loadingSteps = steps.length > 0 ? steps : defaultSteps;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % loadingSteps.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [loadingSteps.length]);

  return (
    <div className={styles.spinner}>
      {/* Floating particles */}
      <div className={styles.spinnerParticles}>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
        <div className={styles.particle}></div>
      </div>

      {/* Main spinner */}
      <div className={styles.spinnerContainer}>
        <div className={styles.spinnerInner}>
          <div className={styles.spinnerEmoji}>🔍</div>
        </div>
      </div>

      {/* Loading text */}
      <div className={styles.spinnerText}>
        Recherche des pires établissements
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill}></div>
      </div>

      {/* Loading steps */}
      <div className={styles.loadingMessages}>
        {loadingSteps.map((step, index) => (
          <div
            key={index}
            className={`${styles.loadingStep} ${
              index === currentStep ? styles.active : 
              index < currentStep ? styles.completed : ''
            }`}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}