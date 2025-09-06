import { InventoryItem, InventoryResponse } from '../types/api';
import { DungeonApi } from '../network/dungeonApi';

export interface EquipmentCallbacks {
  onUnequipItem: (itemId: string) => void;
}

// Equipment slot definitions with max counts
interface EquipmentSlot {
  name: string;
  category: string;
  maxCount: number;
  icon: string;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  { name: 'Ring', category: 'ring', maxCount: 2, icon: '💍' },
  { name: 'Amulet', category: 'amulet', maxCount: 1, icon: '📿' },
  { name: 'Chest Armor', category: 'chest armor', maxCount: 1, icon: '🛡️' },
  { name: 'Head Armor', category: 'head armor', maxCount: 1, icon: '⛑️' },
  { name: 'Cloak', category: 'cloak', maxCount: 1, icon: '🧥' },
  { name: 'Leg Armor', category: 'leg armor', maxCount: 1, icon: '👖' },
  { name: 'Shoes', category: 'shoes', maxCount: 1, icon: '👠' },
  { name: 'Gloves', category: 'gloves', maxCount: 1, icon: '🧤' },
  { name: 'Shield', category: 'shield', maxCount: 1, icon: '🛡️' },
  { name: 'Weapons', category: 'weapon', maxCount: 1, icon: '⚔️' } // All weapon types combined
];

/**
 * Manages equipment UI and interactions
 */
export class EquipmentManager {
  private static instance: EquipmentManager;
  private equipmentOverlay: HTMLDivElement | null = null;
  private loadingOverlay: HTMLDivElement | null = null;
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
   * Check if an item category is a weapon type
   */
  private isWeaponCategory(category: string): boolean {
    return ['magic weapon', 'melee weapon', 'range weapon'].includes(category.toLowerCase());
  }

  /**
   * Get normalized category for equipment slots (weapons are all grouped as 'weapon')
   */
  private getNormalizedCategory(category: string): string {
    if (this.isWeaponCategory(category)) {
      return 'weapon';
    }
    return category.toLowerCase();
  }

  /**
   * Check if adding an item would exceed equipment limits
   */
  private canEquipItem(item: InventoryItem, equippedItems: InventoryItem[]): { canEquip: boolean; error?: string } {
    const normalizedCategory = this.getNormalizedCategory(item.category);
    const slot = EQUIPMENT_SLOTS.find(s => s.category === normalizedCategory);
    
    if (!slot) {
      return { canEquip: false, error: `Unknown item category: ${item.category}` };
    }

    // Count currently equipped items in this category
    let currentCount = 0;
    if (normalizedCategory === 'weapon') {
      // Count all weapon types
      currentCount = equippedItems.filter(equippedItem => 
        this.isWeaponCategory(equippedItem.category)
      ).length;
    } else {
      // Count items in this specific category
      currentCount = equippedItems.filter(equippedItem => 
        this.getNormalizedCategory(equippedItem.category) === normalizedCategory
      ).length;
    }

    if (currentCount >= slot.maxCount) {
      const itemType = normalizedCategory === 'weapon' ? 'weapon' : item.category;
      return { 
        canEquip: false, 
        error: `Cannot equip ${item.category}. You already have the maximum number of ${itemType}${slot.maxCount > 1 ? 's' : ''} equipped (${currentCount}/${slot.maxCount})` 
      };
    }

    return { canEquip: true };
  }

  /**
   * Organize equipped items by category slots
   */
  private organizeEquippedItems(equippedItems: InventoryItem[]): Map<string, InventoryItem[]> {
    const organizedItems = new Map<string, InventoryItem[]>();
    
    // Initialize all slots as empty
    EQUIPMENT_SLOTS.forEach(slot => {
      organizedItems.set(slot.category, []);
    });

    // Group items by normalized category
    equippedItems.forEach(item => {
      const normalizedCategory = this.getNormalizedCategory(item.category);
      const existing = organizedItems.get(normalizedCategory) || [];
      existing.push(item);
      organizedItems.set(normalizedCategory, existing);
    });

    return organizedItems;
  }
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

    // Find the main container created by inventory manager
    const inventoryOverlay = document.getElementById('inventory-overlay');
    if (!inventoryOverlay) {
      console.error('❌ Cannot find inventory overlay to attach equipment panel');
      return;
    }

    const mainContainer = inventoryOverlay.querySelector('div[style*="display: flex"]') as HTMLDivElement;
    if (!mainContainer) {
      console.error('❌ Cannot find main container to attach equipment panel');
      return;
    }

    // Create equipment panel (will be inserted as the first child, so it appears on the left)
    this.equipmentOverlay = document.createElement('div');
    this.equipmentOverlay.id = 'equipment-panel';
    this.equipmentOverlay.style.cssText = `
      position: relative;
      font-family: 'Courier New', monospace;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95));
      border: 2px solid #e24a4a;
      border-radius: 12px;
      padding: 20px;
      max-width: 400px;
      height: 70vh;
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
    instructions.textContent = 'Equipment slots • Click "Take Off" to unequip items';

    // Create equipment slots container
    const slotsContainer = document.createElement('div');
    slotsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
    `;

    // Get equipped items and organize them
    const organizedItems = this.organizeEquippedItems(equippedItems);

    // Create each equipment slot
    EQUIPMENT_SLOTS.forEach(slot => {
      const slotItems = organizedItems.get(slot.category) || [];
      const slotElement = this.createEquipmentSlot(slot, slotItems);
      slotsContainer.appendChild(slotElement);
    });

    // Assemble the panel content directly
    this.equipmentOverlay.appendChild(header);
    this.equipmentOverlay.appendChild(instructions);
    this.equipmentOverlay.appendChild(slotsContainer);

    // Add equipment panel as the first child of main container (so it appears on the left)
    mainContainer.insertBefore(this.equipmentOverlay, mainContainer.firstChild);
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
   * Create an equipment slot showing all items in that category
   */
  private createEquipmentSlot(slot: EquipmentSlot, items: InventoryItem[]): HTMLDivElement {
    const slotDiv = document.createElement('div');
    slotDiv.style.cssText = `
      background: linear-gradient(135deg, rgba(30, 30, 30, 0.8), rgba(50, 50, 50, 0.8));
      border: 1px solid #555555;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    `;

    // Slot header
    const slotHeader = document.createElement('div');
    slotHeader.style.cssText = `
      color: #ffffff;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #666666;
      padding-bottom: 5px;
    `;

    const slotTitle = document.createElement('span');
    slotTitle.textContent = `${slot.icon} ${slot.name}`;

    const slotCount = document.createElement('span');
    slotCount.style.cssText = `
      font-size: 12px;
      color: #cccccc;
    `;
    slotCount.textContent = `${items.length}/${slot.maxCount}`;

    slotHeader.appendChild(slotTitle);
    slotHeader.appendChild(slotCount);

    slotDiv.appendChild(slotHeader);

    // Show equipped items or empty slots
    if (items.length === 0) {
      const emptySlot = document.createElement('div');
      emptySlot.style.cssText = `
        color: #888888;
        font-style: italic;
        font-size: 12px;
        padding: 8px;
        text-align: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        border: 1px dashed #666666;
      `;
      emptySlot.textContent = `Empty ${slot.name.toLowerCase()} slot${slot.maxCount > 1 ? 's' : ''}`;
      slotDiv.appendChild(emptySlot);
    } else {
      // Show equipped items in this slot
      items.forEach(item => {
        const itemElement = this.createSlotItemElement(item);
        slotDiv.appendChild(itemElement);
      });

      // Show empty slots if not at max capacity
      const emptySlotsCount = slot.maxCount - items.length;
      for (let i = 0; i < emptySlotsCount; i++) {
        const emptySlot = document.createElement('div');
        emptySlot.style.cssText = `
          color: #666666;
          font-style: italic;
          font-size: 11px;
          padding: 4px 8px;
          margin-top: 4px;
          text-align: center;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
          border: 1px dashed #555555;
        `;
        emptySlot.textContent = `Empty slot`;
        slotDiv.appendChild(emptySlot);
      }
    }

    return slotDiv;
  }

  /**
   * Create a compact item element for display within a slot
   */
  private createSlotItemElement(item: InventoryItem): HTMLDivElement {
    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = `
      background: linear-gradient(135deg, rgba(40, 40, 40, 0.8), rgba(60, 60, 60, 0.8));
      border: 1px solid #666666;
      border-radius: 6px;
      padding: 8px;
      margin-top: 4px;
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

    // Item name and basic info
    const itemName = document.createElement('div');
    itemName.style.cssText = `
      color: #4CAF50;
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 4px;
    `;
    itemName.textContent = item.name;

    const itemDetails = document.createElement('div');
    itemDetails.style.cssText = `
      color: #cccccc;
      font-size: 10px;
      margin-bottom: 6px;
    `;
    itemDetails.textContent = `${item.material} • Value: ${item.value}`;

    // Take off button
    const takeOffButton = document.createElement('button');
    takeOffButton.textContent = '📤 Take Off';
    takeOffButton.style.cssText = `
      background: linear-gradient(135deg, #d32f2f, #f44336);
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
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

    itemDiv.appendChild(itemName);
    itemDiv.appendChild(itemDetails);
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

  /**
   * Check if equipment panel is currently visible
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Update inventory data without changing visibility
   */
  public updateInventoryData(inventory: InventoryResponse['data']['inventory']): void {
    this.inventory = inventory;
  }

  /**
   * Shows loading overlay during refresh
   */
  public showLoadingOverlay() {
    if (!this.equipmentOverlay) return;

    if (!this.loadingOverlay) {
      this.loadingOverlay = document.createElement('div');
      this.loadingOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        border-radius: 12px;
      `;
      
      const spinner = document.createElement('div');
      spinner.style.cssText = `
        width: 32px;
        height: 32px;
        border: 3px solid #333;
        border-top: 3px solid #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      `;
      
      this.loadingOverlay.appendChild(spinner);
    }

    this.equipmentOverlay.appendChild(this.loadingOverlay);
  }

  /**
   * Hides loading overlay
   */
  public hideLoadingOverlay() {
    if (this.loadingOverlay && this.loadingOverlay.parentNode) {
      this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
    }
  }

  /**
   * Updates equipment display content without showing/hiding the panel
   */
  public async updateEquipmentDisplayContent() {
    if (!this.equipmentOverlay || !this.inventory) return;

    // Store the loading overlay temporarily
    const currentLoadingOverlay = this.loadingOverlay;
    
    // Recreate the equipment content
    this.createEquipmentOverlay();
    
    // Re-attach the loading overlay if it was showing
    if (currentLoadingOverlay && currentLoadingOverlay.parentNode) {
      this.equipmentOverlay.appendChild(currentLoadingOverlay);
      this.loadingOverlay = currentLoadingOverlay;
    }
  }
}
