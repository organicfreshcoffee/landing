import { InventoryItem, InventoryResponse } from '../types/api';
import { DungeonApi } from '../network/dungeonApi';

export interface InventoryCallbacks {
  onDropItem: (itemId: string) => void;
  onEquipItem: (itemId: string) => void;
}

/**
 * Manages inventory UI and interactions
 */
export class InventoryManager {
  private static instance: InventoryManager;
  private inventoryOverlay: HTMLDivElement | null = null;
  private isVisible = false;
  private inventory: InventoryResponse['data']['inventory'] | null = null;
  private callbacks: InventoryCallbacks | null = null;
  
  private constructor() {
    this.setupKeyListener();
  }

  static getInstance(): InventoryManager {
    if (!this.instance) {
      this.instance = new InventoryManager();
    }
    return this.instance;
  }

  /**
   * Set callback functions for inventory actions
   */
  setCallbacks(callbacks: InventoryCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set up keyboard listener for I key
   */
  private setupKeyListener(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyI') {
        event.preventDefault();
        this.toggleInventory();
      } else if (event.code === 'Escape' && this.isVisible) {
        event.preventDefault();
        this.hideInventory();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
  }

  /**
   * Toggle inventory visibility
   */
  async toggleInventory(): Promise<void> {
    if (this.isVisible) {
      this.hideInventory();
    } else {
      await this.showInventory();
    }
  }

  /**
   * Show inventory
   */
  async showInventory(): Promise<void> {
    if (this.isVisible) return;

    // Load inventory data
    await this.loadInventory();
    
    if (!this.inventory) {
      console.error('❌ Failed to load inventory');
      return;
    }

    this.createInventoryOverlay();
    this.isVisible = true;
  }

  /**
   * Hide inventory
   */
  hideInventory(): void {
    if (!this.isVisible) return;

    if (this.inventoryOverlay) {
      this.inventoryOverlay.remove();
      this.inventoryOverlay = null;
    }
    this.isVisible = false;
  }

  /**
   * Load inventory from server
   */
  private async loadInventory(): Promise<void> {
    try {
      // Get server address from somewhere - you might need to pass this in
      const serverAddress = this.getServerAddress();
      if (!serverAddress) {
        console.error('❌ No server address available for inventory');
        return;
      }

      const response = await DungeonApi.getInventory(serverAddress);
      
      if (response.success) {
        this.inventory = response.data.inventory;
        console.log('✅ Loaded inventory:', this.inventory.statistics);
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
      this.updateInventoryDisplay();
    }
  }

  /**
   * Get server address - this is a placeholder, you'll need to implement this
   * based on how your app manages server addresses
   */
  private getServerAddress(): string | null {
    return this.getServerAddressInternal();
  }

  /**
   * Create the inventory overlay UI
   */
  private createInventoryOverlay(): void {
    if (!this.inventory) return;

    // Check if DOM is ready
    if (typeof document === 'undefined') {
      console.error('❌ Document is not available!');
      return;
    }

    // Remove existing overlay
    if (this.inventoryOverlay) {
      this.inventoryOverlay.remove();
    }

    // Create overlay container
    this.inventoryOverlay = document.createElement('div');
    this.inventoryOverlay.id = 'inventory-overlay';
    this.inventoryOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 3000;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Courier New', monospace;
    `;

    // Create inventory panel
    const inventoryPanel = document.createElement('div');
    inventoryPanel.style.cssText = `
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95));
      border: 2px solid #4a90e2;
      border-radius: 12px;
      padding: 20px;
      max-width: 80%;
      max-height: 80%;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      color: #ffffff;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #4a90e2;
      padding-bottom: 10px;
    `;
    // Calculate unequipped items statistics
    const unequippedItems = this.inventory.items.filter(item => !item.equipped);
    const unequippedWeight = unequippedItems.reduce((sum, item) => sum + item.weight, 0);
    const unequippedValue = unequippedItems.reduce((sum, item) => sum + item.value, 0);

    header.innerHTML = `
      🎒 Inventory
      <div style="font-size: 14px; margin-top: 5px; color: #cccccc;">
        Items: ${unequippedItems.length} | 
        Weight: ${unequippedWeight} | 
        Value: ${unequippedValue}
      </div>
    `;

    // Create instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      color: #aaaaaa;
      font-size: 12px;
      text-align: center;
      margin-bottom: 15px;
    `;
    instructions.textContent = 'Press [I] or [Escape] to close';

    // Create categories
    const categoriesContainer = document.createElement('div');
    
    if (Object.keys(this.inventory.itemsByCategory).length > 0) {
      Object.entries(this.inventory.itemsByCategory).forEach(([category, items]) => {
        // Filter out equipped items
        const unequippedItems = items.filter(item => !item.equipped);
        if (unequippedItems.length > 0) {
          const categorySection = this.createCategorySection(category, unequippedItems);
          categoriesContainer.appendChild(categorySection);
        }
      });
    } else {
      // Show all unequipped items if no categories
      const unequippedItems = this.inventory.items.filter(item => !item.equipped);
      const allItemsSection = this.createCategorySection('All Items', unequippedItems);
      categoriesContainer.appendChild(allItemsSection);
    }

    // Assemble the panel
    inventoryPanel.appendChild(header);
    inventoryPanel.appendChild(instructions);
    inventoryPanel.appendChild(categoriesContainer);

    // Add to overlay
    this.inventoryOverlay.appendChild(inventoryPanel);

    // Add click outside to close
    this.inventoryOverlay.addEventListener('click', (e) => {
      if (e.target === this.inventoryOverlay) {
        this.hideInventory();
      }
    });

    // Add to document
    document.body.appendChild(this.inventoryOverlay);
  }

  /**
   * Create a category section
   */
  private createCategorySection(categoryName: string, items: InventoryItem[]): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    // Category header
    const categoryHeader = document.createElement('div');
    categoryHeader.style.cssText = `
      color: #f39c12;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      padding: 5px 0;
      border-bottom: 1px solid #555;
    `;
    categoryHeader.textContent = `${categoryName} (${items.length})`;

    // Items list
    const itemsList = document.createElement('div');
    items.forEach(item => {
      const itemElement = this.createItemElement(item);
      itemsList.appendChild(itemElement);
    });

    section.appendChild(categoryHeader);
    section.appendChild(itemsList);

    return section;
  }

  /**
   * Create an individual item element
   */
  private createItemElement(item: InventoryItem): HTMLElement {
    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid #666;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      display: flex;
      justify-content: between;
      align-items: center;
      transition: background 0.2s;
    `;

    // Item info section
    const itemInfo = document.createElement('div');
    itemInfo.style.cssText = `
      flex: 1;
      color: #ffffff;
    `;

    // Item name and stats
    const itemName = document.createElement('div');
    itemName.style.cssText = `
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 4px;
    `;
    itemName.textContent = item.name;

    const itemDetails = document.createElement('div');
    itemDetails.style.cssText = `
      font-size: 12px;
      color: #cccccc;
    `;

    let detailsText = `${item.material} | ${item.make} | Weight: ${item.weight} | Value: ${item.value}`;
    
    if (item.weaponStats) {
      detailsText += ` | Weapon: ${item.weaponStats.type} (Power: ${item.weaponStats.powerMultiplier}, Dex: ${item.weaponStats.dexterityMultiplier})`;
    }
    
    if (item.armorStats) {
      detailsText += ` | Armor: Def ${item.armorStats.defenseMultiplier}, Speed ${item.armorStats.speedMultiplier}, Mana ${item.armorStats.manaMultiplier}`;
    }

    itemDetails.textContent = detailsText;

    // Buttons section
    const buttonsSection = document.createElement('div');
    buttonsSection.style.cssText = `
      display: flex;
      gap: 8px;
      margin-left: 10px;
    `;

    // Drop button
    const dropButton = document.createElement('button');
    dropButton.textContent = 'Drop';
    dropButton.style.cssText = `
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    dropButton.addEventListener('mouseenter', () => {
      dropButton.style.background = '#c0392b';
    });
    dropButton.addEventListener('mouseleave', () => {
      dropButton.style.background = '#e74c3c';
    });
    dropButton.addEventListener('click', () => {
      if (this.callbacks) {
        this.callbacks.onDropItem(item.id);
        this.hideInventory(); // Close inventory after action
      }
    });

    // Equip button
    const equipButton = document.createElement('button');
    equipButton.textContent = 'Equip';
    equipButton.style.cssText = `
      background: #27ae60;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    equipButton.addEventListener('mouseenter', () => {
      equipButton.style.background = '#229954';
    });
    equipButton.addEventListener('mouseleave', () => {
      equipButton.style.background = '#27ae60';
    });
    equipButton.addEventListener('click', () => {
      if (this.callbacks) {
        this.callbacks.onEquipItem(item.id);
        this.hideInventory(); // Close inventory after action
      }
    });

    // Assemble item
    itemInfo.appendChild(itemName);
    itemInfo.appendChild(itemDetails);
    
    buttonsSection.appendChild(dropButton);
    buttonsSection.appendChild(equipButton);

    itemDiv.appendChild(itemInfo);
    itemDiv.appendChild(buttonsSection);

    // Hover effect
    itemDiv.addEventListener('mouseenter', () => {
      itemDiv.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    itemDiv.addEventListener('mouseleave', () => {
      itemDiv.style.background = 'rgba(255, 255, 255, 0.05)';
    });

    return itemDiv;
  }

  /**
   * Update server address (call this when server address changes)
   */
  setServerAddress(serverAddress: string): void {
    (this as any).serverAddress = serverAddress;
  }

  /**
   * Get server address with fallback
   */
  private getServerAddressInternal(): string | null {
    return (this as any).serverAddress || null;
  }

  /**
   * Update the inventory display if currently visible
   */
  private updateInventoryDisplay(): void {
    if (this.isVisible) {
      this.hideInventory();
      this.showInventory();
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.hideInventory();
    this.callbacks = null;
    this.inventory = null;
  }
}
