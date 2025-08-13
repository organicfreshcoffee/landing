import * as THREE from 'three';
import { ModelLoader } from '../utils/modelLoader';
import { ServerRoom } from '../types/generator';
import { CubeConfig } from '../config/cubeConfig';

export interface StairRenderOptions {
  cubeSize?: number;
  yOffset?: number;
  stairScale?: number;
}

/**
 * Renderer for stair models in dungeon rooms
 */
export class StairRenderer {
  private static stairModel: THREE.Group | null = null;
  private static isLoading = false;
  private static loadPromise: Promise<THREE.Group> | null = null;

  private static readonly DEFAULT_OPTIONS: Required<StairRenderOptions> = {
    cubeSize: CubeConfig.getCubeSize(),
    yOffset: 0,
    stairScale: 0.8 // Scale to fit on a single cube tile
  };

  /**
   * Load the stair model from assets
   */
  private static async loadStairModel(): Promise<THREE.Group> {
    if (this.stairModel) {
      return this.stairModel.clone();
    }

    if (this.isLoading && this.loadPromise) {
      const model = await this.loadPromise;
      return model.clone();
    }

    this.isLoading = true;
    this.loadPromise = ModelLoader.loadFantasyTownAsset(
      '/assets/3d-models/kenney_medieval-town-base/Models/GLB/',
      'Stairs_Stone_01.glb'
    ).then(model => {
      if (!model) {
        throw new Error('Failed to load stair model');
      }

      // Store the template model
      this.stairModel = model;
      
      // Configure the model for proper rendering
      this.stairModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Ensure materials are properly configured
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });
            } else {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }
          }
        }
      });

      console.log('🏗️ Stair model loaded successfully');
      this.isLoading = false;
      return this.stairModel.clone();
    }).catch(error => {
      console.error('Failed to load stair model:', error);
      this.isLoading = false;
      this.loadPromise = null;
      throw error;
    });

    return this.loadPromise;
  }

  /**
   * Render stairs for all rooms that have them
   */
  static async renderStairs(
    scene: THREE.Scene,
    rooms: ServerRoom[],
    options: StairRenderOptions = {}
  ): Promise<THREE.Group> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const stairGroup = new THREE.Group();
    stairGroup.name = 'stairs';

    console.log(`🏗️ Rendering stairs for ${rooms.length} rooms...`);

    let stairCount = 0;
    for (const room of rooms) {
      if (this.hasStairs(room)) {
        try {
          const stairMesh = await this.renderRoomStairs(room, opts);
          if (stairMesh) {
            stairGroup.add(stairMesh);
            stairCount++;
          }
        } catch (error) {
          console.warn(`Failed to render stairs for room ${room.name}:`, error);
        }
      }
    }

    scene.add(stairGroup);
    console.log(`✅ Rendered ${stairCount} stair models`);
    
    return stairGroup;
  }

  /**
   * Render stairs for a single room
   */
  private static async renderRoomStairs(
    room: ServerRoom,
    options: StairRenderOptions
  ): Promise<THREE.Group | null> {
    if (!this.hasStairs(room) || 
        room.stairLocationX === undefined || 
        room.stairLocationY === undefined) {
      return null;
    }

    try {
      // Load the stair model
      const stairModel = await this.loadStairModel();
      
      // Scale the model to fit on a single cube tile
      stairModel.scale.set(
        options.stairScale!,
        options.stairScale!,
        options.stairScale!
      );

      // Position the stairs at the specified location
      const worldX = (room.position.x + room.stairLocationX) * options.cubeSize! + options.cubeSize! / 2;
      const worldZ = (room.position.y + room.stairLocationY) * options.cubeSize! + options.cubeSize! / 2;
      const worldY = options.yOffset! + options.cubeSize! / 2; // Place on top of the floor cube

      stairModel.position.set(worldX, worldY, worldZ);

      // Add metadata for debugging
      stairModel.userData = {
        type: 'stairs',
        roomName: room.name,
        roomId: room.id,
        hasUpwardStair: room.hasUpwardStair,
        hasDownwardStair: room.hasDownwardStair,
        stairLocationX: room.stairLocationX,
        stairLocationY: room.stairLocationY
      };

      console.log(
        `🏗️ Placed stairs for room ${room.name} at cube (${room.stairLocationX}, ${room.stairLocationY}) -> world (${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ.toFixed(1)})`
      );

      return stairModel;
    } catch (error) {
      console.error(`Failed to create stairs for room ${room.name}:`, error);
      return null;
    }
  }

  /**
   * Check if a room has stairs
   */
  private static hasStairs(room: ServerRoom): boolean {
    return room.hasUpwardStair || room.hasDownwardStair;
  }

  /**
   * Get statistics about rendered stairs
   */
  static getStairStats(rooms: ServerRoom[]): {
    totalRooms: number;
    roomsWithStairs: number;
    upwardStairs: number;
    downwardStairs: number;
    percentage: number;
  } {
    const totalRooms = rooms.length;
    let roomsWithStairs = 0;
    let upwardStairs = 0;
    let downwardStairs = 0;

    rooms.forEach(room => {
      if (this.hasStairs(room)) {
        roomsWithStairs++;
        if (room.hasUpwardStair) upwardStairs++;
        if (room.hasDownwardStair) downwardStairs++;
      }
    });

    return {
      totalRooms,
      roomsWithStairs,
      upwardStairs,
      downwardStairs,
      percentage: totalRooms > 0 ? (roomsWithStairs / totalRooms) * 100 : 0
    };
  }

  /**
   * Clean up stair model resources
   */
  static dispose(): void {
    if (this.stairModel) {
      this.stairModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.stairModel = null;
    }
    this.isLoading = false;
    this.loadPromise = null;
    console.log('🧹 Stair renderer resources cleaned up');
  }
}
