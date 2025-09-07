import React from 'react';
import styles from '../styles/HealthHUD.module.css';

interface HealthHUDProps {
  health: number;
  maxHealth: number;
  isAlive: boolean;
  stamina: number;
  maxStamina: number;
  mana: number;
  maxMana: number;
}

export default function HealthHUD({ 
  health, 
  maxHealth, 
  isAlive, 
  stamina, 
  maxStamina, 
  mana, 
  maxMana 
}: HealthHUDProps) {
  const healthPercentage = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  const staminaPercentage = maxStamina > 0 ? (stamina / maxStamina) * 100 : 0;
  const manaPercentage = maxMana > 0 ? (mana / maxMana) * 100 : 0;
  
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

      <div className={styles.staminaLabel}>
        Stamina: {stamina}/{maxStamina}
      </div>
      <div className={styles.staminaBarContainer}>
        <div 
          className={styles.staminaBar}
          style={{
            width: `${Math.max(0, staminaPercentage)}%`,
            opacity: isAlive ? 1 : 0.5
          }}
        />
        <div className={styles.staminaBarBackground} />
      </div>

      <div className={styles.manaLabel}>
        Mana: {mana}/{maxMana}
      </div>
      <div className={styles.manaBarContainer}>
        <div 
          className={styles.manaBar}
          style={{
            width: `${Math.max(0, manaPercentage)}%`,
            opacity: isAlive ? 1 : 0.5
          }}
        />
        <div className={styles.manaBarBackground} />
      </div>

      {!isAlive && (
        <div className={styles.deathIndicator}>
          💀 DEAD
        </div>
      )}
    </div>
  );
}
