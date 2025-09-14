import React from 'react';
import styles from '../styles/DeathSummary.module.css';

interface DeathSummaryProps {
  deathSummary: string;
  onContinue: () => void;
}

const DeathSummary: React.FC<DeathSummaryProps> = ({ deathSummary, onContinue }) => {
  return (
    <div className={styles.deathSummaryContainer}>
      <div className={styles.deathSummaryModal}>
        <div className={styles.skullIcon}>💀</div>
        <h1 className={styles.title}>You Died!</h1>
        <div className={styles.deathMessage}>
          {deathSummary}
        </div>
        <button 
          className={styles.continueButton}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default DeathSummary;