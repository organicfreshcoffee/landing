import * as THREE from 'three';

export interface ServerRoom {
  id: string;
  name: string;
  position: THREE.Vector2;
  width: number;
  height: number;
  hasUpwardStair: boolean;
  hasDownwardStair: boolean;
  stairLocationX?: number;
  stairLocationY?: number;
  children: string[];
  parentDirection?: "left" | "right" | "center";
  parentDoorOffset?: number;
  // Door position calculated from parentDirection and parentDoorOffset
  doorPosition?: THREE.Vector2;
  doorSide?: "top" | "right" | "bottom" | "left";
}

export interface ServerHallway {
  id: string;
  name: string;
  length: number;
  parentDirection?: "left" | "right" | "center";
  parentDoorOffset?: number;
  children: string[];
  // Calculated fields for rendering
  startPosition?: THREE.Vector2;
  endPosition?: THREE.Vector2;
  direction?: THREE.Vector2; // normalized direction vector
  segments?: FloorHallwaySegment[];
}

export interface FloorHallwaySegment {
  start: THREE.Vector2;
  end: THREE.Vector2;
  direction: THREE.Vector2;
  length: number;
}

export interface ServerFloorLayout {
  dungeonDagNodeName: string;
  rooms: ServerRoom[];
  hallways: ServerHallway[];
  bounds: { width: number; height: number };
  // Hierarchy map for easy lookup
  nodeMap: Map<string, ServerRoom | ServerHallway>;
  rootNode: string;
}

export interface ServerSceneryOptions {
  cubeSize?: number;
  floorColor?: number;
  hallwayFloorColor?: number;
}

// Network hallway types (for rendering)
export interface HallwaySegment {
  id: string;
  start: THREE.Vector2;
  end: THREE.Vector2;
  width: number;
  connectionIds: string[];
}

export interface HallwayIntersection {
  id: string;
  position: THREE.Vector2;
  radius: number;
  connectedSegments: string[];
}

export interface HallwayNetwork {
  connections: any[]; // To be properly typed later
  segments: HallwaySegment[];
  intersections: HallwayIntersection[];
  deadEnds: THREE.Vector2[];
}
