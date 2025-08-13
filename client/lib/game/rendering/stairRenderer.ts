import * as THREE from 'three';
import { ModelLoader } from '../utils/modelLoader';
import { ServerRoom } from '../types/generator';
import { CubeConfig } from '../config/cubeConfig';
import { CubePosition } from './cubeFloorRenderer';

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

      console.log(`🏗️ Stair model loaded successfully, children count: ${model.children.length}`);
      
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

    console.log(`🏗️ StairRenderer: Checking ${rooms.length} rooms for stairs...`);

    // First, let's see which rooms have stairs
    const roomsWithStairs = rooms.filter(room => this.hasStairs(room));
    console.log(`🏗️ Found ${roomsWithStairs.length} rooms with stairs:`, 
      roomsWithStairs.map(r => `${r.name}(${r.stairLocationX},${r.stairLocationY})`));

    let stairCount = 0;
    for (const room of rooms) {
      if (this.hasStairs(room)) {
        try {
          console.log(`🏗️ Rendering stairs for room ${room.name}...`);
          const stairMesh = await this.renderRoomStairs(room, opts);
          if (stairMesh) {
            stairGroup.add(stairMesh);
            stairCount++;
            console.log(`✅ Successfully added stairs for room ${room.name}`);
          } else {
            console.warn(`⚠️ Failed to create stairs for room ${room.name}`);
          }
        } catch (error) {
          console.warn(`❌ Exception rendering stairs for room ${room.name}:`, error);
        }
      }
    }

    scene.add(stairGroup);
    console.log(`✅ StairRenderer: Added stair group to scene with ${stairCount} stair models`);
    console.log(`🔍 Stair group info: name="${stairGroup.name}", children=${stairGroup.children.length}, visible=${stairGroup.visible}`);
    
    // Debug: Check scene hierarchy
    console.log(`🔍 Scene now has ${scene.children.length} top-level objects`);
    
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
      
      // Calculate bounding box to determine original model dimensions
      const box = new THREE.Box3().setFromObject(stairModel);
      const modelWidth = box.max.x - box.min.x;
      const modelHeight = box.max.y - box.min.y;
      const modelDepth = box.max.z - box.min.z;
      const modelBottomOffset = -box.min.y; // Offset to place bottom of model at Y=0

      // Calculate scale factors to fit cube dimensions
      const cubeSize = CubeConfig.getCubeSize();
      const wallHeight = CubeConfig.getWallHeight();

      const scaleX = cubeSize / modelWidth;  // Fit to cube width
      const scaleY = cubeSize / modelHeight; // Fit to cube height
      const scaleZ = cubeSize / modelDepth;  // Fit to cube depth

      // Scale the model appropriately
      stairModel.scale.set(scaleX, scaleY, scaleZ);

      // Recalculate bounding box after scaling
      const scaledBox = new THREE.Box3().setFromObject(stairModel);
      const scaledModelBottomOffset = -scaledBox.min.y;

      // Position the stairs at the specified location
      // Use the same coordinate calculation as in getExcludedFloorCoordinates()
      const gridX = room.position.x + room.stairLocationX;
      const gridY = room.position.y + room.stairLocationY;
      const worldX = gridX * cubeSize + cubeSize / 2;
      const worldZ = gridY * cubeSize + cubeSize / 2;
      
      // Different positioning for upward vs downward stairs
      let worldY: number;
      if (room.hasDownwardStair) {
        // For downward stairs, position at floor level (as if going down)
        worldY = options.yOffset! + scaledModelBottomOffset;
        console.log(`⬇️ Positioning downward stairs at floor level for room ${room.name}`);
      } else {
        // For upward stairs, position on top of floor cube
        worldY = options.yOffset! + cubeSize + scaledModelBottomOffset;
        console.log(`⬆️ Positioning upward stairs on top of floor cube for room ${room.name}`);
      }

      stairModel.position.set(worldX - cubeSize, worldY, worldZ);

      // Add metadata for debugging and positioning
      stairModel.userData = {
        type: 'stairs',
        roomName: room.name,
        roomId: room.id,
        hasUpwardStair: room.hasUpwardStair,
        hasDownwardStair: room.hasDownwardStair,
        stairLocationX: room.stairLocationX,
        stairLocationY: room.stairLocationY,
        // Store world coordinates for player positioning
        worldX: worldX - cubeSize,
        worldY: worldY,
        worldZ: worldZ
      };

      console.log(
        `[stair] 🏗️ Placed ${room.hasDownwardStair ? 'downward' : 'upward'} stairs for room ${room.name} at grid (${gridX}, ${gridY}) -> world (${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ.toFixed(1)})`
      );
      console.log(
        `[stair] 📏 Stair model: original=${modelWidth.toFixed(1)}×${modelHeight.toFixed(1)}×${modelDepth.toFixed(1)}, scales=(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}, ${scaleZ.toFixed(2)})`
      );
      console.log(
        `[stair] 🎯 Target: cube=${cubeSize}×${cubeSize}, wall height=${wallHeight}`
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
    const hasStairs = room.hasUpwardStair || room.hasDownwardStair;
    if (hasStairs) {
      console.log(`🔍 Room ${room.name} has stairs: upward=${room.hasUpwardStair}, downward=${room.hasDownwardStair}, location=(${room.stairLocationX},${room.stairLocationY})`);
    }
    return hasStairs;
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
   * Get stair coordinates that should be excluded from floor cube rendering
   * (for downward stairs only)
   */
  static getExcludedFloorCoordinates(rooms: ServerRoom[]): CubePosition[] {
    const excludedCoords: CubePosition[] = [];
    
    console.log(`🔍 Checking ${rooms.length} rooms for downward stairs to exclude...`);
    
    rooms.forEach(room => {
      console.log(`🔍 Room ${room.name}: hasUpwardStair=${room.hasUpwardStair}, hasDownwardStair=${room.hasDownwardStair}, stairLocationX=${room.stairLocationX}, stairLocationY=${room.stairLocationY}`);
      
      if (room.hasDownwardStair && 
          room.stairLocationX !== undefined && 
          room.stairLocationY !== undefined) {
        const coord = {
          x: room.position.x + room.stairLocationX,
          y: room.position.y + room.stairLocationY
        };
        excludedCoords.push(coord);
        console.log(`🚫 Excluding floor cube at (${coord.x}, ${coord.y}) for downward stairs in room ${room.name}`);
      }
    });
    
    console.log(`🚫 Total excluded coordinates from StairRenderer: ${excludedCoords.length}`, excludedCoords);
    return excludedCoords;
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
    
    // Also dispose of ModelLoader resources
    ModelLoader.dispose();
    
    console.log('🧹 Stair renderer resources cleaned up');
  }
}
