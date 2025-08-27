import * as THREE from 'three';
import { Item } from '../types/core';
import { GameItem } from '../types/api';

export class ItemManager {
  // Item mesh references for updates and cleanup
  private static itemMeshReferences = new Map<string, THREE.Mesh>();

  // Store item references for accessing item data
  private static itemReferences = new Map<string, Item>();

  /**
   * Create sprite-based item model using a generic item sprite
   */
  static createSpriteItemModel(item: Item): { 
    model: THREE.Object3D; 
  } {
    console.log('🎒 Creating sprite item model:', {
      id: item.id,
      name: item.name,
      position: item.position
    });

    // Create item group container
    const itemGroup = new THREE.Group();
    itemGroup.name = `item_${item.id}`;
    itemGroup.userData.itemId = item.id;
    itemGroup.userData.itemData = item.data;
    
    // Set initial position
    itemGroup.position.set(item.position.x, item.position.y, item.position.z);

    // Create sprite geometry and material using the items sprite
    const spriteGeometry = new THREE.PlaneGeometry(2, 2); // Same size as enemies
    
    // Load the item texture
    const textureLoader = new THREE.TextureLoader();
    const itemTexture = textureLoader.load('/assets/sprites/items/items.png', 
      (texture) => {
        console.log(`✅ Loaded item texture for ${item.id}`);
      },
      undefined,
      (error) => {
        console.error(`❌ Failed to load item texture for ${item.id}`, error);
      }
    );
    
    // Configure texture
    itemTexture.magFilter = THREE.NearestFilter; // Pixelated look for retro sprites
    itemTexture.minFilter = THREE.NearestFilter;
    itemTexture.wrapS = THREE.ClampToEdgeWrapping;
    itemTexture.wrapT = THREE.ClampToEdgeWrapping;
    
    // Create material with transparency
    const spriteMaterial = new THREE.MeshBasicMaterial({
      map: itemTexture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });

    // Create sprite mesh
    const spriteMesh = new THREE.Mesh(spriteGeometry, spriteMaterial);
    spriteMesh.name = `item_sprite_${item.id}`;
    
    // Store sprite mesh reference for future updates
    this.itemMeshReferences.set(item.id, spriteMesh);
    
    console.log('🔗 Stored item sprite mesh reference:', {
      id: item.id,
      meshUuid: spriteMesh.uuid,
      geometryType: spriteMesh.geometry.type,
      materialType: spriteMesh.material.type
    });
    
    // Set sprite to always face the camera
    spriteMesh.lookAt(new THREE.Vector3(0, 0, 1));
    
    // Set position slightly above ground - same as enemies
    spriteMesh.position.y = 1;
    
    console.log('📐 Item sprite mesh positioning:', {
      id: item.id,
      spriteLocalY: spriteMesh.position.y,
      groupPosition: itemGroup.position
    });
    
    // Add sprite to the group
    itemGroup.add(spriteMesh);
    
    // Store item reference
    this.itemReferences.set(item.id, item);

    return { model: itemGroup };
  }

  /**
   * Update item position
   */
  static updateItemPosition(item: Item): void {
    if (!item.mesh) {
      console.warn('⚠️ Cannot update item position - no mesh:', item.id);
      return;
    }

    // Update position
    item.mesh.position.set(item.position.x, item.position.y, item.position.z);
    
    console.log('📍 Updated item position:', {
      id: item.id,
      position: item.position
    });
  }

  /**
   * Make all items face the local player (similar to enemy sprite rotation)
   */
  static updateAllItemsFacing(localPlayerPosition: THREE.Vector3): void {
    this.itemMeshReferences.forEach((mesh, itemId) => {
      // Get the item group (parent of sprite mesh)
      const itemGroup = mesh.parent;
      if (!itemGroup) return;

      // Calculate direction from item to local player
      const itemPosition = itemGroup.position;
      const direction = new THREE.Vector3()
        .subVectors(localPlayerPosition, itemPosition)
        .normalize();

      // Calculate angle and make sprite face the local player (only Y rotation)
      const angle = Math.atan2(direction.x, direction.z);
      mesh.rotation.y = angle;
    });
  }

  /**
   * Remove item from tracking and cleanup
   */
  static removeItem(itemId: string): void {
    console.log('🗑️ Removing item:', itemId);
    
    // Remove from maps
    this.itemMeshReferences.delete(itemId);
    this.itemReferences.delete(itemId);
  }

  /**
   * Get all item mesh references for debugging
   */
  static getItemMeshReferences(): Map<string, THREE.Mesh> {
    return new Map(this.itemMeshReferences);
  }

  /**
   * Get item data by ID
   */
  static getItemById(itemId: string): Item | null {
    return this.itemReferences.get(itemId) || null;
  }

  /**
   * Clear all items
   */
  static clearAllItems(): void {
    console.log('🧹 Clearing all items');
    this.itemMeshReferences.clear();
    this.itemReferences.clear();
  }

  /**
   * Create item from server data
   */
  static createItemFromServerData(itemData: GameItem, playerGroundLevel: number): Item {
    return {
      id: itemData.id,
      name: itemData.name,
      position: {
        x: itemData.location.x,
        y: playerGroundLevel, // Use the same Y level as player/enemies
        z: itemData.location.y // Server's Y maps to Three.js Z-axis
      },
      data: itemData
    };
  }
}
