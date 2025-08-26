/**
 * Procedural Music Manager using Strudel
 * Generates music based on dungeon data (layout, tiles, floor names)
 */

import { DungeonNode, FloorLayoutResponse, GeneratedFloorTilesResponse, FloorTile, WallTile } from '../types/api';

// Use dynamic import to avoid compilation issues
let simpleProceduralMusic: any = null;

/**
 * Load the simple music module dynamically
 */
async function loadSimpleMusic() {
  if (!simpleProceduralMusic) {
    try {
      const module = await import('./simpleMusic');
      simpleProceduralMusic = module.simpleProceduralMusic;
    } catch (error) {
      console.error('❌ Failed to load simple music module:', error);
    }
  }
  return simpleProceduralMusic;
}

// Dynamic imports to avoid build-time issues
let strudelInitialized = false;
let mini: any = null;
let initStrudel: any = null;

/**
 * Initialize Strudel if not already initialized
 */
async function ensureStrudelInitialized(): Promise<boolean> {
  if (!strudelInitialized) {
    try {
      console.warn('⚠️ Strudel integration temporarily disabled due to module resolution issues');
      console.log('🎵 Using simple audio fallback system');
      return false;
    } catch (error) {
      console.warn('⚠️ Failed to initialize Strudel, falling back to simple audio:', error);
      return false;
    }
  }
  return true;
}

/**
 * Generate a seeded random number between min and max
 */
function seededRandom(seed: string, min: number = 0, max: number = 1): number {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash as a seed for pseudo-random generation
  const x = Math.sin(Math.abs(hash)) * 10000;
  const random = x - Math.floor(x);
  
  return min + (random * (max - min));
}

/**
 * Generate an array of seeded random values
 */
function seededRandomArray(seed: string, length: number, min: number = 0, max: number = 1): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(seededRandom(seed + i, min, max));
  }
  return result;
}

/**
 * Convert dungeon data into musical parameters
 */
interface MusicParameters {
  tempo: number;           // BPM based on floor complexity
  scale: string;          // Musical scale based on floor name hash
  bassPattern: string;    // Bass rhythm pattern
  drumPattern: string;    // Drum pattern
  melodyNotes: number[];  // Melody note sequence
  harmony: string[];      // Chord progression
  effects: {
    reverb: number;
    filter: number;
    delay: number;
  };
}

/**
 * Analyze dungeon data and extract musical characteristics
 */
function analyzeDungeonData(
  floorLayout: FloorLayoutResponse,
  floorTiles: GeneratedFloorTilesResponse | null,
  floorName: string
): MusicParameters {
  const seed = floorName + JSON.stringify(floorLayout.data);
  
  // Count different tile types if available
  let tileComplexity = 1;
  let wallDensity = 0.5;
  let roomCount = floorLayout.data.nodes.filter(node => node.isRoom).length;
  
  if (floorTiles?.data?.tiles) {
    const tilesData = floorTiles.data.tiles;
    const totalFloorTiles = tilesData.floorTiles.length;
    const totalWallTiles = tilesData.wallTiles.length;
    const totalTiles = totalFloorTiles + totalWallTiles;
    
    wallDensity = totalWallTiles / totalTiles;
    tileComplexity = Math.min(10, Math.max(1, totalTiles / 100));
  }
  
  // Generate tempo based on complexity (60-140 BPM)
  const tempo = Math.floor(seededRandom(seed + 'tempo', 60, 140));
  
  // Choose scale based on floor name characteristics
  const scales = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian'];
  const scaleIndex = Math.floor(seededRandom(seed + 'scale', 0, scales.length));
  const rootNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const rootIndex = Math.floor(seededRandom(seed + 'root', 0, rootNotes.length));
  const scale = `${rootNotes[rootIndex]}4 ${scales[scaleIndex]}`;
  
  // Generate patterns based on room layout
  const bassComplexity = Math.min(4, roomCount);
  const bassPatterns = ['x', 'x~x~', 'x~x~x~x~', 'x~~x~x~~'];
  const bassPattern = bassPatterns[Math.min(bassComplexity - 1, bassPatterns.length - 1)];
  
  // Drum patterns based on wall density
  const drumPatterns = [
    'bd bd bd bd',
    'bd ~ sd ~',
    'bd bd sd ~',
    '[bd bd] sd [bd ~]'
  ];
  const drumIndex = Math.floor(wallDensity * drumPatterns.length);
  const drumPattern = drumPatterns[Math.min(drumIndex, drumPatterns.length - 1)];
  
  // Generate melody notes based on room positions
  const melodyLength = Math.min(8, Math.max(4, roomCount));
  const melodyNotes = seededRandomArray(seed + 'melody', melodyLength, 0, 7);
  
  // Chord progression based on tileComplexity
  const progressions = [
    ['0', '3', '4', '0'],      // Simple I-IV-V-I
    ['0', '5', '3', '4'],      // I-vi-IV-V
    ['0', '2', '3', '4'],      // I-iii-IV-V
    ['0', '4', '1', '4']       // I-V-ii-V
  ];
  const progIndex = Math.floor(tileComplexity / 3) % progressions.length;
  const harmony = progressions[progIndex];
  
  // Effects based on dungeon characteristics
  const effects = {
    reverb: seededRandom(seed + 'reverb', 0.1, 0.8),
    filter: seededRandom(seed + 'filter', 200, 2000),
    delay: seededRandom(seed + 'delay', 0, 0.4)
  };
  
  return {
    tempo,
    scale,
    bassPattern,
    drumPattern,
    melodyNotes,
    harmony,
    effects
  };
}

/**
 * Generate a Strudel pattern from musical parameters
 */
function generateStrudelPattern(params: MusicParameters): string {
  const { tempo, scale, bassPattern, drumPattern, melodyNotes, harmony, effects } = params;
  
  // Convert melody notes to pattern string
  const melodyPattern = melodyNotes.join(' ');
  
  // Build the complete pattern
  const pattern = `
setcps(${tempo / 60 / 4}); // Convert BPM to cycles per second

stack(
  // Bass line
  n("${bassPattern}").scale("${scale}").add(-12).s("sawtooth")
    .lpf(${effects.filter}).lpq(2)
    .gain(0.6),
  
  // Drums  
  s("${drumPattern}").bank("RolandTR808")
    .gain(0.8),
  
  // Melody
  n("${melodyPattern}").scale("${scale}").s("triangle")
    .lpf(${effects.filter * 2}).lpq(1)
    .delay(${effects.delay}).delaytime(0.25)
    .gain(0.5),
  
  // Harmony/Chords
  n("${harmony.join(' ')}").scale("${scale}").chord("M").s("square")
    .lpf(${effects.filter * 1.5}).lpq(3)
    .gain(0.4)
).room(${effects.reverb})
`.trim();
  
  return pattern;
}

/**
 * Music Manager class for handling procedural dungeon music
 */
export class ProceduralMusicManager {
  private currentPattern: any = null;
  private isPlaying: boolean = false;
  private currentFloor: string | null = null;
  private useStrudel: boolean = false;
  private initialized: boolean = false;
  
  /**
   * Initialize the music manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.useStrudel = await ensureStrudelInitialized();
    if (!this.useStrudel) {
      const simpleMusicManager = await loadSimpleMusic();
      if (simpleMusicManager && typeof simpleMusicManager.initialize === 'function') {
        await simpleMusicManager.initialize();
      } else {
        console.error('❌ simpleProceduralMusic not available for initialization');
      }
    }
    this.initialized = true;
  }
  
  /**
   * Generate and play music for a specific dungeon floor
   */
  async playFloorMusic(
    floorName: string,
    floorLayout: FloorLayoutResponse,
    floorTiles: GeneratedFloorTilesResponse | null = null
  ): Promise<void> {
    try {
      // Stop current music if playing different floor
      if (this.currentFloor !== floorName && this.isPlaying) {
        await this.stopMusic();
      }
      
      // Don't regenerate if already playing this floor
      if (this.currentFloor === floorName && this.isPlaying) {
        return;
      }
      
      await this.initialize();
      
      if (!this.useStrudel) {
        // Fall back to simple music
        const simpleMusicManager = await loadSimpleMusic();
        if (simpleMusicManager && typeof simpleMusicManager.playFloorMusic === 'function') {
          const roomCount = floorLayout.data.nodes.filter(node => node.isRoom).length;
          await simpleMusicManager.playFloorMusic(floorName, roomCount);
          // Update our local status to match the simple music manager
          if (typeof simpleMusicManager.getStatus === 'function') {
            const status = simpleMusicManager.getStatus();
            this.isPlaying = status.isPlaying;
            this.currentFloor = status.currentFloor;
          } else {
            // Fallback status
            this.isPlaying = true;
            this.currentFloor = floorName;
          }
        } else {
          console.error('❌ simpleProceduralMusic not available for playFloorMusic');
          this.isPlaying = false;
          this.currentFloor = null;
        }
        return;
      }
      
      // Analyze dungeon data and generate music parameters
      const musicParams = analyzeDungeonData(floorLayout, floorTiles, floorName);
      console.log('🎵 Generated music parameters for floor:', floorName, musicParams);
      
      // Generate Strudel pattern
      const patternCode = generateStrudelPattern(musicParams);
      console.log('🎼 Generated Strudel pattern:', patternCode);
      
      // Parse and play the pattern
      this.currentPattern = mini(patternCode);
      this.currentPattern.play();
      
      this.isPlaying = true;
      this.currentFloor = floorName;
      
      console.log('🎶 Started playing procedural music for floor:', floorName);
    } catch (error) {
      console.error('❌ Error playing floor music:', error);
      throw error;
    }
  }
  
  /**
   * Stop the currently playing music
   */
  async stopMusic(): Promise<void> {
    try {
      if (!this.useStrudel) {
        const simpleMusicManager = await loadSimpleMusic();
        if (simpleMusicManager && typeof simpleMusicManager.stopMusic === 'function') {
          await simpleMusicManager.stopMusic();
        }
      } else if (this.currentPattern) {
        this.currentPattern.stop();
        this.currentPattern = null;
      }
      
      this.isPlaying = false;
      // Don't clear this.currentFloor - keep it for resuming
      
      console.log('🔇 Stopped procedural music');
    } catch (error) {
      console.error('❌ Error stopping music:', error);
    }
  }

  /**
   * Get current music status
   */
  async getStatus(): Promise<{ isPlaying: boolean; currentFloor: string | null }> {
    // If not initialized, always return simple music status
    if (!this.initialized || !this.useStrudel) {
      const simpleMusicManager = await loadSimpleMusic();
      // Check if simpleProceduralMusic is available
      if (simpleMusicManager && typeof simpleMusicManager.getStatus === 'function') {
        const status = simpleMusicManager.getStatus();
        return {
          isPlaying: status.isPlaying,
          currentFloor: status.currentFloor
        };
      } else {
        // Fallback if import failed
        console.warn('⚠️ simpleProceduralMusic not available, returning default status');
        return {
          isPlaying: false,
          currentFloor: null
        };
      }
    }
    
    return {
      isPlaying: this.isPlaying,
      currentFloor: this.currentFloor
    };
  }
}

// Export singleton instance
export const proceduralMusic = new ProceduralMusicManager();
