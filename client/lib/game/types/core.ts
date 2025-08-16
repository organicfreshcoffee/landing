import * as THREE from 'three';

export interface GameState {
  connected: boolean;
  error: string | null;
  loading: boolean;
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
}

export interface PlayerUpdate {
  id: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  isMoving?: boolean;
  movementDirection?: 'forward' | 'backward' | 'none';
  character?: CharacterData;
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
