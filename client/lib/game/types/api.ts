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

export interface ServerGeneratedFloorData {
  dungeonDagNodeName: string;
  rooms: ServerGeneratedRoom[];
  hallways: ServerGeneratedHallway[];
  bounds: { width: number; height: number };
  rootNode: string;
  floorTiles: Array<{ x: number; y: number }>;
  roomTiles: Record<string, Array<{ x: number; y: number }>>;
  hallwayTiles: Record<string, Array<{ x: number; y: number }>>;
}

export interface FloorLayoutResponse {
  success: boolean;
  data: {
    dungeonDagNodeName: string;
    nodes: DungeonNode[];
  };
}

export interface GeneratedFloorResponse {
  success: boolean;
  data: ServerGeneratedFloorData;
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
