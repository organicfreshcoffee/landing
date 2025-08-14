import React from 'react';
import styles from '../styles/FloorTransitionLoader.module.css';

interface FloorTransitionLoaderProps {
  isVisible: boolean;
  direction: 'upstairs' | 'downstairs';
  fromFloor: string;
  toFloor: string;
}

const FloorTransitionLoader: React.FC<FloorTransitionLoaderProps> = ({
  isVisible,
  direction,
  fromFloor,
  toFloor
}) => {
  if (!isVisible) return null;

  const directionIcon = direction === 'upstairs' ? '⬆️' : '⬇️';
  const directionText = direction === 'upstairs' ? 'Going Upstairs' : 'Going Downstairs';

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.icon}>{directionIcon}</div>
        <div className={styles.title}>{directionText}</div>
        <div className={styles.floorTransition}>
          {fromFloor} → {toFloor}
        </div>
        <div className={styles.spinner}>
          <div className={styles.spinnerRing}></div>
        </div>
        <div className={styles.loadingText}>Loading floor...</div>
      </div>
    </div>
  );
};

export default FloorTransitionLoader;
