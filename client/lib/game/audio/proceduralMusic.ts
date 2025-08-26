/**
 * Procedural Music Manager using Strudel
 * Generates music based on dungeon data (layout, tiles, floor names)
 */

import { DungeonNode, FloorLayoutResponse, GeneratedFloorTilesResponse, FloorTile, WallTile } from '../types/api';

// Dynamic imports to avoid build-time issues
let strudelInitialized = false;
let mini: any = null;
let initStrudel: any = null;
let hush: any = null;
let strudelRepl: any = null;

/**
 * Initialize Strudel if not already initialized
 */
async function ensureStrudelInitialized(): Promise<boolean> {
  if (!strudelInitialized) {
    try {
      console.log('🎵 Initializing Strudel with samples...');
      
      // Dynamic import of Strudel modules
      const webModule = await import('@strudel/web');
      const miniModule = await import('@strudel/mini');
      
      // Initialize Strudel web audio
      initStrudel = webModule.initStrudel;
      mini = miniModule.mini;
      hush = webModule.hush;
      
      if (initStrudel) {
        await initStrudel();
        strudelInitialized = true;
        console.log('✅ Strudel initialized successfully with samples');
        
        // Check if we have access to any global scheduling functions
        console.log('🔍 Checking for global Strudel functions...');
        const globalKeys = Object.keys(globalThis);
        const strudelFunctions = globalKeys.filter(key => 
          key.toLowerCase().includes('strudel') || 
          key.includes('setCps') || 
          key.includes('setPattern') ||
          key.includes('scheduler') ||
          key.includes('repl')
        );
        console.log('🔍 Found Strudel-related globals:', strudelFunctions);
        
        return true;
      } else {
        throw new Error('initStrudel function not found');
      }
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
  
  // Validate and sanitize parameters
  console.log('🔍 Pattern generation params:', {
    tempo,
    scale,
    bassPattern,
    drumPattern,
    melodyNotes,
    harmony,
    effects
  });
  
  // Ensure safe values for Strudel
  const safeTempo = Math.max(60, Math.min(180, tempo));
  const safeScale = ['major', 'minor', 'pentatonic'].includes(scale) ? scale : 'major';
  const safeFilter = Math.max(200, Math.min(2000, effects.filter));
  const safeReverb = Math.max(0, Math.min(1, effects.reverb));
  
  // Convert melody notes to pattern string
  const melodyPattern = melodyNotes.join(' ');
  
  // Select drum samples based on dungeon characteristics
  const kickSamples = ['bd:0', 'bd:1', 'bd:2', 'bd:3'];
  const hihatSamples = ['hh:0', 'hh:1', 'hh:2', 'hh:3'];
  const snareSamples = ['sd:0', 'sd:1', 'sd:2', 'sd:3'];
  const percSamples = ['perc:0', 'perc:1', 'perc:2', 'perc:3'];
  
  // Select samples based on tempo and complexity
  const tempoClass = params.tempo < 80 ? 'slow' : params.tempo < 100 ? 'medium' : 'fast';
  const kickSample = kickSamples[Math.floor(seededRandom(drumPattern, 0, kickSamples.length))];
  const hihatSample = hihatSamples[Math.floor(seededRandom(drumPattern + 'hh', 0, hihatSamples.length))];
  const snareSample = snareSamples[Math.floor(seededRandom(drumPattern + 'sd', 0, snareSamples.length))];
  const percSample = percSamples[Math.floor(seededRandom(drumPattern + 'perc', 0, percSamples.length))];
  
  // Ambient samples for atmospheric elements
  const ambientSamples = ['wind:0', 'space:0', 'pad:0', 'east:0'];
  const ambientSample = ambientSamples[Math.floor(seededRandom(scale, 0, ambientSamples.length))];
  
  // Build a pattern using mini notation syntax based on dungeon characteristics
  // Mini notation: sample names, brackets for grouping, * for repetition, ~ for silence
  // Examples: "bd", "bd hh", "[bd sd] hh*2", "bd ~ sd ~", etc.
  
  // Create a drum pattern based on room count and complexity
  let drumBase = "bd";
  if (params.melodyNotes.length > 4) {
    drumBase = "bd ~ sd ~";
  }
  if (params.melodyNotes.length > 6) {
    drumBase = "[bd bd] sd [~ bd]";
  }
  
  // Add hi-hats based on tempo
  let hihatPattern = "";
  if (params.tempo > 100) {
    hihatPattern = " hh*8";
  } else if (params.tempo > 80) {
    hihatPattern = " hh*4";
  } else {
    hihatPattern = " hh*2";
  }
  
  // Combine patterns
  const pattern = drumBase + hihatPattern;
  
  console.log('🎼 Generated Strudel pattern:', pattern);
  
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
  
  // Web Audio fallback system
  private audioContext: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private sequenceTimeouts: NodeJS.Timeout[] = [];
  private masterGain: GainNode | null = null;
  
  /**
   * Initialize the music manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.useStrudel = await ensureStrudelInitialized();
    if (!this.useStrudel) {
      // Initialize Web Audio fallback
      await this.initializeWebAudio();
    }
    this.initialized = true;
  }
  
  private async initializeWebAudio(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  private async playWebAudioMusic(floorName: string, roomCount: number): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;
    
    // Stop any existing music
    this.stopWebAudio();
    
    // Generate simple parameters
    const params = this.generateSimpleAudioParams(floorName, roomCount);
    
    // Start simple Web Audio music
    const scaleIntervals = this.getScaleIntervals(params.scale);
    const beatDuration = 60 / params.tempo;
    
    // Start bass line
    this.playSimpleBass(params, scaleIntervals, beatDuration);
    
    // Start simple melody
    setTimeout(() => {
      if (this.isPlaying) {
        this.playSimpleMelody(params, scaleIntervals, beatDuration);
      }
    }, beatDuration * 1000);
  }
  
  private generateSimpleAudioParams(floorName: string, roomCount: number) {
    let hash = 0;
    for (let i = 0; i < floorName.length; i++) {
      hash = ((hash << 5) - hash) + floorName.charCodeAt(i);
      hash = hash & hash;
    }

    const tempo = 60 + (Math.abs(hash) % 60);
    const scaleIndex = Math.abs(hash) % 3;
    const scales = ['major', 'minor', 'pentatonic'];
    
    return {
      tempo,
      scale: scales[scaleIndex],
      baseFreq: 220 + (Math.abs(hash) % 100),
      melodyNotes: [0, 2, 4, 2, 1, 3, 2, 0]
    };
  }
  
  private getScaleIntervals(scaleName: string): number[] {
    const scales: { [key: string]: number[] } = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9]
    };
    return scales[scaleName] || scales.major;
  }
  
  private playSimpleBass(params: any, scaleIntervals: number[], beatDuration: number): void {
    if (!this.audioContext || !this.masterGain) return;
    
    let beatIndex = 0;
    const bassPattern = [0, 0, 2, 0];
    
    const playBeat = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;
      
      const noteIndex = bassPattern[beatIndex % bassPattern.length];
      const interval = scaleIntervals[noteIndex % scaleIntervals.length];
      const frequency = (params.baseFreq / 2) * Math.pow(2, interval / 12);
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + beatDuration * 0.8);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + beatDuration * 0.8);
      
      this.oscillators.push(oscillator);
      this.gainNodes.push(gainNode);
      
      beatIndex++;
      
      const timeout = setTimeout(playBeat, beatDuration * 1000);
      this.sequenceTimeouts.push(timeout);
    };
    
    playBeat();
  }
  
  private playSimpleMelody(params: any, scaleIntervals: number[], beatDuration: number): void {
    if (!this.audioContext || !this.masterGain) return;
    
    let noteIndex = 0;
    
    const playNote = () => {
      if (!this.isPlaying || !this.audioContext || !this.masterGain) return;
      
      const melodyNote = params.melodyNotes[noteIndex % params.melodyNotes.length];
      const interval = scaleIntervals[melodyNote % scaleIntervals.length];
      const frequency = params.baseFreq * Math.pow(2, interval / 12);
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + beatDuration);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + beatDuration);
      
      this.oscillators.push(oscillator);
      this.gainNodes.push(gainNode);
      
      noteIndex++;
      
      const timeout = setTimeout(playNote, beatDuration * 1000);
      this.sequenceTimeouts.push(timeout);
    };
    
    playNote();
  }
  
  private stopWebAudio(): void {
    this.sequenceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.sequenceTimeouts = [];
    
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
        // Fall back to Web Audio
        const roomCount = floorLayout.data.nodes.filter(node => node.isRoom).length;
        await this.playWebAudioMusic(floorName, roomCount);
        this.isPlaying = true;
        this.currentFloor = floorName;
        return;
      }
      
      // Analyze dungeon data and generate music parameters
      const musicParams = analyzeDungeonData(floorLayout, floorTiles, floorName);
      console.log('🎵 Generated music parameters for floor:', floorName, musicParams);
      
      // Generate Strudel pattern
      const patternCode = generateStrudelPattern(musicParams);
      console.log('🎼 Generated Strudel pattern:', patternCode);
      
      // Parse and play the pattern with error handling
      try {
        console.log('🎼 Generated Strudel pattern:', patternCode);
        
        // Create the pattern using mini() - this is the correct approach
        // The issue was trying to eval raw mini notation as JavaScript
        this.currentPattern = mini(patternCode);
        console.log('🔍 Pattern created with mini():', this.currentPattern);
        console.log('🔍 Available methods:', Object.getOwnPropertyNames(this.currentPattern));
        
        // Now try to play the pattern using the available scheduler
        if (this.currentPattern && typeof this.currentPattern.query === 'function') {
          // Check what's available in the global scope for scheduling
          const globalScheduler = (globalThis as any).scheduler;
          
          console.log('🔍 Global scheduler available:', !!globalScheduler);
          
          if (globalScheduler) {
            // Let's examine what methods the scheduler has
            console.log('🔍 Scheduler methods:', Object.getOwnPropertyNames(globalScheduler));
            console.log('🔍 Scheduler prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(globalScheduler)));
            
            // Try different ways to set the pattern on the scheduler
            if (typeof globalScheduler.setPattern === 'function') {
              globalScheduler.setPattern(this.currentPattern);
              console.log('✅ Pattern set using scheduler.setPattern()');
            } else if (typeof globalScheduler.pattern === 'object' || globalScheduler.pattern === undefined) {
              globalScheduler.pattern = this.currentPattern;
              console.log('✅ Pattern set directly on scheduler.pattern');
            } else if (typeof globalScheduler.evaluate === 'function') {
              // Try using evaluate method with the pattern code
              await globalScheduler.evaluate(patternCode);
              console.log('✅ Pattern evaluated using scheduler.evaluate()');
            } else if (typeof globalScheduler.start === 'function') {
              // Maybe we need to start the scheduler first
              globalScheduler.start();
              console.log('✅ Scheduler started');
              // Try setting pattern again after starting
              if (typeof globalScheduler.setPattern === 'function') {
                globalScheduler.setPattern(this.currentPattern);
                console.log('✅ Pattern set after starting scheduler');
              }
            } else {
              console.warn('⚠️ Could not find a way to play pattern on scheduler');
              console.log('🔍 Available scheduler properties:', Object.keys(globalScheduler));
            }
          } else {
            console.warn('⚠️ No global scheduler found');
          }
        } else {
          throw new Error('Pattern does not have expected Strudel methods');
        }
        
        // Now try to play the pattern
        if (this.currentPattern && typeof this.currentPattern.query === 'function') {
          // Check what's available in the global scope for scheduling
          const globalScheduler = (globalThis as any).scheduler;
          const globalPlayer = (globalThis as any).player;
          const setCps = (globalThis as any).setCps;
          const setPattern = (globalThis as any).setPattern;
          
          console.log('🔍 Global scheduler available:', !!globalScheduler);
          console.log('🔍 Global player available:', !!globalPlayer);
          console.log('🔍 setCps function available:', !!setCps);
          console.log('🔍 setPattern function available:', !!setPattern);
          
          if (setPattern) {
            setPattern(this.currentPattern);
            console.log('✅ Pattern set using global setPattern function');
          } else if (globalScheduler && typeof globalScheduler.setPattern === 'function') {
            globalScheduler.setPattern(this.currentPattern);
            console.log('✅ Pattern set on global scheduler');
          } else {
            console.warn('⚠️ No pattern scheduling mechanism found');
            console.log('� The pattern was created but cannot be played without a scheduler');
          }
        } else {
          throw new Error('Pattern does not have expected Strudel methods');
        }
        
        this.isPlaying = true;
        this.currentFloor = floorName;
        
        console.log('🎶 Started playing procedural music for floor:', floorName);
      } catch (strudelError) {
        console.error('❌ Strudel pattern error:', strudelError);
        console.log('🔄 Falling back to Web Audio due to Strudel parse error');
        
        // Fall back to Web Audio if Strudel pattern fails
        this.useStrudel = false;
        const roomCount = floorLayout.data.nodes.filter(node => node.isRoom).length;
        await this.playWebAudioMusic(floorName, roomCount);
        this.isPlaying = true;
        this.currentFloor = floorName;
      }
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
        this.stopWebAudio();
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
   * Completely clear music state (for floor changes)
   */
  async clearMusic(): Promise<void> {
    try {
      if (!this.useStrudel) {
        this.stopWebAudio();
      } else if (this.currentPattern) {
        this.currentPattern.stop();
        this.currentPattern = null;
      }
      
      this.isPlaying = false;
      this.currentFloor = null;
      
      console.log('🗑️ Cleared music state');
    } catch (error) {
      console.error('❌ Error clearing music:', error);
    }
  }
  
  /**
   * Pause/resume music
   */
  async toggleMusic(): Promise<void> {
    try {
      if (!this.useStrudel) {
        if (this.isPlaying) {
          this.stopWebAudio();
          this.isPlaying = false;
        } else if (this.currentFloor) {
          // Resume by replaying the current floor music
          const roomCount = 3; // Default room count for resume
          await this.playWebAudioMusic(this.currentFloor, roomCount);
          this.isPlaying = true;
        }
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
    // Always return our own status
    return {
      isPlaying: this.isPlaying,
      currentFloor: this.currentFloor
    };
  }
}

// Export singleton instance
export const proceduralMusic = new ProceduralMusicManager();
