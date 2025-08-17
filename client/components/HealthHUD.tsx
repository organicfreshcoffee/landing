import React from 'react';
import styles from '../styles/HealthHUD.module.css';

interface HealthHUDProps {
  health: number;
  maxHealth: number;
  isAlive: boolean;
}

export default function HealthHUD({ health, maxHealth, isAlive }: HealthHUDProps) {
  const healthPercentage = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  
  // Determine color based on health percentage
  let healthColor = '#4ade80'; // green
  if (healthPercentage <= 25) {
    healthColor = '#ef4444'; // red
  } else if (healthPercentage <= 50) {
    healthColor = '#f59e0b'; // yellow/orange
  }

  return (
    <div className={styles.healthHUD}>
      <div className={styles.healthLabel}>
        Health: {health}/{maxHealth}
      </div>
      <div className={styles.healthBarContainer}>
        <div 
          className={styles.healthBar}
          style={{
            width: `${Math.max(0, healthPercentage)}%`,
            backgroundColor: healthColor,
            opacity: isAlive ? 1 : 0.5
          }}
        />
        <div className={styles.healthBarBackground} />
      </div>
      {!isAlive && (
        <div className={styles.deathIndicator}>
          💀 DEAD
        </div>
      )}
    </div>
  );
}
