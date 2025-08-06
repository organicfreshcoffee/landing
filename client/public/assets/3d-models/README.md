# 3D Models

This directory contains 3D model files used in the Organic Fresh Coffee landing page application.

## Directory Location

This directory is located at `client/public/assets/3d-models/` to ensure 3D models are served as static assets by Next.js. Files in the `public` directory can be referenced directly in your components using paths like `/assets/3d-models/filename.glb`.

## Usage in Next.js

To use 3D models in your Next.js components:

```javascript
// For Three.js with React Three Fiber
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

function CoffeeModel() {
  const gltf = useLoader(GLTFLoader, '/assets/3d-models/coffee-cup.glb')
  return <primitive object={gltf.scene} />
}

// Or for direct URL references
const modelUrl = '/assets/3d-models/coffee-beans.glb'
```

## File Formats

- **`.glb`** - Binary glTF files (recommended for web)
- **`.gltf`** - Text-based glTF files with separate assets
- **`.fbx`** - Autodesk FBX format
- **`.obj`** - Wavefront OBJ format
- **`.blend`** - Blender source files

## Sources and Credits

### Free 3D Model Resources

- **[Sketchfab](https://sketchfab.com/)** - Large collection of free and paid 3D models
- **[Poly Haven](https://polyhaven.com/)** - Free CC0 3D models, textures, and HDRIs
- **[OpenGameArt](https://opengameart.org/)** - Community-driven free game assets
- **[Free3D](https://free3d.com/)** - Mix of free and paid 3D models
- **[TurboSquid](https://www.turbosquid.com/)** - Professional 3D models (mostly paid)
- **[CGTrader](https://www.cgtrader.com/)** - Marketplace for 3D models
- **[Blender Market](https://blendermarket.com/)** - Blender-specific assets and models

### Coffee-Related Model Sources

- **Coffee beans and grounds**
- **Coffee cups and mugs**
- **Coffee machines and equipment**
- **Coffee shop furniture and decor**
- **Coffee packaging and branding elements**

## Usage Guidelines

1. **License Compliance**: Always check the license of downloaded models
   - **CC0**: Public domain, no attribution required
   - **CC BY**: Attribution required
   - **Royalty-free**: Can be used without ongoing payments
   - **Editorial use**: May have restrictions on commercial use

2. **Attribution Format** (when required):
   ```
   Model Name by Author Name (Source URL)
   Licensed under [License Type]
   ```

3. **File Organization**:
   - Use descriptive filenames
   - Group related models in subfolders
   - Include source information in comments or separate text files

## Optimization for Web

When using 3D models in web applications:

- **Use glTF/GLB format** for best performance
- **Optimize polygon count** for smooth rendering
- **Compress textures** to reduce file size
- **Use Draco compression** for geometry compression
- **Consider LOD (Level of Detail)** for complex scenes

## Tools for 3D Model Processing

- **[Blender](https://www.blender.org/)** - Free, open-source 3D software
- **[glTF-Pipeline](https://github.com/CesiumGS/gltf-pipeline)** - Command-line tools for glTF optimization
- **[Draco](https://github.com/google/draco)** - 3D geometry compression
- **[Meshlab](https://www.meshlab.net/)** - Mesh processing and optimization

## Contributing

When adding new 3D models to this directory:

1. Include source attribution in this README
2. Verify license compatibility with project usage
3. Optimize files for web performance
4. Use consistent naming conventions
5. Update this documentation with new additions

## Current Models

### human_male.blend
- **Source**: [Original Blender file](https://opengameart.org/content/low-poly-human-male)
- **License**: CC0
- **Usage**: Character model for player avatars
- **Status**: ✅ Source file

### human_male.glb
- **Source**: Converted from human_male.blend
- **License**: CC0
- **Usage**: Character model for player avatars (web-optimized)
- **Status**: ✅ Ready for use in game

### skeleton.blend
- **Source**: [Original Blender file](https://opengameart.org/content/skeleton-with-rig)
- **License**: CC0
- **Usage**: Character model for player avatars
- **Status**: ✅ Source file (no animations)

### skeleton_with_walk.blend
- **Source**: Generated from skeleton.blend with custom walking animation
- **License**: CC0
- **Usage**: Character model with walking animation for gameplay
- **Status**: ✅ Source file with animation
- **Animation**: 40-frame walk cycle (1.33 seconds at 30fps)

### stickman.glb (ACTIVE)
- **Source**: Exported from StickMan.blend
- **License**: CC0
- **Usage**: Web-optimized stick figure model with running animation for gameplay
- **Status**: ✅ Currently used in game
- **Animation**: 20-frame StickMan_Run cycle + SitckMan_Idle
- **File Size**: 0.06 MB
- **Advantages**: Professional animations, smaller file size, better performance

### stickman_idle.glb
- **Source**: Exported from StickMan.blend
- **License**: CC0
- **Usage**: Idle animation version of stick figure
- **Status**: ✅ Available for future use
- **Animation**: 111-frame SitckMan_Idle cycle
- **File Size**: 0.07 MB

### skeleton_walk.glb (REPLACED)
- **Source**: Exported from skeleton_with_walk.blend
- **License**: CC0
- **Usage**: Web-optimized skeleton model with walking animation
- **Status**: 🔄 Replaced by stickman.glb (better performance)
- **Animation**: Walking cycle included
- **File Size**: 1.46 MB

### StickMan.blend
- **Source**: [Original Blender file](https://opengameart.org/content/creomotos-stick-man-fixed-up)
- **License**: CC0
- **Usage**: Character model for player avatars with professional animations
- **Status**: ✅ Source file (includes StickMan_Run and SitckMan_Idle animations)

### Animation Support

The stick figure model (`stickman.glb`) includes professional pre-built animations:
- **StickMan_Run**: 20-frame running/walking animation (0.67 seconds, loops seamlessly)
- **SitckMan_Idle**: 111-frame idle animation (available in stickman_idle.glb)
- **Usage**: Game automatically uses StickMan_Run for movement animation
- **Performance**: Much better than skeleton model (0.06 MB vs 1.46 MB)

---

**Note**: Always verify licensing terms before using any 3D models in commercial projects. When in doubt, use CC0 or create original assets.
