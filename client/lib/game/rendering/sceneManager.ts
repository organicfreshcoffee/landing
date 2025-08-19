import * as THREE from 'three';
import { ServerSceneryGenerator } from '../generators/sceneryGenerator';
import { CubeConfig } from '../config/cubeConfig';
import { StairInteractionManager } from '../ui/stairInteractionManager';

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
      85, // Increased FOV for more immersive view
      window.innerWidth / window.innerHeight,
      0.01, // Much smaller near plane to avoid clipping
      2000 // Increased far plane to ensure large dungeons are fully visible
    );
    // Much closer camera position for immersive first-person-like perspective
    // Height at player eye level and very close distance
    camera.position.set(0, CubeConfig.getPlayerEyeLevel(), 3);
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

  /**
   * Get the current server address
   */
  getServerAddress(): string | null {
    return this.serverAddress;
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

      // Clear existing scenery (preserve players and lights)
      ServerSceneryGenerator.clearSceneryOnly(this.scene);

      // Generate floor from server data
      const floorResult = await ServerSceneryGenerator.generateServerFloor(
        this.scene, 
        this.serverAddress, 
        floorName, 
        {
          cubeSize: CubeConfig.getCubeSize()
        }
      );
      
      this.currentFloorName = floorName;
      
      // Initialize stair interactions
      const stairManager = StairInteractionManager.getInstance();
      stairManager.initializeStairs(floorResult.floorLayout.data.tiles.upwardStairTiles, floorResult.floorLayout.data.tiles.downwardStairTiles);
      
      // Detailed rendering verification
      this.verifyFloorRendering(floorResult);
    } catch (error) {
      console.error('Error loading scenery from server:', error);
    }
  }

  /**
   * Verify that all floor elements are properly rendered
   */
  private verifyFloorRendering(floorResult: any): void {
    console.log(`🔍 Verifying floor rendering for ${this.currentFloorName}:`);
    console.log(`  📊 Statistics:`);
    console.log(`    • Rooms: ${floorResult.roomCount}`);
    console.log(`    • Hallways: ${floorResult.hallwayCount}`);
    console.log(`    • Total floor area: ${floorResult.totalArea} cubes`);
    console.log(`    • Wall cubes: ${floorResult.wallCount}`);
    console.log(`    • Overlapping cubes: ${floorResult.overlapCount}`);
    console.log(`    • Floor bounds: ${floorResult.floorLayout.bounds.width}x${floorResult.floorLayout.bounds.height}`);
    
    // Count rendered objects in scene
    let floorCubes = 0;
    let wallCubes = 0;
    let totalMeshes = 0;
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        totalMeshes++;
        if (object.name.includes('FloorCube')) {
          floorCubes++;
        } else if (object.name.includes('Wall')) {
          wallCubes++;
        }
      }
    });
    
    console.log(`  🎯 Scene verification:`);
    console.log(`    • Total meshes in scene: ${totalMeshes}`);
    console.log(`    • Floor cubes rendered: ${floorCubes}`);
    console.log(`    • Wall cubes rendered: ${wallCubes}`);
    
    // Warn if there are discrepancies
    if (floorCubes < floorResult.totalArea) {
      console.warn(`⚠️ Potential rendering issue: Expected ${floorResult.totalArea} floor cubes, but only ${floorCubes} found in scene`);
    }
    
    // Check camera distance to ensure everything is within render range
    const cameraPos = this.camera.position;
    const bounds = floorResult.floorLayout.bounds;
    const maxDistance = Math.max(
      Math.abs(bounds.width * CubeConfig.getCubeSize()),
      Math.abs(bounds.height * CubeConfig.getCubeSize())
    );
    
    console.log(`  📷 Camera verification:`);
    console.log(`    • Camera position: (${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)})`);
    console.log(`    • Camera far plane: ${this.camera.far}`);
    console.log(`    • Max floor distance: ${maxDistance.toFixed(1)}`);
    
    if (maxDistance > this.camera.far * 0.8) {
      console.warn(`⚠️ Potential clipping issue: Floor extends to ${maxDistance.toFixed(1)} units, camera far plane is ${this.camera.far}`);
    }
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
      // Load new floor (notification is handled by GameManager during transitions)
      await this.loadScenery(newFloorName);
    }
  }

  /**
   * Get current floor name
   */
  getCurrentFloor(): string | null {
    return this.currentFloorName;
  }

  /**
   * Force refresh the current floor to ensure all elements are properly rendered
   */
  async refreshCurrentFloor(): Promise<void> {
    if (this.currentFloorName && this.serverAddress) {
      console.log(`🔄 Refreshing current floor: ${this.currentFloorName}`);
      await this.loadScenery(this.currentFloorName);
    } else {
      console.warn('⚠️ Cannot refresh floor: no current floor or server address');
    }
  }

  /**
   * Verify floor integrity and refresh if issues are detected
   */
  async verifyAndRefreshFloor(): Promise<boolean> {
    if (!this.currentFloorName) {
      return false;
    }

    // Count expected vs actual floor cubes
    let actualFloorCubes = 0;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name.includes('FloorCube')) {
        actualFloorCubes++;
      }
    });

    // If we have very few floor cubes, something might be wrong
    if (actualFloorCubes < 10) {
      console.warn(`⚠️ Low floor cube count detected (${actualFloorCubes}), refreshing floor...`);
      await this.refreshCurrentFloor();
      return true;
    }

    return false;
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
    let frameCount = 0;
    let lastFPSCheck = performance.now();
    
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      if (updateCallback) {
        updateCallback();
      }
      
      this.renderer.render(this.scene, this.camera);
      
      // Monitor performance every 60 frames (approximately 1 second at 60fps)
      frameCount++;
      if (frameCount >= 60) {
        const now = performance.now();
        const fps = 60000 / (now - lastFPSCheck);
        
        // If FPS is very low, log a warning about potential rendering issues
        if (fps < 20) {
          console.warn(`⚠️ Low FPS detected: ${fps.toFixed(1)} fps. This might affect floor rendering.`);
          this.logSceneStats();
        }
        
        frameCount = 0;
        lastFPSCheck = now;
      }
    };
    animate();
  }

  /**
   * Log scene statistics for debugging rendering issues
   */
  private logSceneStats(): void {
    let meshCount = 0;
    let geometryCount = 0;
    let materialCount = 0;
    let floorCubes = 0;
    
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        meshCount++;
        if (object.geometry) geometryCount++;
        if (object.material) materialCount++;
        if (object.name.includes('FloorCube')) floorCubes++;
      }
    });
    
    console.log(`📊 Scene stats: ${meshCount} meshes, ${floorCubes} floor cubes, ${geometryCount} geometries, ${materialCount} materials`);
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
