import { useState } from 'react';
import styles from '../styles/DeathSummary.module.css';

interface DeathSummaryProps {
  deathMessage: string;
  isVisible: boolean;
  onContinue: () => void;
}

export default function DeathSummary({ deathMessage, isVisible, onContinue }: DeathSummaryProps) {
  const [isHiding, setIsHiding] = useState(false);

  const handleContinue = () => {
    setIsHiding(true);
    setTimeout(() => {
      onContinue();
      setIsHiding(false);
    }, 300); // Allow fade out animation to complete
  };

  if (!isVisible && !isHiding) {
    return null;
  }

  return (
    <div className={`${styles.overlay} ${(isVisible && !isHiding) ? styles.visible : styles.hidden}`}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>💀 You Died!</h2>
        </div>
        
        <div className={styles.content}>
          <div className={styles.deathMessage}>
            {deathMessage}
          </div>
        </div>
        
        <div className={styles.footer}>
          <button 
            onClick={handleContinue}
            className={styles.continueButton}
          >
            Continue to Character Selection
          </button>
        </div>
      </div>
    </div>
  );
}