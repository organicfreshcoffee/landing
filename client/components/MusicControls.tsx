import React, { useState, useEffect } from 'react';
import { proceduralMusic } from '../lib/game/audio/proceduralMusic';
import styles from '../styles/MusicControls.module.css';

interface MusicControlsProps {
  currentFloor?: string | null;
}

export const MusicControls: React.FC<MusicControlsProps> = ({ currentFloor }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFloorName, setCurrentFloorName] = useState<string | null>(null);

  useEffect(() => {
    // Update music status when component mounts or floor changes
    const updateStatus = () => {
      try {
        const status = proceduralMusic.getStatus();
        setIsPlaying(status.isPlaying);
        setCurrentFloorName(status.currentFloor);
      } catch (error) {
        console.error('Error getting music status:', error);
        setIsPlaying(false);
        setCurrentFloorName(null);
      }
    };

    updateStatus();
    
    // Set up interval to check status periodically
    const interval = setInterval(updateStatus, 1000);
    
    return () => clearInterval(interval);
  }, [currentFloor]);

  return (
    <div className={styles.musicControls}>
      <div className={styles.status}>
        <span className={styles.label}>🎵 Music:</span>
        <span className={styles.floor}>
          {currentFloorName ? `Floor ${currentFloorName}` : 'No floor'}
        </span>
        <span className={styles.playStatus}>
          {isPlaying ? '▶️ Playing' : '⏸️ Paused'}
        </span>
      </div>
    </div>
  );
};
