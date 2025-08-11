import * as THREE from 'three';
import { ServerSceneryGenerator } from '../generators/serverSceneryGenerator';

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
    // Enhanced lighting setup for better 3D visualization
    
    // Ambient light - provides soft overall illumination (slightly brighter)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Main directional light - simulates sunlight (positioned closer for stronger effect)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true;
    
    // Configure shadow properties for better quality
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    this.scene.add(directionalLight);

    // Secondary directional light for fill lighting (warmer tone)
    const fillLight = new THREE.DirectionalLight(0xffd68a, 0.5);
    fillLight.position.set(-8, 8, -3);
    this.scene.add(fillLight);

    // Point lights for dynamic lighting in rooms (positioned lower and brighter)
    const pointLight1 = new THREE.PointLight(0xffaa44, 1.2, 20);
    pointLight1.position.set(0, 6, 0);
    pointLight1.castShadow = true;
    pointLight1.shadow.mapSize.width = 1024;
    pointLight1.shadow.mapSize.height = 1024;
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.8, 15);
    pointLight2.position.set(8, 4, 8);
    pointLight2.castShadow = true;
    pointLight2.shadow.mapSize.width = 1024;
    pointLight2.shadow.mapSize.height = 1024;
    this.scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xffffff, 0.8, 15);
    pointLight3.position.set(-8, 4, -8);
    pointLight3.castShadow = true;
    pointLight3.shadow.mapSize.width = 1024;
    pointLight3.shadow.mapSize.height = 1024;
    this.scene.add(pointLight3);

    console.log('🔆 Enhanced lighting system initialized with stronger illumination');
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
          cubeSize: 1
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
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x666666,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add walls with better materials to show lighting
    const wallGeometry = new THREE.BoxGeometry(1, 5, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xdddddd,
      roughness: 0.7,
      metalness: 0.1
    });
    
    const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall1.position.set(-10, 2.5, 0);
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    this.scene.add(wall1);
    
    const wall2 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall2.position.set(10, 2.5, 0);
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    this.scene.add(wall2);

    // Add some test cubes to better show lighting effects
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff6b6b,
      roughness: 0.5,
      metalness: 0.3
    });
    
    const cube1 = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube1.position.set(0, 1, 5);
    cube1.castShadow = true;
    cube1.receiveShadow = true;
    this.scene.add(cube1);
    
    const cube2 = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube2.position.set(5, 1, -5);
    cube2.castShadow = true;
    cube2.receiveShadow = true;
    this.scene.add(cube2);

    console.log('Loaded enhanced fallback scenery with better lighting materials');
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
