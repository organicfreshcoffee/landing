import * as THREE from 'three';

export interface HUDOptions {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
}

/**
 * Simple HUD overlay for displaying game information
 */
export class GameHUD {
  private static instance: GameHUD;
  private hudElement: HTMLDivElement;
  private isVisible: boolean = false;

  private constructor() {
    this.hudElement = this.createHUDElement();
  }

  static getInstance(): GameHUD {
    if (!GameHUD.instance) {
      GameHUD.instance = new GameHUD();
    }
    return GameHUD.instance;
  }

  private createHUDElement(): HTMLDivElement {
    const hud = document.createElement('div');
    hud.id = 'game-hud';
    hud.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 1000;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #ffffff;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      display: none;
      pointer-events: none;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    
    document.body.appendChild(hud);
    return hud;
  }

  updateAdminMode(isAdminMode: boolean): void {
    if (isAdminMode) {
      this.showAdminModeHUD();
    } else {
      this.hideHUD();
    }
  }

  private showAdminModeHUD(): void {
    this.hudElement.innerHTML = `
      <div style="color: #ff6b6b; font-weight: bold;">🔧 ADMIN MODE</div>
      <div style="font-size: 12px; margin-top: 5px;">
        • No collision detection<br>
        • No gravity<br>
        • WASD: Move horizontally<br>
        • Space: Move up<br>
        • Shift: Move down<br>
        • Tab: Exit admin mode
      </div>
    `;
    this.hudElement.style.display = 'block';
    this.isVisible = true;
  }

  updatePlayerInfo(position: THREE.Vector3, velocity: THREE.Vector3, isGrounded: boolean, isJumping: boolean): void {
    if (!this.isVisible) return;
    
    const info = document.createElement('div');
    info.style.cssText = `
      margin-top: 10px;
      font-size: 11px;
      color: #cccccc;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 5px;
    `;
    
    info.innerHTML = `
      Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})<br>
      Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}, ${velocity.z.toFixed(1)})<br>
      Ground: ${isGrounded ? 'Yes' : 'No'} | Jumping: ${isJumping ? 'Yes' : 'No'}
    `;
    
    // Remove existing info if present
    const existingInfo = this.hudElement.querySelector('.player-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    
    info.className = 'player-info';
    this.hudElement.appendChild(info);
  }

  hideHUD(): void {
    this.hudElement.style.display = 'none';
    this.isVisible = false;
  }

  showMessage(message: string, duration: number = 3000): void {
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      font-family: 'Courier New', monospace;
      font-size: 18px;
      color: #ffffff;
      background-color: rgba(0, 0, 0, 0.8);
      padding: 20px;
      border-radius: 10px;
      pointer-events: none;
      backdrop-filter: blur(5px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      text-align: center;
    `;
    
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    
    // Fade out animation
    setTimeout(() => {
      messageElement.style.transition = 'opacity 0.5s ease-out';
      messageElement.style.opacity = '0';
      
      setTimeout(() => {
        document.body.removeChild(messageElement);
      }, 500);
    }, duration);
  }

  dispose(): void {
    if (this.hudElement && this.hudElement.parentNode) {
      this.hudElement.parentNode.removeChild(this.hudElement);
    }
  }
}
