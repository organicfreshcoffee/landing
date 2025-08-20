import * as THREE from 'three';
import { ModelLoader } from '../utils/modelLoader';
import { CubeConfig } from '../config/cubeConfig';
import { CubePosition } from './cubeFloorRenderer';
import { StairTile } from '../types/api';

export interface StairRenderOptions {
  direction: string;
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
    direction: 'upward',
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
    tiles: StairTile[],
    options: StairRenderOptions = {
      direction: '' // upward or downward
    }
  ): Promise<THREE.Group> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const stairGroup = new THREE.Group();
    stairGroup.name = 'stairs';

    
    let stairCount = 0;
    // TypeError: tiles is not iterable
    for (const stair of tiles) {
      try {
        const stairMesh = await this.renderRoomStairs(stair, opts);
        if (stairMesh) {
          stairGroup.add(stairMesh);
          stairCount++;
                  } else {
          console.warn(`⚠️ Failed to create stairs`);
        }
      } catch (error) {
        console.warn(`❌ Exception rendering stairs :`, error);
      }
    }

    scene.add(stairGroup);
            
    // Debug: Check scene hierarchy
        
    return stairGroup;
  }

  /**
   * Render stairs for a single room
   */
  private static async renderRoomStairs(
    tile: StairTile,
    options: Required<StairRenderOptions>
  ): Promise<THREE.Group | null> {
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
      const gridX = tile.x;
      const gridY = tile.y;
      const worldX = gridX * cubeSize + cubeSize / 2;
      const worldZ = gridY * cubeSize + cubeSize / 2;
      
      // Different positioning for upward vs downward stairs
      let worldY: number;
      // use options where we stored direction upward or downward
      if (options.direction === "downward") {
        // For downward stairs, position at floor level (as if going down)
        worldY = options.yOffset! + scaledModelBottomOffset;
              } else {
        // For upward stairs, position on top of floor cube
        worldY = options.yOffset! + cubeSize + scaledModelBottomOffset;
              }

      stairModel.position.set(worldX - cubeSize, worldY, worldZ);

      // Add metadata for debugging and positioning
      stairModel.userData = {
        type: 'stairs',
        direction: options.direction,
        roomName: tile.room_name,
        roomId: tile.room_id,
        stairLocationX: tile.x,
        stairLocationY: tile.y,
        // Store world coordinates for player positioning
        worldX: worldX - cubeSize,
        worldY: worldY,
        worldZ: worldZ,
        // Add stair type flags for easier searching
        hasUpwardStair: options.direction === 'upward',
        hasDownwardStair: options.direction === 'downward'
      };

      console.log(
        `[stair] 🏗️ Placed ${options.direction === "downward" ? 'downward' : 'upward'} stairs at grid (${gridX}, ${gridY}) -> world (${worldX.toFixed(1)}, ${worldY.toFixed(1)}, ${worldZ.toFixed(1)})`
      );
      console.log(
        `[stair] 📏 Stair model: original=${modelWidth.toFixed(1)}×${modelHeight.toFixed(1)}×${modelDepth.toFixed(1)}, scales=(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)}, ${scaleZ.toFixed(2)})`
      );
      console.log(
        `[stair] 🎯 Target: cube=${cubeSize}×${cubeSize}, wall height=${wallHeight}`
      );

      return stairModel;
    } catch (error) {
      console.error(`Failed to create stairs:`, error);
      return null;
    }
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
    
      }
}
