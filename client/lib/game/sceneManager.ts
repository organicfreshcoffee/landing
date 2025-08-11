import * as THREE from 'three';
import { ServerSceneryGenerator } from './serverSceneryGenerator';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private animationId: number | null = null;
  private currentFloorName: string | null = null;
  private serverAddress: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = this.createScene();
    this.camera = this.createCamera();
    this.renderer = this.createRenderer(canvas);
    this.setupLighting();
    this.setupEventListeners();
  }

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    return scene;
  }

  private createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01, // Much smaller near plane to avoid clipping
      1000
    );
    camera.position.set(0, 5, 10);
    return camera;
  }

  private createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = false;
    return renderer;
  }

  private setupLighting(): void {
    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  /**
   * Set the server address for API calls
   */
  setServerAddress(serverAddress: string): void {
    this.serverAddress = serverAddress;
    console.log(`🔧 SceneManager: Server address set to ${serverAddress}`);
  }

  async loadScenery(floorName?: string): Promise<void> {
    console.log(`🎮 SceneManager: Loading scenery. Server: ${this.serverAddress}, Floor: ${floorName || 'auto-detect'}`);
    
    if (!this.serverAddress) {
      console.error('❌ Server address not set. Call setServerAddress() first.');
      this.loadFallbackScenery();
      return;
    }

    try {
      // Get spawn location if no floor specified
      if (!floorName) {
        floorName = await ServerSceneryGenerator.getSpawnLocation(this.serverAddress);
      }

      // Clear existing scenery
      ServerSceneryGenerator.clearScene(this.scene);

      // Generate floor from server data
      const floorResult = await ServerSceneryGenerator.generateServerFloor(
        this.scene, 
        this.serverAddress, 
        floorName, 
        {
          cubeSize: 1,
          roomHeight: 5,
          hallwayHeight: 5
        }
      );
      
      this.currentFloorName = floorName;
      console.log(`Loaded floor: ${floorName} with ${floorResult.floorLayout.rooms.length} rooms`);
    } catch (error) {
      console.error('Error loading scenery from server:', error);
      // Fallback to a simple test environment
      this.loadFallbackScenery();
    }
  }

  /**
   * Load a simple fallback environment if server fails
   */
  private loadFallbackScenery(): void {
    // Create a simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add a simple test room
    const wallGeometry = new THREE.BoxGeometry(1, 5, 20);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    
    const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall1.position.set(-10, 2.5, 0);
    this.scene.add(wall1);
    
    const wall2 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall2.position.set(10, 2.5, 0);
    this.scene.add(wall2);

    console.log('Loaded fallback scenery');
  }

  /**
   * Switch to a new floor
   */
  async switchFloor(newFloorName: string): Promise<void> {
    if (!this.serverAddress) {
      console.error('Server address not set. Cannot switch floors.');
      return;
    }

    if (this.currentFloorName !== newFloorName) {
      // Notify server about floor change
      try {
        await ServerSceneryGenerator.notifyPlayerMovedFloor(this.serverAddress, newFloorName);
      } catch (error) {
        console.warn('Failed to notify server of floor change:', error);
      }
      
      // Load new floor
      await this.loadScenery(newFloorName);
    }
  }

  /**
   * Get current floor name
   */
  getCurrentFloor(): string | null {
    return this.currentFloorName;
  }

  private setupEventListeners(): void {
    const handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    
    // Store cleanup function
    (this as any).cleanupResize = () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  startRenderLoop(updateCallback?: () => void): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      if (updateCallback) {
        updateCallback();
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stopRenderLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  addToScene(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeFromScene(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  cleanup(): void {
    this.stopRenderLoop();
    
    if ((this as any).cleanupResize) {
      (this as any).cleanupResize();
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
