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

### skeleton_walk.glb
- **Source**: Exported from skeleton_with_walk.blend
- **License**: CC0
- **Usage**: Web-optimized skeleton model with walking animation
- **Status**: ✅ Ready for use in game
- **Animation**: Walking cycle included
- **File Size**: 1.46 MB


### Converting Blend to GLB

To use the `human_male.blend` file in the web application, it needs to be converted to GLB format:

#### Method 1: Using Blender (Recommended)
1. Open `human_male.blend` in Blender
2. Go to **File > Export > glTF 2.0 (.glb/.gltf)**
3. Choose **GLB** format (binary)
4. Set filename to `human_male.glb`
5. Click **Export glTF 2.0**

#### Method 2: Using Blender Command Line
```bash
# Navigate to the 3d-models directory
cd client/public/assets/3d-models/

# Convert using Blender command line (requires Blender installed)
blender human_male.blend --background --python-expr "
import bpy
bpy.ops.export_scene.gltf(filepath='human_male.glb', export_format='GLB')
bpy.ops.wm.quit_blender()
"
```

#### Method 3: Online Converters
- [Aspose 3D Converter](https://products.aspose.app/3d/conversion/blend-to-glb)
- [AnyConv](https://anyconv.com/blend-to-glb-converter/)

**Note**: Once converted, the game will automatically use the GLB model instead of the cube fallback.

### Animation Support

The skeleton model (`skeleton_walk.glb`) includes a pre-built walking animation:
- **Animation name**: `WalkCycle`
- **Duration**: 1.33 seconds (loops seamlessly)
- **Usage**: See `ANIMATION_USAGE.md` for implementation details

For custom animations, use the source files (`skeleton.blend` or `skeleton_with_walk.blend`) and the animation scripts provided in this directory.

---

**Note**: Always verify licensing terms before using any 3D models in commercial projects. When in doubt, use CC0 or create original assets.
