// Server response types based on API documentation
export interface DungeonNode {
  _id: string;
  name: string;
  dungeonDagNodeName: string;
  children: string[];
  isRoom: boolean;
  hasUpwardStair?: boolean;
  hasDownwardStair?: boolean;
  roomWidth?: number;
  roomHeight?: number;
  stairLocationX?: number;
  stairLocationY?: number;
  hallwayLength?: number;
  parentDirection?: "left" | "right" | "center";
  parentDoorOffset?: number;
}

// New server-side generated floor data structures
export interface ServerGeneratedRoom {
  id: string;
  name: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  hasUpwardStair: boolean;
  hasDownwardStair: boolean;
  stairLocationX?: number;
  stairLocationY?: number;
  children: string[];
  parentDirection?: string;
  parentDoorOffset?: number;
  doorSide: string;
  doorPosition: { x: number; y: number };
}

export interface ServerGeneratedHallway {
  id: string;
  name: string;
  length: number;
  parentDirection?: string;
  parentDoorOffset?: number;
  children: string[];
  startPosition: { x: number; y: number };
  direction: { x: number; y: number };
  endPosition: { x: number; y: number };
  segments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    direction: { x: number; y: number };
    length: number;
  }>;
}

export interface FloorLayoutResponse {
  success: boolean;
  data: {
    dungeonDagNodeName: string;
    nodes: DungeonNode[];
  };
}

export interface FloorTile {
  x: number;
  y: number;
  type: "room" | "hallway";
}

export interface WallTile {
  x: number;
  y: number;
}

export interface StairTile {
  room_id: string;
  room_name: string;
  x: number;
  y: number;
}

export interface GeneratedFloorTilesResponse {
  success: boolean;
  data: {
    dungeonDagNodeName: string;
    bounds: {
      width: number;
      height: number;
    };
    tiles: {
      floorTiles: FloorTile[];
      wallTiles: WallTile[];
      upwardStairTiles: StairTile[];
      downwardStairTiles: StairTile[];
    };
  };
}

export interface StairInfo {
  floorDagNodeName: string;
  dungeonDagNodeName: string;
  locationX: number;
  locationY: number;
}

export interface RoomStairsResponse {
  success: boolean;
  data: {
    upwardStair?: StairInfo;
    downwardStair?: StairInfo;
  };
}

export interface SpawnLocationResponse {
  success: boolean;
  data: {
    dungeonDagNodeName: string;
  };
}

export interface PlayerMovedFloorResponse {
  success: boolean;
  message: string;
}

export interface CurrentFloorResponse {
  success: boolean;
  data: {
    currentFloor: string;
    playerId: string;
    playerName: string;
  };
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

export interface Character {
  type: string;
  style: number;
  name: string;
}

export interface CurrentStatusResponse {
  success: boolean;
  data: {
    currentFloor: string;
    playerId: string;
    playerName: string;
    position: Position;
    rotation: Rotation;
    health: number;
    character: Character;
    isAlive: boolean;
  };
}

export interface VisitedNode {
  _id: string;
  name: string;
  children: string[];
  isDownwardsFromParent: boolean;
  isBossLevel: boolean;
  visitedBy: boolean;
}

export interface VisitedNodesResponse {
  success: boolean;
  data: VisitedNode[];
}

// Item types
export interface ItemLocation {
  x: number;
  y: number;
}

export interface ItemStats {
  weaponStats?: {
    type: string;
    powerMultiplier: number;
    dexterityMultiplier: number;
  };
  armorStats?: {
    defenseMultiplier: number;
    speedMultiplier: number;
    manaMultiplier: number;
  };
}

export interface GameItem {
  id: string;
  itemTemplateId: string;
  material: string;
  make: string;
  location: ItemLocation;
  inWorld: boolean;
  owner: string | null;
  alignment: number;
  spawnDatetime: string;
  enchantments: any[];
  value: number;
  name: string;
  weight: number;
  floor: string;
  weaponStats?: {
    type: string;
    powerMultiplier: number;
    dexterityMultiplier: number;
  };
  armorStats?: {
    defenseMultiplier: number;
    speedMultiplier: number;
    manaMultiplier: number;
  };
}

export interface FloorItemsResponse {
  success: boolean;
  data: {
    floor: string;
    items: GameItem[];
  };
}

export interface PickupItemResponse {
  success: boolean;
  message: string;
  item: GameItem;
}

export interface InventoryItem {
  id: string;
  itemTemplateId: string;
  material: string;
  make: string;
  alignment: number;
  enchantments: any[];
  value: number;
  name: string;
  weight: number;
  weaponStats?: {
    type: string;
    powerMultiplier: number;
    dexterityMultiplier: number;
  } | null;
  armorStats?: {
    defenseMultiplier: number;
    speedMultiplier: number;
    manaMultiplier: number;
  } | null;
  spawnDatetime: string;
}

export interface InventoryStatistics {
  totalItems: number;
  totalValue: number;
  totalWeight: number;
}

export interface InventoryResponse {
  success: boolean;
  data: {
    inventory: {
      items: InventoryItem[];
      itemsByCategory: { [category: string]: InventoryItem[] };
      statistics: InventoryStatistics;
    };
  };
}

export interface DropItemResponse {
  success: boolean;
  message: string;
}

export interface EquipItemResponse {
  success: boolean;
  message: string;
}
