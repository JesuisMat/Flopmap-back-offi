// components/LoadingSpinner.js
import styles from '../styles/LoadingSpinner.module.css';

export default function LoadingSpinner() {
  return (
    <div className={styles.spinner}>
      <div className={styles.spinnerInner}>
        <div className={styles.spinnerEmoji}>🔍</div>
      </div>
    </div>
  );
}