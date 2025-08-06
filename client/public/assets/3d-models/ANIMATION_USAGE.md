# Using the Animated Skeleton Model

The skeleton model now includes a walking animation! Here's how to use it in your React Three Fiber application.

## Quick Start

```javascript
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { useAnimations } from '@react-three/drei'
import { useRef, useEffect } from 'react'

function SkeletonWithWalk() {
  const group = useRef()
  const gltf = useLoader(GLTFLoader, '/assets/3d-models/skeleton_walk.glb')
  const { actions } = useAnimations(gltf.animations, group)
  
  useEffect(() => {
    // Play the walking animation
    if (actions.WalkCycle) {
      actions.WalkCycle.play()
    }
  }, [actions])
  
  return (
    <group ref={group}>
      <primitive object={gltf.scene} />
    </group>
  )
}
```

## Animation Details

- **Animation Name**: `WalkCycle`
- **Duration**: 1.33 seconds (40 frames at 30fps)
- **Loop**: Designed to loop seamlessly
- **Bones Animated**: 10 key bones including:
  - Hips (CONTROL_HIPS) - Vertical bob and forward movement
  - Left/Right Feet (CONTROL_FOOT.L/R) - Step cycle with opposite phases
  - Left/Right Arms (HUMERUS.L/R) - Natural arm swing
  - Chest (CONTROL_CHEST) - Subtle counter-rotation

## Advanced Usage

### Control Animation Speed

```javascript
useEffect(() => {
  if (actions.WalkCycle) {
    actions.WalkCycle.setEffectiveTimeScale(1.5) // 50% faster
    actions.WalkCycle.play()
  }
}, [actions])
```

### Animation States

```javascript
const [isWalking, setIsWalking] = useState(false)

useEffect(() => {
  if (actions.WalkCycle) {
    if (isWalking) {
      actions.WalkCycle.play()
    } else {
      actions.WalkCycle.stop()
    }
  }
}, [actions, isWalking])
```

### Blend Multiple Animations

```javascript
// If you add more animations later, you can blend them
useEffect(() => {
  if (actions.WalkCycle && actions.IdleAnimation) {
    actions.WalkCycle.fadeIn(0.5)
    actions.IdleAnimation.fadeOut(0.5)
  }
}, [actions])
```

## File Information

- **Source File**: `skeleton_with_walk.blend` (1.91 MB)
- **Web File**: `skeleton_walk.glb` (1.46 MB)
- **Format**: glTF 2.0 Binary (.glb)
- **Animation**: Included and optimized for web
- **Compatibility**: Works with Three.js, React Three Fiber, and other WebGL frameworks

## Troubleshooting

### Animation Not Playing
Make sure you have the `@react-three/drei` package installed:
```bash
npm install @react-three/drei
```

### Performance Optimization
For better performance with multiple instances:
```javascript
import { useGLTF } from '@react-three/drei'

// This will reuse the loaded model
function SkeletonInstance(props) {
  const { scene, animations } = useGLTF('/assets/3d-models/skeleton_walk.glb')
  return <SkeletonWithWalk scene={scene.clone()} animations={animations} {...props} />
}
```

## Next Steps

You can extend this model by:
1. Adding more animations (idle, run, jump, etc.)
2. Implementing character controls
3. Adding materials and textures
4. Creating variations for different characters

The rig is very detailed with 237 bones, so it supports complex animations if needed.
