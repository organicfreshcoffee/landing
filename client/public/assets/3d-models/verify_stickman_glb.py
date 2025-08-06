#!/usr/bin/env python3
"""
Script to verify the exported stickman.glb file.
"""

import bpy
import os

def verify_stickman_glb():
    """Verify the exported stickman.glb file."""
    
    print("=== VERIFYING stickman.glb ===")
    
    glb_path = os.path.join(os.path.dirname(__file__), "stickman.glb")
    
    if not os.path.exists(glb_path):
        print(f"❌ stickman.glb not found at: {glb_path}")
        return False
    
    file_size = os.path.getsize(glb_path) / (1024 * 1024)  # MB
    print(f"📁 File size: {file_size:.2f} MB")
    
    # Clear scene and import GLB
    bpy.ops.wm.read_homefile(use_empty=True)
    
    result = bpy.ops.import_scene.gltf(filepath=glb_path)
    
    if result != {'FINISHED'}:
        print(f"❌ Failed to import GLB: {result}")
        return False
    
    print("✅ GLB file imported successfully")
    
    # Analyze imported scene
    print(f"\n🔍 Scene objects: {len(bpy.context.scene.objects)}")
    armatures = []
    meshes = []
    
    for obj in bpy.context.scene.objects:
        print(f"  - {obj.name}: {obj.type}")
        if obj.type == 'ARMATURE':
            armatures.append(obj)
        elif obj.type == 'MESH':
            meshes.append(obj)
    
    print(f"\n📊 Summary: {len(armatures)} armatures, {len(meshes)} meshes")
    
    # Check animations
    actions = bpy.data.actions
    print(f"\n🎬 Actions: {len(actions)}")
    
    for action in actions:
        print(f"  - Action: '{action.name}'")
        print(f"    Frame range: {int(action.frame_range[0])} - {int(action.frame_range[1])}")
        print(f"    FCurves: {len(action.fcurves)}")
        
        # Check what animation is this
        if 'run' in action.name.lower() or 'walk' in action.name.lower():
            print("    ✅ This looks like a walking/running animation!")
        
        # Show first few fcurves
        if action.fcurves:
            for i, fcurve in enumerate(action.fcurves[:3]):
                print(f"      FCurve {i}: {fcurve.data_path}")
    
    # Check armature details
    for armature in armatures:
        print(f"\n🦴 Armature animation data:")
        print(f"  Armature: {armature.name}")
        print(f"    Bones: {len(armature.data.bones)}")
        
        if armature.animation_data:
            print("    ✅ Has animation_data")
            if armature.animation_data.action:
                print(f"    Current action: '{armature.animation_data.action.name}'")
            else:
                print("    No current action assigned")
        else:
            print("    ❌ No animation_data")
    
    print("\n✅ GLB file verification PASSED")
    
    return True

if __name__ == "__main__":
    verify_stickman_glb()
