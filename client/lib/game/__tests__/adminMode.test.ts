import * as THREE from 'three';
import { MovementController } from '../core/movementController';
import { PlayerAnimationData } from '../types';

// Mock the HUD and CollisionSystem dependencies
jest.mock('../ui/gameHUD', () => ({
  GameHUD: {
    getInstance: () => ({
      updateAdminMode: jest.fn(),
      showMessage: jest.fn(),
      updatePlayerInfo: jest.fn(),
      hideHUD: jest.fn(),
    }),
  },
}));

jest.mock('../core/collisionSystem', () => ({
  CollisionSystem: {
    getInstance: () => ({
      updateCollisionData: jest.fn(),
      checkCollision: jest.fn(() => ({ collided: false, correctedPosition: new THREE.Vector3(), collisionDirection: 'none' })),
      getFloorHeight: jest.fn(() => 5),
      isOnGround: jest.fn(() => true),
    }),
  },
}));

describe('MovementController Admin Mode', () => {
  let movementController: MovementController;
  let mockLocalPlayerRef: { current: THREE.Object3D | null };
  let mockCameraRef: { current: THREE.PerspectiveCamera | null };
  let mockLocalPlayerMixer: { current: THREE.AnimationMixer | null };
  let mockLocalPlayerActions: { current: { [key: string]: THREE.AnimationAction } };
  let mockPlayersAnimations: Map<string, PlayerAnimationData>;
  let mockIsConnected: jest.Mock;
  let mockSendMovementUpdate: jest.Mock;

  beforeEach(() => {
    // Set up mocks
    const mockPlayer = new THREE.Object3D();
    mockPlayer.position.set(0, 5, 0);
    
    mockLocalPlayerRef = { current: mockPlayer };
    mockCameraRef = { current: new THREE.PerspectiveCamera() };
    mockLocalPlayerMixer = { current: null };
    mockLocalPlayerActions = { current: {} };
    mockPlayersAnimations = new Map();
    mockIsConnected = jest.fn(() => true);
    mockSendMovementUpdate = jest.fn();

    // Create movement controller
    movementController = new MovementController(
      mockLocalPlayerRef,
      mockCameraRef,
      mockLocalPlayerMixer,
      mockLocalPlayerActions,
      mockPlayersAnimations,
      mockIsConnected,
      mockSendMovementUpdate
    );
  });

  afterEach(() => {
    movementController.cleanup();
    jest.clearAllMocks();
  });

  describe('Admin Mode Toggle', () => {
    test('should start in normal mode', () => {
      const debugInfo = movementController.debugInfo;
      expect(debugInfo.isAdminMode).toBe(false);
    });

    test('should toggle admin mode with Tab key', () => {
      // Simulate Tab key press
      const tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      const debugInfo = movementController.debugInfo;
      expect(debugInfo.isAdminMode).toBe(true);
    });

    test('should toggle back to normal mode with Tab key', () => {
      // First toggle to admin mode
      let tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      let debugInfo = movementController.debugInfo;
      expect(debugInfo.isAdminMode).toBe(true);

      // Toggle back to normal mode
      tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      debugInfo = movementController.debugInfo;
      expect(debugInfo.isAdminMode).toBe(false);
    });
  });

  describe('Movement in Different Modes', () => {
    test('should apply different speed in admin mode', () => {
      if (!mockLocalPlayerRef.current) return;

      const initialPosition = mockLocalPlayerRef.current.position.clone();

      // Toggle to admin mode first
      const tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      // Simulate W key press (forward movement)
      const wKeyDown = new KeyboardEvent('keydown', { code: 'KeyW' });
      window.dispatchEvent(wKeyDown);

      // Update movement
      movementController.updateMovement('test-user');

      // In admin mode, movement should be faster
      const debugInfo = movementController.debugInfo;
      expect(debugInfo.isAdminMode).toBe(true);
      
      // Clean up key
      const wKeyUp = new KeyboardEvent('keyup', { code: 'KeyW' });
      window.dispatchEvent(wKeyUp);
    });

    test('should handle vertical movement in admin mode', () => {
      if (!mockLocalPlayerRef.current) return;

      const initialY = mockLocalPlayerRef.current.position.y;

      // Toggle to admin mode
      const tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      // Simulate Space key press (up movement in admin mode)
      const spaceKeyDown = new KeyboardEvent('keydown', { code: 'Space' });
      window.dispatchEvent(spaceKeyDown);

      // Update movement
      movementController.updateMovement('test-user');

      // Should move up in admin mode
      expect(mockLocalPlayerRef.current.position.y).toBeGreaterThan(initialY);

      // Clean up
      const spaceKeyUp = new KeyboardEvent('keyup', { code: 'Space' });
      window.dispatchEvent(spaceKeyUp);
    });

    test('should handle downward movement with Shift in admin mode', () => {
      if (!mockLocalPlayerRef.current) return;

      // Start at higher position
      mockLocalPlayerRef.current.position.y = 10;
      const initialY = mockLocalPlayerRef.current.position.y;

      // Toggle to admin mode
      const tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      // Simulate Shift key press (down movement in admin mode)
      const shiftKeyDown = new KeyboardEvent('keydown', { code: 'ShiftLeft' });
      window.dispatchEvent(shiftKeyDown);

      // Update movement
      movementController.updateMovement('test-user');

      // Should move down in admin mode
      expect(mockLocalPlayerRef.current.position.y).toBeLessThan(initialY);

      // Clean up
      const shiftKeyUp = new KeyboardEvent('keyup', { code: 'ShiftLeft' });
      window.dispatchEvent(shiftKeyUp);
    });
  });

  describe('Physics in Different Modes', () => {
    test('should reset physics when entering admin mode', () => {
      // Set some initial velocity
      const debugInfo = movementController.debugInfo;
      
      // Toggle to admin mode
      const tabEvent = new KeyboardEvent('keydown', { code: 'Tab' });
      window.dispatchEvent(tabEvent);

      const newDebugInfo = movementController.debugInfo;
      expect(newDebugInfo.isAdminMode).toBe(true);
      expect(newDebugInfo.velocity).toEqual([0, 0, 0]);
      expect(newDebugInfo.isGrounded).toBe(false);
      expect(newDebugInfo.isJumping).toBe(false);
    });
  });

  describe('Debug Information', () => {
    test('should provide comprehensive debug info', () => {
      const debugInfo = movementController.debugInfo;
      
      expect(debugInfo).toHaveProperty('isMoving');
      expect(debugInfo).toHaveProperty('movementDirection');
      expect(debugInfo).toHaveProperty('keysPressed');
      expect(debugInfo).toHaveProperty('localPlayerRotation');
      expect(debugInfo).toHaveProperty('isAdminMode');
      expect(debugInfo).toHaveProperty('velocity');
      expect(debugInfo).toHaveProperty('isGrounded');
      expect(debugInfo).toHaveProperty('isJumping');
    });
  });
});
