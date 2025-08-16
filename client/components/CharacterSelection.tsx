import { useState, useEffect, useRef } from 'react';
import styles from '../styles/CharacterSelection.module.css';

export interface CharacterData {
  type: string;
  style: number;
  name: string;
}

interface CharacterSelectionProps {
  onCharacterSelected: (character: CharacterData) => void;
  onBack: () => void;
}

// Character class mappings
const CHARACTER_CLASSES = {
  amg: 'Mage',
  avt: 'Adventurer', 
  bmg: 'Brawler',
  chr: 'Alien',
  dvl: 'Demon',
  ftr: 'Fighter',
  gsd: 'Guide',
  isd: 'Devout',
  jli: 'Jelly', // Found in sprite files
  kin: 'King',
  knt: 'Knight', // Found in sprite files
  mnt: 'Mountaineer',
  mnv: 'Maneuverer', // Found in sprite files
  mst: 'Mystic',
  nja: 'Ninja',
  npc: 'Nomad',
  pdn: 'Paladin',
  scr: 'Sorcerer', // Found in sprite files (scr instead of src)
  skl: 'Skeleton',
  smr: 'Martian',
  spd: 'Spider',
  syb: 'Necromancer',
  thf: 'Thief',
  trk: 'Cyborg',
  wmg: 'Wanderer',
  wnv: 'Barbarian',
  man: 'Human (Masculine)',
  wmn: 'Human (Feminine)', // Found in sprite files
  ybo: 'Child (Masculine)',
  ygr: 'Child (Feminine)',
  zph: 'Zeno'
};

// Animation sequence: front -> right -> back -> left
const ANIMATION_DIRECTIONS = ['fr', 'rt', 'bk', 'lf'];
const FRAMES_PER_DIRECTION = 2;
const FRAME_DURATION = 300; // ms per frame
const DIRECTION_DURATION = FRAME_DURATION * FRAMES_PER_DIRECTION * 3; // Repeat each direction 3 times

interface SpriteAnimationProps {
  characterType: string;
  style: number;
  size?: 'small' | 'large';
}

function SpriteAnimation({ characterType, style, size = 'small' }: SpriteAnimationProps) {
  const [currentDirection, setCurrentDirection] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [repeatCount, setRepeatCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev === FRAMES_PER_DIRECTION) {
          setRepeatCount(prevRepeat => {
            if (prevRepeat >= 2) { // After 3 repeats (0, 1, 2)
              setCurrentDirection(prevDir => (prevDir + 1) % ANIMATION_DIRECTIONS.length);
              return 0;
            }
            return prevRepeat + 1;
          });
          return 1;
        }
        return prev + 1;
      });
    }, FRAME_DURATION);

    return () => clearInterval(interval);
  }, []);

  const direction = ANIMATION_DIRECTIONS[currentDirection];
  const spritePath = `/assets/sprites/last-guardian-sprites/${characterType}${style}_${direction}${currentFrame}.gif`;
  
  return (
    <div className={size === 'large' ? styles.spriteContainerLarge : styles.spriteContainer}>
      <img 
        src={spritePath} 
        alt={`${CHARACTER_CLASSES[characterType as keyof typeof CHARACTER_CLASSES]} Style ${style}`}
        className={size === 'large' ? styles.spriteLarge : styles.sprite}
        onError={(e) => {
          // Fallback to first frame if animation frame doesn't exist
          (e.target as HTMLImageElement).src = `/assets/sprites/last-guardian-sprites/${characterType}${style}_fr1.gif`;
        }}
      />
    </div>
  );
}

export default function CharacterSelection({ onCharacterSelected, onBack }: CharacterSelectionProps) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);
  const [availableStyles, setAvailableStyles] = useState<number[]>([]);

  // Get available styles for a character class
  useEffect(() => {
    if (!selectedClass) return;

    const styles: number[] = [];
    // Check what styles exist for this character type (usually 1-4, but some have more or less)
    for (let i = 1; i <= 9; i++) {
      const testImg = new Image();
      testImg.onload = () => {
        if (!styles.includes(i)) {
          styles.push(i);
          styles.sort((a, b) => a - b);
          setAvailableStyles([...styles]);
        }
      };
      testImg.src = `/assets/sprites/last-guardian-sprites/${selectedClass}${i}_fr1.gif`;
    }
  }, [selectedClass]);

  const handleClassSelect = (classType: string) => {
    setSelectedClass(classType);
    setSelectedStyle(null);
    setAvailableStyles([]);
  };

  const handleStyleSelect = (style: number) => {
    setSelectedStyle(style);
  };

  const handleStartGame = () => {
    if (selectedClass && selectedStyle) {
      const characterData = {
        type: selectedClass,
        style: selectedStyle,
        name: CHARACTER_CLASSES[selectedClass as keyof typeof CHARACTER_CLASSES]
      };
      console.log('🎮 Character selected:', characterData);
      onCharacterSelected(characterData);
    }
  };

  const handleBackToClasses = () => {
    setSelectedClass(null);
    setSelectedStyle(null);
    setAvailableStyles([]);
  };

  return (
    <div className={styles.characterSelection}>
      <div className={styles.header}>
        <h1>Choose Your Character</h1>
        <button onClick={onBack} className={styles.backButton}>
          Back to Dashboard
        </button>
      </div>

      {!selectedClass ? (
        // Class selection screen
        <div className={styles.classSelection}>
          <h2>Select a Class</h2>
          <div className={styles.classGrid}>
            {Object.entries(CHARACTER_CLASSES).map(([type, name]) => (
              <div
                key={type}
                className={styles.classOption}
                onClick={() => handleClassSelect(type)}
              >
                <SpriteAnimation characterType={type} style={1} />
                <h3>{name}</h3>
                <p>{type.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Style selection screen
        <div className={styles.styleSelection}>
          <div className={styles.styleHeader}>
            <button onClick={handleBackToClasses} className={styles.backButton}>
              ← Back to Classes
            </button>
            <h2>Choose Style for {CHARACTER_CLASSES[selectedClass as keyof typeof CHARACTER_CLASSES]}</h2>
          </div>

          <div className={styles.selectedCharacterPreview}>
            {selectedStyle && (
              <SpriteAnimation 
                characterType={selectedClass} 
                style={selectedStyle} 
                size="large" 
              />
            )}
          </div>

          <div className={styles.styleGrid}>
            {availableStyles.map((style) => (
              <div
                key={style}
                className={`${styles.styleOption} ${selectedStyle === style ? styles.selected : ''}`}
                onClick={() => handleStyleSelect(style)}
              >
                <SpriteAnimation characterType={selectedClass} style={style} />
                <p>Style {style}</p>
              </div>
            ))}
          </div>

          {selectedStyle && (
            <div className={styles.startGameSection}>
              <div className={styles.selectionSummary}>
                <h3>Selected Character:</h3>
                <p>{CHARACTER_CLASSES[selectedClass as keyof typeof CHARACTER_CLASSES]} - Style {selectedStyle}</p>
              </div>
              <button onClick={handleStartGame} className={styles.startButton}>
                Start Game
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
