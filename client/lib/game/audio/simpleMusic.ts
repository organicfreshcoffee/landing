/**
 * Simple Audio Manager as fallback for Strudel integration
 * This provides basic audio functionality while Strudel integration is being set up
 */

interface SimpleAudioParams {
  tempo: number;
  scale: string;
  complexity: number;
  mood: 'calm' | 'tense' | 'mysterious' | 'epic';
}

/**
 * Simple procedural music manager using Web Audio API
 * This is a fallback until Strudel integration is working properly
 */
export class SimpleProceduralMusicManager {
  private audioContext: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentFloor: string | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];

  /**
   * Initialize the audio context
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Generate simple procedural music parameters from floor data
   */
  private generateAudioParams(floorName: string, roomCount: number, complexity: number): SimpleAudioParams {
    // Simple hash of floor name to determine characteristics
    let hash = 0;
    for (let i = 0; i < floorName.length; i++) {
      hash = ((hash << 5) - hash) + floorName.charCodeAt(i);
      hash = hash & hash;
    }

    const tempo = 60 + (Math.abs(hash) % 40); // 60-100 BPM
    const scaleIndex = Math.abs(hash) % 4;
    const scales = ['major', 'minor', 'dorian', 'pentatonic'];
    const scale = scales[scaleIndex];
    
    let mood: 'calm' | 'tense' | 'mysterious' | 'epic' = 'calm';
    if (complexity > 7) mood = 'epic';
    else if (complexity > 5) mood = 'tense';
    else if (complexity > 3) mood = 'mysterious';

    return { tempo, scale, complexity, mood };
  }

  /**
   * Create a simple tone with the Web Audio API
   */
  private createTone(frequency: number, duration: number, volume: number = 0.1): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);

    // Clean up
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  }

  /**
   * Play simple procedural music for a floor
   */
  async playFloorMusic(floorName: string, roomCount: number = 3): Promise<void> {
    try {
      if (this.currentFloor === floorName && this.isPlaying) {
        return; // Already playing this floor
      }

      await this.stopMusic();
      await this.initialize();

      const complexity = Math.min(10, roomCount + 2);
      const params = this.generateAudioParams(floorName, roomCount, complexity);
      
      console.log('🎵 Playing simple procedural music for floor:', floorName, params);

      this.isPlaying = true;
      this.currentFloor = floorName;

      // Play a simple melodic sequence
      this.playSimpleMelody(params);

    } catch (error) {
      console.error('❌ Error playing simple music:', error);
    }
  }

  /**
   * Play a simple melody based on parameters
   */
  private playSimpleMelody(params: SimpleAudioParams): void {
    if (!this.audioContext) return;

    // Simple pentatonic scale frequencies (C major pentatonic)
    const baseFreq = 261.63; // C4
    const pentatonicScale = [1, 9/8, 5/4, 3/2, 5/3]; // Major pentatonic ratios
    
    const frequencies = pentatonicScale.map(ratio => baseFreq * ratio);
    
    // Create a simple repeating pattern
    const pattern = [0, 2, 1, 3, 2, 4, 1, 0]; // Indices into the scale
    const noteDuration = 60 / params.tempo; // Quarter note duration

    let time = 0;
    pattern.forEach((noteIndex, i) => {
      setTimeout(() => {
        if (this.isPlaying && this.audioContext) {
          const freq = frequencies[noteIndex % frequencies.length];
          const volume = params.mood === 'epic' ? 0.15 : 
                        params.mood === 'tense' ? 0.12 : 0.08;
          this.createTone(freq, noteDuration * 0.8, volume);
        }
      }, time * 1000);
      time += noteDuration;
    });

    // Loop the pattern
    if (this.isPlaying) {
      setTimeout(() => {
        this.playSimpleMelody(params);
      }, time * 1000);
    }
  }

  /**
   * Stop the currently playing music
   */
  async stopMusic(): Promise<void> {
    this.isPlaying = false;
    this.currentFloor = null;
    
    // Stop all oscillators
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Already stopped
      }
    });
    
    this.gainNodes.forEach(gain => {
      try {
        gain.disconnect();
      } catch (e) {
        // Already disconnected
      }
    });
    
    this.oscillators = [];
    this.gainNodes = [];
    
    console.log('🔇 Stopped simple music');
  }

  /**
   * Toggle music on/off
   */
  async toggleMusic(): Promise<void> {
    if (this.isPlaying) {
      await this.stopMusic();
    } else if (this.currentFloor) {
      await this.playFloorMusic(this.currentFloor);
    }
  }

  /**
   * Get current status
   */
  getStatus(): { isPlaying: boolean; currentFloor: string | null } {
    return {
      isPlaying: this.isPlaying,
      currentFloor: this.currentFloor
    };
  }
}

// Export singleton instance
export const simpleProceduralMusic = new SimpleProceduralMusicManager();
