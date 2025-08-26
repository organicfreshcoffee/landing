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
  private sequenceTimeouts: NodeJS.Timeout[] = [];
  private masterGain: GainNode | null = null;

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Create master gain for overall volume control
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
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

    const tempo = 60 + (Math.abs(hash) % 60); // 60-120 BPM
    const scaleIndex = Math.abs(hash) % 5;
    const scales = ['major', 'minor', 'dorian', 'pentatonic', 'blues'];
    
    // Generate melody pattern with smooth up/down movement
    const melodyLength = Math.min(8, Math.max(4, roomCount));
    const melody: number[] = [];
    
    // Create smoother melodic patterns that move gradually
    const patternType = Math.abs(hash) % 4;
    let currentNote = 2; // Start in middle of scale
    
    for (let i = 0; i < melodyLength; i++) {
      melody.push(currentNote);
      
      // Add smooth directional movement (mostly stepwise)
      switch (patternType) {
        case 0: // Gentle ascending then descending arc
          if (i < melodyLength / 2) {
            // Go up gradually
            const shouldStep = (hash + i) % 3 !== 0; // Step up 2/3 of the time
            if (shouldStep && currentNote < 5) currentNote++;
          } else {
            // Come down gradually  
            const shouldStep = (hash + i) % 3 !== 0;
            if (shouldStep && currentNote > 1) currentNote--;
          }
          break;
        case 1: // Gentle wave pattern
          const waveDirection = Math.sin(i * Math.PI / 2) > 0 ? 1 : -1;
          const shouldMove = (hash + i) % 4 !== 0; // Move 3/4 of the time
          if (shouldMove) {
            currentNote = Math.max(1, Math.min(5, currentNote + waveDirection));
          }
          break;
        case 2: // Small step pattern (mostly stepwise motion)
          const direction = ((hash + i) % 5) - 2; // -2, -1, 0, 1, 2 but mostly -1, 0, 1
          const stepSize = Math.abs(direction) > 1 ? 0 : direction; // Eliminate large jumps
          currentNote = Math.max(1, Math.min(5, currentNote + stepSize));
          break;
        case 3: // Gentle descending then ascending
          if (i < melodyLength / 2) {
            // Go down gradually
            const shouldStep = (hash + i) % 3 !== 0;
            if (shouldStep && currentNote > 1) currentNote--;
          } else {
            // Come up gradually
            const shouldStep = (hash + i) % 3 !== 0;
            if (shouldStep && currentNote < 5) currentNote++;
          }
          break;
      }
    }
    
    return {
      tempo,
      scale: scales[scaleIndex],
      complexity: Math.min(10, roomCount),
      baseFreq: 220 + (Math.abs(hash) % 100), // A3 + variation
      melody,
      bassPattern: this.generateBassPattern(hash, roomCount)
    };
  }

  private generateBassPattern(hash: number, roomCount: number): number[] {
    // Simple bass patterns based on room count
    const patterns = [
      [0, 0, 0, 0], // Simple root
      [0, 4, 0, 4], // Root and fifth
      [0, 2, 4, 2], // I-iii-V-iii
      [0, 4, 7, 4], // I-V-octave-V
    ];
    const patternIndex = Math.min(patterns.length - 1, Math.floor(roomCount / 2));
    return patterns[patternIndex];
  }

  async playFloorMusic(floorName: string, roomCount: number): Promise<void> {
    await this.initialize();
    
    if (this.isPlaying) {
      this.stopAllMusic();
    }

    const params = this.generateSimpleAudioParams(floorName, roomCount);
    this.startMusicalSequence(params);
    
    this.isPlaying = true;
    this.currentFloor = floorName;
    
    console.log('🎵 Started procedural melody for floor:', floorName, 'with params:', params);
  }

  private startMusicalSequence(params: any): void {
    if (!this.audioContext || !this.masterGain) return;

    const scaleIntervals = this.getScaleIntervals(params.scale);
    const beatDuration = 60 / params.tempo; // seconds per beat
    const noteDuration = beatDuration * 0.8; // 80% of beat duration
    
    // Start bass line
    this.playBassLine(params, scaleIntervals, beatDuration);
    
    // Start melody after a short delay
    setTimeout(() => {
      if (this.isPlaying) {
        this.playMelodyLine(params, scaleIntervals, beatDuration, noteDuration);
      }
    }, beatDuration * 1000); // Start melody after one beat
  }

  private playBassLine(params: any, scaleIntervals: number[], beatDuration: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const bassFreq = params.baseFreq / 2; // One octave lower
    let bassIndex = 0;

    const playBassNote = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const noteIndex = params.bassPattern[bassIndex % params.bassPattern.length];
      const interval = scaleIntervals[noteIndex % scaleIntervals.length];
      const frequency = bassFreq * Math.pow(2, interval / 12);

      // Create bass note
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      // Envelope: quick attack, sustain, quick release
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.02);
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + beatDuration * 0.7);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + beatDuration);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + beatDuration);
      
      this.oscillators.push(oscillator);
      this.gainNodes.push(gainNode);
      
      bassIndex++;
      
      // Schedule next bass note
      const timeout = setTimeout(playBassNote, beatDuration * 1000);
      this.sequenceTimeouts.push(timeout);
    };

    playBassNote();
  }

  private playMelodyLine(params: any, scaleIntervals: number[], beatDuration: number, noteDuration: number): void {
    if (!this.audioContext || !this.masterGain) return;

    let melodyIndex = 0;

    const playMelodyNote = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;

      const noteIndex = params.melody[melodyIndex % params.melody.length];
      const interval = scaleIntervals[noteIndex % scaleIntervals.length];
      
      // Add subtle octave variation only occasionally for interest
      let octaveShift = 0;
      const melodyPosition = melodyIndex % params.melody.length;
      
      // Very subtle octave shifts - only for occasional emphasis
      if (melodyPosition === 0 && melodyIndex > 0) {
        // Octave jump only at the start of a new melody cycle, and not the first time
        octaveShift = noteIndex >= 4 ? 12 : 0; // Up an octave for higher notes only
      } else if (melodyPosition === Math.floor(params.melody.length / 2)) {
        // Small octave drop in the middle for variation
        octaveShift = noteIndex <= 2 ? -12 : 0; // Down an octave for lower notes only
      }
      
      const frequency = params.baseFreq * Math.pow(2, (interval + octaveShift) / 12);

      // Create melody note with smoother envelope
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      // Smoother envelope for less jarring attacks
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + 0.1); // Slower attack
      gainNode.gain.setValueAtTime(0.12, this.audioContext.currentTime + noteDuration * 0.7);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + noteDuration * 1.2); // Longer release
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + noteDuration * 1.2);
      
      this.oscillators.push(oscillator);
      this.gainNodes.push(gainNode);
      
      melodyIndex++;
      
      // More varied rhythm for musical interest
      const rhythmVariation = (melodyIndex % 6 === 5) ? 1.5 : 1; // Longer note every 6th beat
      const nextBeatTime = beatDuration * rhythmVariation;
      const timeout = setTimeout(playMelodyNote, nextBeatTime * 1000);
      this.sequenceTimeouts.push(timeout);
    };

    playMelodyNote();
  }

  private getScaleIntervals(scaleName: string): number[] {
    const scales: { [key: string]: number[] } = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      pentatonic: [0, 2, 4, 7, 9],
      blues: [0, 3, 5, 6, 7, 10]
    };
    return scales[scaleName] || scales.major;
  }

  private stopAllMusic(): void {
    // Clear all timeouts
    this.sequenceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.sequenceTimeouts = [];
    
    // Stop all oscillators
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
    this.stopAllMusic();
    this.isPlaying = false;
  }

  async toggleMusic(): Promise<void> {
    if (this.isPlaying) {
      await this.stopMusic();
    } else if (this.currentFloor) {
      // Resume by replaying the current floor
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
