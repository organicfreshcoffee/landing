import * as THREE from 'three';
import { Item } from '../types/core';

export interface ItemInteractionData {
  itemId: string;
  itemName: string;
  position: THREE.Vector3;
  itemData: any;
}

/**
 * Manages item interactions including proximity detection and UI popups
 */
export class ItemInteractionManager {
  private static instance: ItemInteractionManager;
  private items: Map<string, ItemInteractionData> = new Map();
  private nearbyItem: ItemInteractionData | null = null;
  private interactionPopup: HTMLDivElement | null = null;
  private readonly INTERACTION_DISTANCE = 12.5; // Same distance as stairs
  
  // Interaction callback
  private onPickupCallback: ((itemData: ItemInteractionData) => void) | null = null;
  
  private constructor() {
    // Don't create popup immediately in constructor, wait for DOM to be ready
    setTimeout(() => {
      this.createInteractionPopup();
      this.setupKeyListener();
    }, 0);
  }

  static getInstance(): ItemInteractionManager {
    if (!this.instance) {
      this.instance = new ItemInteractionManager();
    }
    return this.instance;
  }

  /**
   * Initialize items from item data
   */
  initializeItems(items: Item[]): void {
    this.items.clear();
  
    items.forEach(item => {        
      const itemData: ItemInteractionData = {
        itemId: item.id,
        itemName: item.name,
        position: new THREE.Vector3(item.position.x, item.position.y, item.position.z),
        itemData: item.data
      };

      this.items.set(item.id, itemData);
    });
    
    console.log(`🎒 Initialized ${this.items.size} items for interaction`);
  }

  /**
   * Add a single item
   */
  addItem(item: Item): void {
    const itemData: ItemInteractionData = {
      itemId: item.id,
      itemName: item.name,
      position: new THREE.Vector3(item.position.x, item.position.y, item.position.z),
      itemData: item.data
    };

    this.items.set(item.id, itemData);
    console.log(`🎒 Added item for interaction: ${item.name} (${item.id})`);
  }

  /**
   * Remove a single item
   */
  removeItem(itemId: string): void {
    this.items.delete(itemId);
    
    // If this was the nearby item, clear it
    if (this.nearbyItem && this.nearbyItem.itemId === itemId) {
      this.nearbyItem = null;
      this.updateInteractionUI();
    }
    
    console.log(`🗑️ Removed item from interaction: ${itemId}`);
  }

  /**
   * Update player position and check for nearby items
   */
  updatePlayerPosition(playerPosition: THREE.Vector3): void {    
    let closestItem: ItemInteractionData | null = null;
    let closestDistance = this.INTERACTION_DISTANCE;

    // Check distance to all items
    this.items.forEach(item => {
      const distance = playerPosition.distanceTo(item.position);
      if (distance < closestDistance) {
        closestItem = item;
        closestDistance = distance;
      }
    });

    // Update nearby item state
    if (closestItem !== this.nearbyItem) {
      this.nearbyItem = closestItem;
      this.updateInteractionUI();
    }
  }

  /**
   * Set callback function for item pickup
   */
  setCallback(onPickup: ((itemData: ItemInteractionData) => void) | null): void {
    this.onPickupCallback = onPickup;
  }

  /**
   * Create the interaction popup element
   */
  private createInteractionPopup(): void {
    // Ensure we don't have a duplicate popup
    if (this.interactionPopup) {
      this.interactionPopup.remove();
      this.interactionPopup = null;
    }

    // Check if DOM is ready
    if (typeof document === 'undefined') {
      console.error(`[item-popup] Document is not available!`);
      return;
    }

    try {
      this.interactionPopup = document.createElement('div');
      this.interactionPopup.id = 'item-interaction-popup';
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
        
        #item-interaction-popup.item {
          border-color: #f1c40f;
          background: linear-gradient(135deg, rgba(241, 196, 15, 0.2), rgba(40, 40, 40, 0.9));
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(this.interactionPopup);
    } catch (error) {
      console.error(`[item-popup] Error creating interaction popup:`, error);
      this.interactionPopup = null;
    }
  }

  /**
   * Update the interaction UI based on nearby items
   */
  private updateInteractionUI(): void {
    if (!this.interactionPopup) {
      this.createInteractionPopup();
      if (!this.interactionPopup) {
        console.error(`[item-popup] CRITICAL: Failed to recreate interactionPopup element!`);
        return;
      }
    }
    
    if (this.nearbyItem) {
      const icon = '🎒';
      
      this.interactionPopup.innerHTML = `
        <div style="margin-bottom: 5px;">${icon}</div>
        <div>Press <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">E</span> to pickup ${this.nearbyItem.itemName}</div>
      `;
      
      // Set appropriate styling
      this.interactionPopup.className = 'item';
      this.interactionPopup.style.display = 'block';
      
    } else {
      this.interactionPopup.style.display = 'none';
    }
  }

  /**
   * Set up keyboard listener for E key
   */
  private setupKeyListener(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyE' && this.nearbyItem) {
        event.preventDefault();
        this.handleItemInteraction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Handle item interaction when E is pressed
   */
  private handleItemInteraction(): void {
    if (!this.nearbyItem) return;
    
    if (this.onPickupCallback) {
      this.onPickupCallback(this.nearbyItem);
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
    }
  }

  /**
   * Get debug information about current item interactions
   */
  getDebugInfo(): {
    totalItems: number;
    nearbyItem: ItemInteractionData | null;
    items: Array<{ key: string; data: ItemInteractionData }>;
  } {
    return {
      totalItems: this.items.size,
      nearbyItem: this.nearbyItem,
      items: Array.from(this.items.entries()).map(([key, data]) => ({ key, data }))
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
    
    this.items.clear();
    this.nearbyItem = null;
    this.onPickupCallback = null;
  }
}
