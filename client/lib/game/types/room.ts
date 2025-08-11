import * as THREE from 'three';

export interface Door {
  edgeIndex: number;
  position: number; // 0.0 to 1.0 along the edge
  width: number; // door width in units
}

export interface RoomShape {
  vertices: THREE.Vector2[];
  edges: { start: THREE.Vector2; end: THREE.Vector2; length: number }[];
  doors: Door[];
  shapeType: 'rectangle';
  width: number;
  height: number;
}
