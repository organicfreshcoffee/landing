import * as THREE from 'three';

export interface FloorHallwaySegment {
  start: THREE.Vector2;
  end: THREE.Vector2;
  direction: THREE.Vector2;
  length: number;
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
