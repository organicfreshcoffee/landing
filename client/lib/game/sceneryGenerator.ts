import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { ModelLoader } from './modelLoader';

export class SceneryGenerator {
  static async loadFantasyTownScenery(scene: THREE.Scene): Promise<void> {
    const basePath = '/assets/3d-models/kenney_fantasy-town-kit_2.0/Models/GLB format/';
    
    // Define available assets
    const trees = ['tree.glb', 'tree-crooked.glb', 'tree-high.glb', 'tree-high-crooked.glb', 'tree-high-round.glb'];
    const rocks = ['rock-large.glb', 'rock-small.glb', 'rock-wide.glb'];
    
    // Load tree models
    const treeModels: THREE.Group[] = [];
    for (const treeName of trees) {
      const model = await ModelLoader.loadFantasyTownAsset(basePath, treeName);
      if (model) {
        treeModels.push(model);
      }
    }
    
    // Load rock models
    const rockModels: THREE.Group[] = [];
    for (const rockName of rocks) {
      const model = await ModelLoader.loadFantasyTownAsset(basePath, rockName);
      if (model) {
        rockModels.push(model);
      }
    }
    
    // Place trees in a scattered pattern
    if (treeModels.length > 0) {
      for (let x = -40; x <= 40; x += 8) {
        for (let z = -40; z <= 40; z += 8) {
          if (Math.random() < 0.3 && !(x >= -5 && x <= 5 && z >= -5 && z <= 5)) {
            const treeModel = treeModels[Math.floor(Math.random() * treeModels.length)].clone();
            treeModel.position.set(x + Math.random() * 4 - 2, 0, z + Math.random() * 4 - 2);
            treeModel.rotation.y = Math.random() * Math.PI * 2;
            treeModel.scale.set(1.5, 1.5, 1.5);
            scene.add(treeModel);
          }
        }
      }
    }
    
    // Place rocks scattered around
    if (rockModels.length > 0) {
      for (let i = 0; i < 30; i++) {
        const rockModel = rockModels[Math.floor(Math.random() * rockModels.length)].clone();
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        
        if (!(x >= -10 && x <= 10 && z >= -10 && z <= 10)) {
          rockModel.position.set(x, 0, z);
          rockModel.rotation.y = Math.random() * Math.PI * 2;
          scene.add(rockModel);
        }
      }
    }
    
    // Generate procedural buildings
    await this.generateProceduralBuildings(scene, basePath);
  }

  private static async generateProceduralBuildings(scene: THREE.Scene, basePath: string): Promise<void> {
    // Define building components - more variety
    const walls = ['wall.glb', 'wall-wood.glb'];
    const corners = ['wall-corner.glb', 'wall-wood-corner.glb'];
    const doors = ['wall-door.glb', 'wall-wood-door.glb'];
    const windows = ['wall-window-glass.glb', 'wall-wood-window-glass.glb', 'wall-window-small.glb'];
    const roofs = ['roof.glb', 'roof-high.glb', 'roof-gable.glb'];
    const roofCorners = ['roof-corner.glb', 'roof-high-corner.glb'];
    
    // Load building component models
    const buildingComponents: { [key: string]: THREE.Group[] } = {
      walls: [],
      corners: [],
      doors: [],
      windows: [],
      roofs: [],
      roofCorners: []
    };
    
    // Load all components with error handling
    const componentTypes = [
      { name: 'walls', assets: walls },
      { name: 'corners', assets: corners },
      { name: 'doors', assets: doors },
      { name: 'windows', assets: windows },
      { name: 'roofs', assets: roofs },
      { name: 'roofCorners', assets: roofCorners }
    ];

    for (const componentType of componentTypes) {
      for (const assetName of componentType.assets) {
        try {
          const model = await ModelLoader.loadFantasyTownAsset(basePath, assetName);
          if (model) {
            buildingComponents[componentType.name].push(model);
          }
        } catch (error) {
          console.warn(`Failed to load building component: ${assetName}`, error);
        }
      }
    }
    
    // Only generate buildings if we have the basic components
    if (buildingComponents.walls.length === 0) {
      console.warn('No wall components loaded, skipping building generation');
      return;
    }
    
    // Generate 4-6 buildings scattered around the map
    const numBuildings = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numBuildings; i++) {
      this.generateSingleBuilding(scene, buildingComponents, i);
    }
  }

  private static generateSingleBuilding(scene: THREE.Scene, components: { [key: string]: THREE.Group[] }, buildingIndex: number): void {
    if (components.walls.length === 0) return;
    
    // Choose building position (avoid center and other buildings) - more spread out positions
    const positions = [
      { x: 30, z: 30 }, { x: -30, z: 30 }, { x: 30, z: -30 }, { x: -30, z: -30 },
      { x: 40, z: 0 }, { x: -40, z: 0 }, { x: 0, z: 40 }, { x: 0, z: -40 },
      { x: 25, z: -15 }, { x: -25, z: 15 }, { x: 15, z: 35 }, { x: -15, z: -35 }
    ];
    
    if (buildingIndex >= positions.length) return;
    const pos = positions[buildingIndex];
    
    // Building parameters - more variety
    const width = 2 + Math.floor(Math.random() * 4); // 2-5 units wide
    const depth = 2 + Math.floor(Math.random() * 4); // 2-5 units deep
    
    const buildingGroup = new THREE.Group();
    buildingGroup.position.set(pos.x, 0, pos.z);
    
    // Choose consistent style (stone or wood)
    const useWood = Math.random() < 0.5;
    const wallStyle = useWood ? 1 : 0; // Index for wall style
    
    // Helper function to set material properties
    const setMaterialProperties = (child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    };

    // Build walls
    this.buildWalls(buildingGroup, components, width, depth, wallStyle, setMaterialProperties);
    this.buildCorners(buildingGroup, components, width, depth, wallStyle, setMaterialProperties);
    this.buildRoof(buildingGroup, components, width, depth, wallStyle, setMaterialProperties);
    
    scene.add(buildingGroup);
  }

  private static buildWalls(
    buildingGroup: THREE.Group,
    components: { [key: string]: THREE.Group[] },
    width: number,
    depth: number,
    wallStyle: number,
    setMaterialProperties: (child: THREE.Object3D) => void
  ): void {
    const wallSpacing = 1.0; // Reduced spacing for better connection
    
    // Front wall (with door) - facing forward (no rotation needed)
    for (let x = 0; x < width; x++) {
      let wallComponent;
      if (x === Math.floor(width / 2) && components.doors.length > 0) {
        // Place door in the middle of front wall
        wallComponent = components.doors[wallStyle % components.doors.length].clone();
      } else if (Math.random() < 0.3 && components.windows.length > 0) {
        // 30% chance for window
        wallComponent = components.windows[wallStyle % components.windows.length].clone();
      } else {
        wallComponent = components.walls[wallStyle % components.walls.length].clone();
      }
      
      wallComponent.position.set(x * wallSpacing, 0, 0);
      // No rotation for front wall - it faces forward naturally
      wallComponent.traverse(setMaterialProperties);
      buildingGroup.add(wallComponent);
    }
    
    // Back wall - faces backward
    for (let x = 0; x < width; x++) {
      let wallComponent;
      if (Math.random() < 0.2 && components.windows.length > 0) {
        // 20% chance for window on back wall
        wallComponent = components.windows[wallStyle % components.windows.length].clone();
      } else {
        wallComponent = components.walls[wallStyle % components.walls.length].clone();
      }
      
      wallComponent.position.set((width - 1 - x) * wallSpacing, 0, (depth - 1) * wallSpacing);
      wallComponent.rotation.y = Math.PI; // Rotate 180 degrees to face inward
      wallComponent.traverse(setMaterialProperties);
      buildingGroup.add(wallComponent);
    }
    
    // Left wall - faces right (toward positive X)
    for (let z = 1; z < depth - 1; z++) {
      let wallComponent;
      if (Math.random() < 0.3 && components.windows.length > 0) {
        wallComponent = components.windows[wallStyle % components.windows.length].clone();
      } else {
        wallComponent = components.walls[wallStyle % components.walls.length].clone();
      }
      
      wallComponent.position.set(0, 0, z * wallSpacing);
      wallComponent.rotation.y = Math.PI / 2; // Rotate 90 degrees right to face inward
      wallComponent.traverse(setMaterialProperties);
      buildingGroup.add(wallComponent);
    }
    
    // Right wall - faces left (toward negative X) 
    for (let z = 1; z < depth - 1; z++) {
      let wallComponent;
      if (Math.random() < 0.3 && components.windows.length > 0) {
        wallComponent = components.windows[wallStyle % components.windows.length].clone();
      } else {
        wallComponent = components.walls[wallStyle % components.walls.length].clone();
      }
      
      wallComponent.position.set((width - 1) * wallSpacing, 0, (depth - 1 - z) * wallSpacing);
      wallComponent.rotation.y = -Math.PI / 2; // Rotate 90 degrees left to face inward
      wallComponent.traverse(setMaterialProperties);
      buildingGroup.add(wallComponent);
    }
  }

  private static buildCorners(
    buildingGroup: THREE.Group,
    components: { [key: string]: THREE.Group[] },
    width: number,
    depth: number,
    wallStyle: number,
    setMaterialProperties: (child: THREE.Object3D) => void
  ): void {
    if (components.corners.length === 0) return;

    const wallSpacing = 1.0;
    const cornerPositions = [
      { x: 0, z: 0, rotation: 0 }, // Front-left corner
      { x: (width - 1) * wallSpacing, z: 0, rotation: -Math.PI / 2 }, // Front-right corner
      { x: (width - 1) * wallSpacing, z: (depth - 1) * wallSpacing, rotation: Math.PI }, // Back-right corner
      { x: 0, z: (depth - 1) * wallSpacing, rotation: Math.PI / 2 } // Back-left corner
    ];

    cornerPositions.forEach(pos => {
      const corner = components.corners[wallStyle % components.corners.length].clone();
      corner.position.set(pos.x, 0, pos.z);
      corner.rotation.y = pos.rotation;
      corner.traverse(setMaterialProperties);
      buildingGroup.add(corner);
    });
  }

  private static buildRoof(
    buildingGroup: THREE.Group,
    components: { [key: string]: THREE.Group[] },
    width: number,
    depth: number,
    wallStyle: number,
    setMaterialProperties: (child: THREE.Object3D) => void
  ): void {
    if (components.roofs.length === 0) return;

    const wallSpacing = 1.0;
    const baseRoofHeight = 2.0; // Base height for roof

    // Create a simple sloped roof - higher in the middle
    const centerX = (width - 1) * wallSpacing / 2;
    const centerZ = (depth - 1) * wallSpacing / 2;
    const maxRoofHeight = baseRoofHeight + Math.min(width, depth) * 0.3; // Peak height

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        let roofComponent;
        
        // Use corner pieces for roof corners if available
        if (components.roofCorners.length > 0 && 
            ((x === 0 || x === width - 1) && (z === 0 || z === depth - 1))) {
          roofComponent = components.roofCorners[wallStyle % components.roofCorners.length].clone();
          
          // Set proper corner rotation for roof corners
          if (x === 0 && z === 0) roofComponent.rotation.y = 0;
          else if (x === width - 1 && z === 0) roofComponent.rotation.y = -Math.PI / 2;
          else if (x === width - 1 && z === depth - 1) roofComponent.rotation.y = Math.PI;
          else if (x === 0 && z === depth - 1) roofComponent.rotation.y = Math.PI / 2;
        } else {
          roofComponent = components.roofs[wallStyle % components.roofs.length].clone();
        }
        
        // Calculate sloped height - create a pyramid-like roof
        const posX = x * wallSpacing;
        const posZ = z * wallSpacing;
        const distanceFromCenter = Math.sqrt(
          Math.pow(posX - centerX, 2) + Math.pow(posZ - centerZ, 2)
        );
        const maxDistance = Math.sqrt(centerX * centerX + centerZ * centerZ);
        const heightRatio = Math.max(0, 1 - (distanceFromCenter / maxDistance));
        const roofHeight = baseRoofHeight + (maxRoofHeight - baseRoofHeight) * heightRatio;
        
        roofComponent.position.set(posX, roofHeight, posZ);
        roofComponent.traverse(setMaterialProperties);
        buildingGroup.add(roofComponent);
      }
    }
  }
}
