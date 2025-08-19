import * as THREE from 'three';

export interface TextureConfig {
  materialFolder: string;
  allowedNumbers: number[];
}

export type CubeType = 'ceiling' | 'hallway-floor' | 'room-floor' | 'wall';

export class TextureManager {
  private static textureLoader = new THREE.TextureLoader();
  private static textureCache = new Map<string, THREE.Texture>();
  
  // Define texture configurations for each cube type
  private static readonly TEXTURE_CONFIGS: Record<CubeType, TextureConfig> = {
    'ceiling': {
      materialFolder: 'Roofs',
      allowedNumbers: [1, 2, 3, 4, 7, 8, 9, 10]
    },
    'hallway-floor': {
      materialFolder: 'Stone',
      allowedNumbers: [24, 23, 18, 17]
    },
    'room-floor': {
      materialFolder: 'Stone',
      allowedNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22] // All except 24, 23, 18, 17
    },
    'wall': {
      materialFolder: 'Brick',
      allowedNumbers: [1, 2, 7, 8]
    }
  };

  /**
   * Get a random texture for the specified cube type
   */
  static getRandomTexture(cubeType: CubeType): THREE.Texture {
    const config = this.TEXTURE_CONFIGS[cubeType];
    const randomNumber = config.allowedNumbers[Math.floor(Math.random() * config.allowedNumbers.length)];
    
    return this.getTexture(config.materialFolder, randomNumber);
  }

  /**
   * Get or load a specific texture
   */
  static getTexture(materialFolder: string, number: number): THREE.Texture {
    const textureKey = `${materialFolder}_${number.toString().padStart(2, '0')}`;
    
    // Check cache first
    let texture = this.textureCache.get(textureKey);
    if (texture) {
      return texture;
    }

    // Construct the texture path
    const texturePath = this.getTexturePath(materialFolder, number);
    
    // Load the texture
    texture = this.textureLoader.load(
      texturePath,
      // onLoad
      (loadedTexture) => {
              },
      // onProgress
      undefined,
      // onError
      (error) => {
        console.error(`❌ Failed to load texture: ${texturePath}`, error);
      }
    );

    // Configure texture settings
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    // Cache the texture
    this.textureCache.set(textureKey, texture);
    
    return texture;
  }

  /**
   * Construct the path to a texture file
   */
  private static getTexturePath(materialFolder: string, number: number): string {
    const paddedNumber = number.toString().padStart(2, '0');
    
    // Map material folders to their actual names
    const folderMapping: Record<string, string> = {
      'Roofs': 'Roofs',
      'Stone': 'Stone', 
      'Brick': 'Brick'
    };
    
    const actualFolder = folderMapping[materialFolder] || materialFolder;
    
    // Calculate which sheet and position based on number
    // Each sheet has 24 textures (6 columns, 4 rows)
    // Numbers 1-24 = sheet 1, 25-48 = sheet 2, etc.
    const adjustedNumber = number - 1; // Convert to 0-based
    const sheetNumber = Math.floor(adjustedNumber / 24) + 1;
    const positionInSheet = adjustedNumber % 24;
    const row = Math.floor(positionInSheet / 6) + 1;
    const col = (positionInSheet % 6) + 1;
    
    // Handle special cases for materials with fewer sheets
    let finalSheetNumber = sheetNumber;
    if (materialFolder === 'Stone' && sheetNumber > 1) {
      // Stone only has 1 sheet, so wrap around
      finalSheetNumber = 1;
    }
    
    const filename = `Isometric ${actualFolder} ${finalSheetNumber} - 128x128_r${row}c${col}_${paddedNumber}.png`;
    return `/assets/textures/Textures/${actualFolder}/individual/${filename}`;
  }

  /**
   * Create a material with a random texture for the specified cube type
   */
  static createMaterialWithTexture(cubeType: CubeType): THREE.MeshLambertMaterial {
    const texture = this.getRandomTexture(cubeType);
    
    const material = new THREE.MeshLambertMaterial({
      map: texture
    });

    // Add metadata to identify the material type
    material.userData = {
      cubeType,
      textureKey: texture.userData?.textureKey
    };

    return material;
  }

  /**
   * Create a material with all six faces having the same texture
   */
  static createCubeMaterialWithTexture(cubeType: CubeType): THREE.MeshLambertMaterial[] {
    const texture = this.getRandomTexture(cubeType);
    
    // Create 6 materials (one for each face) with the same texture
    const materials: THREE.MeshLambertMaterial[] = [];
    
    for (let i = 0; i < 6; i++) {
      const material = new THREE.MeshLambertMaterial({
        map: texture.clone()
      });
      
      // Add metadata
      material.userData = {
        cubeType,
        faceIndex: i,
        textureKey: texture.userData?.textureKey
      };
      
      materials.push(material);
    }
    
    return materials;
  }

  /**
   * Clear the texture cache (useful for memory management)
   */
  static clearCache(): void {
    this.textureCache.forEach(texture => {
      texture.dispose();
    });
    this.textureCache.clear();
      }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.textureCache.size,
      keys: Array.from(this.textureCache.keys())
    };
  }
}
