import * as THREE from 'three';
import { SceneryGenerator } from './sceneryGenerator';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  private animationId: number | null = null;

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

  async loadScenery(): Promise<void> {
    // Generate a complete floor with multiple rooms and hallways
    const floorResult = SceneryGenerator.generateCompleteFloor(this.scene, {
      minRooms: 3,
      maxRooms: 5,
      floorWidth: 60,
      floorHeight: 60,
      cubeSize: 1,
      roomHeight: 5
    });
    
    console.log(`Generated floor with ${floorResult.floorLayout.rooms.length} rooms`);
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
