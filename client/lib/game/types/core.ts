import * as THREE from 'three';

export interface GameState {
  connected: boolean;
  error: string | null;
  loading: boolean;
  connectionQuality?: {
    pingMs: number | null;
    lastPongTime: number;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  };
}

export interface GameMessage {
  type: string;
  data: any;
}

export interface CharacterData {
  type: string;
  style: number;
  name: string;
}

export interface Player {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  color: string;
  mesh?: THREE.Object3D;
  isMoving?: boolean;
  movementDirection?: 'forward' | 'backward' | 'none';
  character?: CharacterData;
  health?: number;
  maxHealth?: number;
}

export interface PlayerUpdate {
  id: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  isMoving?: boolean;
  movementDirection?: 'forward' | 'backward' | 'none';
  character?: CharacterData;
  health?: number;
  maxHealth?: number;
}

export interface PlayerAnimationData {
  mixer: THREE.AnimationMixer;
  actions: { [key: string]: THREE.AnimationAction };
}

export interface ModelData {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  groundOffset?: { x: number; y: number; z: number };
}

export interface PlayerActionData {
  action: string;
  target?: string;
  data?: any;
}

export interface SpellActionData {
  fromPosition: { x: number; y: number; z: number };
  toPosition: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  range: number;
  timestamp: number;
  casterPosition?: { x: number; y: number; z: number };
  spellRadius?: number;
}

export interface Enemy {
  id: string;
  enemyTypeID: number;
  enemyTypeName: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  isMoving: boolean;
  mesh?: THREE.Object3D;
  health?: number;
  maxHealth?: number;
}

export interface EnemyUpdate {
  id: string;
  enemyTypeID: number;
  enemyTypeName: string;
  positionX: number;
  positionY: number;
  rotationY?: number;
  isMoving: boolean;
  health?: number;
  maxHealth?: number;
}

export interface Item {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  mesh?: THREE.Object3D;
  data: any; // Full item data from server
}
