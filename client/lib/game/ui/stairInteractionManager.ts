import * as THREE from 'three';
import { ServerRoom } from '../types/generator';
import { CubeConfig } from '../config/cubeConfig';

export interface StairInteractionData {
  roomId: string;
  roomName: string;
  stairType: 'upward' | 'downward';
  position: THREE.Vector3;
  gridPosition: { x: number; y: number };
}

/**
 * Manages stair interactions including proximity detection and UI popups
 */
export class StairInteractionManager {
  private static instance: StairInteractionManager;
  private stairs: Map<string, StairInteractionData> = new Map();
  private nearbyStair: StairInteractionData | null = null;
  private interactionPopup: HTMLDivElement | null = null;
  private readonly INTERACTION_DISTANCE = 12.5; // Distance in world units (accounting for cube size)
  
  // Interaction callbacks
  private onUpstairsCallback: ((stairData: StairInteractionData) => void) | null = null;
  private onDownstairsCallback: ((stairData: StairInteractionData) => void) | null = null;
  
  private constructor() {
    console.log(`[popup] StairInteractionManager constructor called`);
    this.createInteractionPopup();
    this.setupKeyListener();
    console.log(`[popup] StairInteractionManager fully initialized`);
  }

  static getInstance(): StairInteractionManager {
    if (!this.instance) {
      this.instance = new StairInteractionManager();
    }
    return this.instance;
  }

  /**
   * Initialize stairs from room data
   */
  initializeStairs(rooms: ServerRoom[]): void {
    this.stairs.clear();
    
    rooms.forEach(room => {
      if ((room.hasUpwardStair || room.hasDownwardStair) && 
          room.stairLocationX !== undefined && 
          room.stairLocationY !== undefined) {
        
        const cubeSize = CubeConfig.getCubeSize();
        const gridX = room.position.x + room.stairLocationX;
        const gridY = room.position.y + room.stairLocationY;
        const worldX = gridX * cubeSize + cubeSize / 2;
        const worldZ = gridY * cubeSize + cubeSize / 2;
        const worldY = room.hasDownwardStair ? 0 : cubeSize;
        
        const stairData: StairInteractionData = {
          roomId: room.id,
          roomName: room.name,
          stairType: room.hasUpwardStair ? 'upward' : 'downward',
          position: new THREE.Vector3(worldX, worldY, worldZ),
          gridPosition: { x: gridX, y: gridY }
        };
        
        const key = `${room.id}_${gridX}_${gridY}`;
        this.stairs.set(key, stairData);
        
        console.log(`🏗️ Registered ${stairData.stairType} stair: ${room.name} at (${gridX}, ${gridY}) -> world (${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ.toFixed(1)})`);
      }
    });
    
    console.log(`✅ StairInteractionManager: Initialized ${this.stairs.size} stairs`);
  }

  /**
   * Update player position and check for nearby stairs
   */
  updatePlayerPosition(playerPosition: THREE.Vector3): void {
    // Debug logging - log every 180 frames (about once per 3 seconds at 60fps)
    if (Math.random() < 0.0056) { // ~1/180 chance
      console.log(`[popup] Player position: (${playerPosition.x.toFixed(1)}, ${playerPosition.y.toFixed(1)}, ${playerPosition.z.toFixed(1)})`);
      console.log(`[popup] Total stairs available: ${this.stairs.size}`);
      
      // Log all stair positions
      this.stairs.forEach((stair, key) => {
        const distance = playerPosition.distanceTo(stair.position);
        console.log(`[popup] Stair ${key}: ${stair.stairType} at (${stair.position.x.toFixed(1)}, ${stair.position.y.toFixed(1)}, ${stair.position.z.toFixed(1)}) - distance: ${distance.toFixed(2)}`);
      });
    }
    
    let closestStair: StairInteractionData | null = null;
    let closestDistance = this.INTERACTION_DISTANCE;
    
    // Check distance to all stairs
    this.stairs.forEach(stair => {
      const distance = playerPosition.distanceTo(stair.position);
      if (distance < closestDistance) {
        closestStair = stair;
        closestDistance = distance;
      }
    });
    
    // Update nearby stair state
    if (closestStair !== this.nearbyStair) {
      this.nearbyStair = closestStair;
      console.log(`[popup] Nearby stair changed: ${closestStair ? 'found stair' : 'none'}`);
      this.updateInteractionUI();
    }
  }

  /**
   * Set callback functions for stair interactions
   */
  setCallbacks(
    onUpstairs: ((stairData: StairInteractionData) => void) | null,
    onDownstairs: ((stairData: StairInteractionData) => void) | null
  ): void {
    this.onUpstairsCallback = onUpstairs;
    this.onDownstairsCallback = onDownstairs;
  }

  /**
   * Create the interaction popup element
   */
  private createInteractionPopup(): void {
    this.interactionPopup = document.createElement('div');
    this.interactionPopup.id = 'stair-interaction-popup';
    this.interactionPopup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2000;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      font-weight: bold;
      color: #ffffff;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(40, 40, 40, 0.9));
      padding: 15px 25px;
      border-radius: 8px;
      border: 2px solid #4a90e2;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      display: none;
      text-align: center;
      min-width: 200px;
      animation: fadeIn 0.3s ease-out;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      
      #stair-interaction-popup.upward {
        border-color: #f39c12;
        background: linear-gradient(135deg, rgba(243, 156, 18, 0.2), rgba(40, 40, 40, 0.9));
      }
      
      #stair-interaction-popup.downward {
        border-color: #e74c3c;
        background: linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(40, 40, 40, 0.9));
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(this.interactionPopup);
    console.log(`[popup] StairInteractionManager created, popup element added to DOM`);
  }

  /**
   * Update the interaction UI based on nearby stairs
   */
  private updateInteractionUI(): void {
    console.log(`[popup] updateInteractionUI called, nearbyStair: ${this.nearbyStair ? `${this.nearbyStair.stairType} stair` : 'null'}`);
    
    if (!this.interactionPopup) {
      console.log(`[popup] ERROR: interactionPopup element is null!`);
      return;
    }
    
    if (this.nearbyStair) {
      const isUpward = this.nearbyStair.stairType === 'upward';
      const actionText = isUpward ? 'go upstairs' : 'go downstairs';
      const icon = isUpward ? '⬆️' : '⬇️';
      
      console.log(`[popup] Showing popup for ${this.nearbyStair.stairType} stair: "${actionText}"`);
      
      this.interactionPopup.innerHTML = `
        <div style="margin-bottom: 5px;">${icon}</div>
        <div>Press <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">E</span> to ${actionText}</div>
      `;
      
      // Set appropriate styling
      this.interactionPopup.className = this.nearbyStair.stairType;
      this.interactionPopup.style.display = 'block';
      
      console.log(`🔍 Near ${this.nearbyStair.stairType} stair in ${this.nearbyStair.roomName}`);
    } else {
      console.log(`[popup] Hiding popup - no nearby stair`);
      this.interactionPopup.style.display = 'none';
    }
  }

  /**
   * Set up keyboard listener for E key
   */
  private setupKeyListener(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyE' && this.nearbyStair) {
        event.preventDefault();
        this.handleStairInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Handle stair interaction when E is pressed
   */
  private handleStairInteraction(): void {
    if (!this.nearbyStair) return;
    
    console.log(`🏃 Player interacting with ${this.nearbyStair.stairType} stair in ${this.nearbyStair.roomName}`);
    
    if (this.nearbyStair.stairType === 'upward' && this.onUpstairsCallback) {
      this.onUpstairsCallback(this.nearbyStair);
    } else if (this.nearbyStair.stairType === 'downward' && this.onDownstairsCallback) {
      this.onDownstairsCallback(this.nearbyStair);
    }
    
    // Hide the popup after interaction
    if (this.interactionPopup) {
      this.interactionPopup.style.display = 'none';
    }
  }

  /**
   * Force hide the popup (useful during scene transitions)
   */
  forceHidePopup(): void {
    if (this.interactionPopup) {
      this.interactionPopup.style.display = 'none';
      console.log(`[popup] Force hiding popup during scene transition`);
    }
  }

  /**
   * Get debug information about current stair interactions
   */
  getDebugInfo(): {
    totalStairs: number;
    nearbyStair: StairInteractionData | null;
    stairs: Array<{ key: string; data: StairInteractionData }>;
  } {
    return {
      totalStairs: this.stairs.size,
      nearbyStair: this.nearbyStair,
      stairs: Array.from(this.stairs.entries()).map(([key, data]) => ({ key, data }))
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.interactionPopup) {
      this.interactionPopup.remove();
      this.interactionPopup = null;
    }
    
    this.stairs.clear();
    this.nearbyStair = null;
    this.onUpstairsCallback = null;
    this.onDownstairsCallback = null;
    
    console.log('🧹 StairInteractionManager resources cleaned up');
  }
}
