/**
 * Procedural Music Manager using Strudel (with fallback)
 * Generates music based on dungeon data (layout, tiles, floor names)
 */

import { DungeonNode, FloorLayoutResponse, GeneratedFloorTilesResponse, FloorTile, WallTile } from '../types/api';

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
 * Simple fallback music manager using Web Audio API
 */
class SimpleFallbackMusicManager {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentFloor: string | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private generateSimpleAudioParams(floorName: string, roomCount: number) {
    let hash = 0;
    for (let i = 0; i < floorName.length; i++) {
      hash = ((hash << 5) - hash) + floorName.charCodeAt(i);
      hash = hash & hash;
    }

    const tempo = 60 + (Math.abs(hash) % 40);
    const scaleIndex = Math.abs(hash) % 4;
    const scales = ['major', 'minor', 'dorian', 'pentatonic'];
    
    return {
      tempo,
      scale: scales[scaleIndex],
      complexity: Math.min(10, roomCount),
      baseFreq: 220 + (Math.abs(hash) % 100)
    };
  }

  async playFloorMusic(floorName: string, roomCount: number): Promise<void> {
    await this.initialize();
    
    if (this.isPlaying) {
      this.stopAllOscillators();
    }

    const params = this.generateSimpleAudioParams(floorName, roomCount);
    this.createSimpleMusic(params);
    
    this.isPlaying = true;
    this.currentFloor = floorName;
    
    console.log('🎵 Started simple fallback music for floor:', floorName);
  }

  private createSimpleMusic(params: any): void {
    if (!this.audioContext) return;

    const scaleIntervals = this.getScaleIntervals(params.scale);
    
    // Create a simple bass note
    const bass = this.audioContext.createOscillator();
    const bassGain = this.audioContext.createGain();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(params.baseFreq / 2, this.audioContext.currentTime);
    bassGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    bass.connect(bassGain);
    bassGain.connect(this.audioContext.destination);
    bass.start();
    
    this.oscillators.push(bass);
    this.gainNodes.push(bassGain);
    
    // Create a simple melody
    scaleIntervals.slice(0, Math.min(4, params.complexity)).forEach((interval, index) => {
      const freq = params.baseFreq * Math.pow(2, interval / 12);
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.audioContext!.currentTime);
      gain.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
      
      osc.connect(gain);
      gain.connect(this.audioContext!.destination);
      
      // Start with delay
      osc.start(this.audioContext!.currentTime + index * 0.5);
      
      this.oscillators.push(osc);
      this.gainNodes.push(gain);
    });
  }

  private getScaleIntervals(scaleName: string): number[] {
    const scales: { [key: string]: number[] } = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      pentatonic: [0, 2, 4, 7, 9]
    };
    return scales[scaleName] || scales.major;
  }

  private stopAllOscillators(): void {
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
    });
    this.oscillators = [];
    this.gainNodes = [];
  }

  async stopMusic(): Promise<void> {
    this.stopAllOscillators();
    this.isPlaying = false;
  }

  async toggleMusic(): Promise<void> {
    if (this.isPlaying) {
      await this.stopMusic();
    } else if (this.currentFloor) {
      // Simple resume - just restart the music
      await this.playFloorMusic(this.currentFloor, 3);
    }
  }

  getStatus(): { isPlaying: boolean; currentFloor: string | null } {
    return {
      isPlaying: this.isPlaying,
      currentFloor: this.currentFloor
    };
  }
}

/**
 * Music Manager class for handling procedural dungeon music
 */
export class SimpleProceduralMusicManager {
  private currentPattern: any = null;
  private isPlaying: boolean = false;
  private currentFloor: string | null = null;
  private useStrudel: boolean = false;
  private initialized: boolean = false;
  private fallbackManager = new SimpleFallbackMusicManager();
  
  /**
   * Initialize the music manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.useStrudel = await ensureStrudelInitialized();
    if (!this.useStrudel) {
      await this.fallbackManager.initialize();
    }
    this.initialized = true;
  }
  
  /**
   * Generate and play music for a specific dungeon floor
   */
  async playFloorMusic(
    floorName: string,
    floorLayoutOrRoomCount: FloorLayoutResponse | number,
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
        const roomCount = typeof floorLayoutOrRoomCount === 'number' 
          ? floorLayoutOrRoomCount 
          : floorLayoutOrRoomCount.data.nodes.filter(node => node.isRoom).length;
        
        await this.fallbackManager.playFloorMusic(floorName, roomCount);
        const status = this.fallbackManager.getStatus();
        this.isPlaying = status.isPlaying;
        this.currentFloor = status.currentFloor;
        return;
      }
      
      // Use Strudel (when available)
      if (typeof floorLayoutOrRoomCount === 'number') {
        console.warn('⚠️ Strudel requires full floor layout data, falling back to simple music');
        await this.fallbackManager.playFloorMusic(floorName, floorLayoutOrRoomCount);
        const status = this.fallbackManager.getStatus();
        this.isPlaying = status.isPlaying;
        this.currentFloor = status.currentFloor;
        return;
      }
      
      // Analyze dungeon data and generate music parameters
      const musicParams = analyzeDungeonData(floorLayoutOrRoomCount, floorTiles, floorName);
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
        await this.fallbackManager.stopMusic();
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
   * Pause/resume music
   */
  async toggleMusic(): Promise<void> {
    try {
      if (!this.useStrudel) {
        await this.fallbackManager.toggleMusic();
        const status = this.fallbackManager.getStatus();
        this.isPlaying = status.isPlaying;
        return;
      }
      
      if (!this.currentPattern) return;
      
      if (this.isPlaying) {
        this.currentPattern.stop();
        this.isPlaying = false;
        console.log('⏸️ Paused music');
      } else {
        this.currentPattern.play();
        this.isPlaying = true;
        console.log('▶️ Resumed music');
      }
    } catch (error) {
      console.error('❌ Error toggling music:', error);
    }
  }

  /**
   * Get current music status
   */
  getStatus(): { isPlaying: boolean; currentFloor: string | null } {
    // If not initialized, always return simple music status
    if (!this.initialized || !this.useStrudel) {
      const status = this.fallbackManager.getStatus();
      return {
        isPlaying: status.isPlaying,
        currentFloor: status.currentFloor
      };
    }
    
    return {
      isPlaying: this.isPlaying,
      currentFloor: this.currentFloor
    };
  }
}

// Export singleton instance
export const simpleProceduralMusic = new SimpleProceduralMusicManager();
