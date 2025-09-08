import { useState } from 'react';
import styles from '../styles/ArtCredits.module.css';

export default function ArtCredits() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={styles.artCreditsContainer}>
      <div className={styles.artCreditsHeader}>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className={styles.artCreditsToggle}
        >
          🎨 Art Credits {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div className={styles.artCreditsContent}>
          <h3>Art Credits</h3>
          
          <h4>Playable Characters</h4>
          
          <div className={styles.creditEntry}>
            <h5>last-guardian-sprites</h5>
            <p>
              <a href="https://opengameart.org/content/700-sprites" target="_blank" rel="noopener noreferrer">
                https://opengameart.org/content/700-sprites
              </a>
            </p>
            <p><strong>License:</strong> CC-BY 3.0</p>
            <p><strong>Author:</strong> Philipp Lenssen<br />
              <a href="http://outer-court.com" target="_blank" rel="noopener noreferrer">
                outer-court.com
              </a>
            </p>
          </div>

          <h4>Monsters / Enemies</h4>
          
          <div className={styles.creditEntry}>
            <h5>Pixel Adventure 2</h5>
            <p>
              <a href="https://pixelfrog-assets.itch.io/pixel-adventure-2" target="_blank" rel="noopener noreferrer">
                https://pixelfrog-assets.itch.io/pixel-adventure-2
              </a>
            </p>
            <p><strong>License:</strong> Creative Commons Zero (CC0)<br />
              <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">
                https://creativecommons.org/publicdomain/zero/1.0/
              </a>
            </p>
            <p><strong>Author:</strong> Pixel Frog<br />
              <a href="https://pixelfrog-assets.itch.io/" target="_blank" rel="noopener noreferrer">
                https://pixelfrog-assets.itch.io/
              </a><br />
              hipixelfrog@gmail.com
            </p>
          </div>

          <div className={styles.creditEntry}>
            <h5>Stendhal Animals</h5>
            <p>
              <a href="https://opengameart.org/content/stendhal-animals" target="_blank" rel="noopener noreferrer">
                https://opengameart.org/content/stendhal-animals
              </a>
            </p>
            <p><strong>License:</strong> CC-BY-SA 3.0</p>
            <p><strong>Author:</strong> Kimmo Rundelin (kiheru)</p>
          </div>

          <h4>Items</h4>
          
          <div className={styles.creditEntry}>
            <h5>Raven Fantasy Icons</h5>
            <p>
              <a href="https://clockworkraven.itch.io/raven-fantasy-icons" target="_blank" rel="noopener noreferrer">
                https://clockworkraven.itch.io/raven-fantasy-icons
              </a>
            </p>
            <p><strong>License:</strong> 
              <a href="https://drive.google.com/drive/folders/121s8vaEk2h2Y-3cHDlfkKcwojsySYh3q" target="_blank" rel="noopener noreferrer">
                https://drive.google.com/drive/folders/121s8vaEk2h2Y-3cHDlfkKcwojsySYh3q
              </a>
            </p>
            <p><strong>Author:</strong> Clockwork Raven<br />
              <a href="https://clockworkraven.itch.io/" target="_blank" rel="noopener noreferrer">
                https://clockworkraven.itch.io/
              </a><br />
              @cwrstudios.bsky.social
            </p>
          </div>

          <h4>Textures</h4>
          
          <div className={styles.creditEntry}>
            <h5>Textures</h5>
            <p>
              <a href="https://opengameart.org/content/isometric-wall-texture-pack" target="_blank" rel="noopener noreferrer">
                https://opengameart.org/content/isometric-wall-texture-pack
              </a>
            </p>
            <p><strong>License:</strong> CC0</p>
            <p><strong>Author:</strong> Screaming Brain Studios</p>
          </div>

          <h4>3D Models</h4>
          
          <div className={styles.creditEntry}>
            <h5>Stairs</h5>
            <p>
              <a href="https://www.kenney.nl/assets/medieval-town-base" target="_blank" rel="noopener noreferrer">
                https://www.kenney.nl/assets/medieval-town-base
              </a>
            </p>
            <p><strong>License:</strong> CC0</p>
            <p><strong>Author:</strong> Kenney Vleugels<br />
              <a href="https://www.kenney.nl" target="_blank" rel="noopener noreferrer">
                www.kenney.nl
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
