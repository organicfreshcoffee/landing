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

export interface FloorLayoutResponse {
  success: boolean;
  data: {
    dungeonDagNodeName: string;
    nodes: DungeonNode[];
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
