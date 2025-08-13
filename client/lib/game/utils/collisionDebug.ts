import * as THREE from 'three';

/**
 * Debug utilities for collision system
 */
export class CollisionDebug {
  private static enabled = false;

  static enable(): void {
    this.enabled = true;
    console.log('🔍 Collision debugging enabled');
  }

  static disable(): void {
    this.enabled = false;
    console.log('🔍 Collision debugging disabled');
  }

  static logCollision(
    playerPos: THREE.Vector3,
    wallCoord: { x: number; y: number },
    penetrationX: number,
    penetrationZ: number,
    correctedPos: THREE.Vector3,
    direction: string
  ): void {
    if (!this.enabled) return;

    console.log('🔥 Collision detected:', {
      playerPos: { x: playerPos.x.toFixed(2), y: playerPos.y.toFixed(2), z: playerPos.z.toFixed(2) },
      wallCoord,
      penetrationX: penetrationX.toFixed(3),
      penetrationZ: penetrationZ.toFixed(3),
      correctedPos: { x: correctedPos.x.toFixed(2), y: correctedPos.y.toFixed(2), z: correctedPos.z.toFixed(2) },
      direction
    });
  }

  static logPlayerBox(position: THREE.Vector3, playerBox: any): void {
    if (!this.enabled) return;

    console.log('👤 Player box:', {
      position: { x: position.x.toFixed(2), y: position.y.toFixed(2), z: position.z.toFixed(2) },
      min: { x: playerBox.min.x.toFixed(2), y: playerBox.min.y.toFixed(2), z: playerBox.min.z.toFixed(2) },
      max: { x: playerBox.max.x.toFixed(2), y: playerBox.max.y.toFixed(2), z: playerBox.max.z.toFixed(2) }
    });
  }
}

// Make it available globally for easy debugging
(window as any).CollisionDebug = CollisionDebug;
