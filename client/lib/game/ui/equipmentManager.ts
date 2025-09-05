import { InventoryItem, InventoryResponse } from '../types/api';
import { DungeonApi } from '../network/dungeonApi';

export interface EquipmentCallbacks {
  onUnequipItem: (itemId: string) => void;
}

/**
 * Manages equipment UI and interactions
 */
export class EquipmentManager {
  private static instance: EquipmentManager;
  private equipmentOverlay: HTMLDivElement | null = null;
  private isVisible = false;
  private inventory: InventoryResponse['data']['inventory'] | null = null;
  private callbacks: EquipmentCallbacks | null = null;
  private serverAddress: string | null = null;
  
  private constructor() {
    // Equipment manager will be controlled by InventoryManager
  }

  static getInstance(): EquipmentManager {
    if (!this.instance) {
      this.instance = new EquipmentManager();
    }
    return this.instance;
  }

  /**
   * Set callback functions for equipment actions
   */
  setCallbacks(callbacks: EquipmentCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set server address for API calls
   */
  setServerAddress(serverAddress: string): void {
    this.serverAddress = serverAddress;
  }

  /**
   * Toggle equipment visibility
   */
  async toggleEquipment(): Promise<void> {
    if (this.isVisible) {
      this.hideEquipment();
    } else {
      await this.showEquipment();
    }
  }

  /**
   * Show equipment
   */
  async showEquipment(): Promise<void> {
    if (this.isVisible) return;

    // Load inventory data
    await this.loadInventory();
    
    if (!this.inventory) {
      console.error('❌ Failed to load inventory');
      return;
    }

    this.createEquipmentOverlay();
    this.isVisible = true;
  }

  /**
   * Hide equipment
   */
  hideEquipment(): void {
    if (!this.isVisible) return;

    if (this.equipmentOverlay) {
      this.equipmentOverlay.remove();
      this.equipmentOverlay = null;
    }
    this.isVisible = false;
  }

  /**
   * Load inventory from server
   */
  private async loadInventory(): Promise<void> {
    try {
      if (!this.serverAddress) {
        console.error('❌ No server address available for equipment');
        return;
      }

      const response = await DungeonApi.getInventory(this.serverAddress);
      
      if (response.success) {
        this.inventory = response.data.inventory;
        console.log('✅ Loaded inventory for equipment view');
      } else {
        console.error('❌ Failed to load inventory');
      }
    } catch (error) {
      console.error('❌ Error loading inventory:', error);
    }
  }

  /**
   * Refresh inventory data
   */
  async refreshInventory(): Promise<void> {
    await this.loadInventory();
    if (this.isVisible) {
      this.updateEquipmentDisplay();
    }
  }

  /**
   * Create the equipment overlay UI (positioned on left side)
   */
  private createEquipmentOverlay(): void {
    if (!this.inventory) return;

    // Check if DOM is ready
    if (typeof document === 'undefined') {
      console.error('❌ Document is not available!');
      return;
    }

    // Remove existing overlay
    if (this.equipmentOverlay) {
      this.equipmentOverlay.remove();
    }

    // Create equipment panel (no background overlay, just the panel)
    this.equipmentOverlay = document.createElement('div');
    this.equipmentOverlay.id = 'equipment-panel';
    this.equipmentOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 20px;
      transform: translateY(-50%);
      z-index: 3001;
      font-family: 'Courier New', monospace;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95));
      border: 2px solid #e24a4a;
      border-radius: 12px;
      padding: 20px;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    `;

    // Get equipped items
    const equippedItems = this.inventory.items.filter(item => item.equipped);

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      color: #ffffff;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #e24a4a;
      padding-bottom: 10px;
    `;
    header.innerHTML = `
      ⚔️ Equipment
      <div style="font-size: 14px; margin-top: 5px; color: #cccccc;">
        Equipped Items: ${equippedItems.length}
      </div>
    `;

    // Create instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      color: #aaaaaa;
      font-size: 12px;
      text-align: center;
      margin-bottom: 15px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    `;
    instructions.textContent = 'Press E to close • Click "Take Off" to unequip items';

    // Create equipped items list
    const itemsList = document.createElement('div');
    itemsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    `;

    if (equippedItems.length === 0) {
      const noItemsMessage = document.createElement('div');
      noItemsMessage.style.cssText = `
        color: #888888;
        text-align: center;
        font-style: italic;
        padding: 20px;
      `;
      noItemsMessage.textContent = 'No items equipped';
      itemsList.appendChild(noItemsMessage);
    } else {
      equippedItems.forEach(item => {
        const itemElement = this.createEquippedItemElement(item);
        itemsList.appendChild(itemElement);
      });
    }

    // Assemble the panel content directly
    this.equipmentOverlay.appendChild(header);
    // this.equipmentOverlay.appendChild(instructions);
    this.equipmentOverlay.appendChild(itemsList);

    // Note: No click handler needed since this will be managed by InventoryManager

    document.body.appendChild(this.equipmentOverlay);
  }

  /**
   * Create an equipped item element
   */
  private createEquippedItemElement(item: InventoryItem): HTMLDivElement {
    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = `
      background: linear-gradient(135deg, rgba(40, 40, 40, 0.8), rgba(60, 60, 60, 0.8));
      border: 1px solid #666666;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      transition: all 0.2s ease;
    `;

    // Add hover effect
    itemDiv.addEventListener('mouseenter', () => {
      itemDiv.style.background = 'linear-gradient(135deg, rgba(60, 60, 60, 0.9), rgba(80, 80, 80, 0.9))';
      itemDiv.style.borderColor = '#888888';
    });

    itemDiv.addEventListener('mouseleave', () => {
      itemDiv.style.background = 'linear-gradient(135deg, rgba(40, 40, 40, 0.8), rgba(60, 60, 60, 0.8))';
      itemDiv.style.borderColor = '#666666';
    });

    // Create item info
    const itemInfo = document.createElement('div');
    itemInfo.style.cssText = `
      color: #ffffff;
      margin-bottom: 10px;
    `;

    const itemName = document.createElement('div');
    itemName.style.cssText = `
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 4px;
      color: #4CAF50;
    `;
    itemName.textContent = item.name;

    const itemDetails = document.createElement('div');
    itemDetails.style.cssText = `
      font-size: 12px;
      color: #cccccc;
      line-height: 1.4;
    `;

    let detailsText = `Material: ${item.material} • Weight: ${item.weight} • Value: ${item.value}`;
    
    if (item.weaponStats) {
      detailsText += `\n🗡️ Weapon: ${item.weaponStats.type} (Power: ${item.weaponStats.powerMultiplier}x, Dex: ${item.weaponStats.dexterityMultiplier}x)`;
    }
    
    if (item.armorStats) {
      detailsText += `\n🛡️ Armor: Defense ${item.armorStats.defenseMultiplier}x, Speed ${item.armorStats.speedMultiplier}x, Mana ${item.armorStats.manaMultiplier}x`;
    }

    itemDetails.textContent = detailsText;

    itemInfo.appendChild(itemName);
    itemInfo.appendChild(itemDetails);

    // Create action button
    const takeOffButton = document.createElement('button');
    takeOffButton.textContent = '📤 Take Off';
    takeOffButton.style.cssText = `
      background: linear-gradient(135deg, #d32f2f, #f44336);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      transition: all 0.2s ease;
      width: 100%;
    `;

    takeOffButton.addEventListener('mouseenter', () => {
      takeOffButton.style.background = 'linear-gradient(135deg, #b71c1c, #d32f2f)';
    });

    takeOffButton.addEventListener('mouseleave', () => {
      takeOffButton.style.background = 'linear-gradient(135deg, #d32f2f, #f44336)';
    });

    takeOffButton.addEventListener('click', () => {
      if (this.callbacks?.onUnequipItem) {
        this.callbacks.onUnequipItem(item.id);
      }
    });

    itemDiv.appendChild(itemInfo);
    itemDiv.appendChild(takeOffButton);

    return itemDiv;
  }

  /**
   * Update the equipment display if currently visible
   */
  private updateEquipmentDisplay(): void {
    if (this.isVisible) {
      this.hideEquipment();
      this.showEquipment();
    }
  }
}
