#!/usr/bin/env python3
"""
Verify the skeleton_walk.glb file contains proper animation data
"""

import bpy
import os

def verify_glb_animation():
    """Verify the skeleton GLB has proper animations"""
    
    print("=== VERIFYING skeleton_walk.glb ===")
    
    # Clear scene first
    bpy.ops.wm.read_homefile(use_empty=True)
    
    # Path to the GLB file
    glb_path = os.path.join(os.path.dirname(__file__), "skeleton_walk.glb")
    
    if not os.path.exists(glb_path):
        print(f"❌ GLB file not found: {glb_path}")
        return False
    
    file_size = os.path.getsize(glb_path) / (1024 * 1024)  # MB
    print(f"📁 File size: {file_size:.2f} MB")
    
    try:
        # Import the GLB file
        bpy.ops.import_scene.gltf(filepath=glb_path)
        print("✅ GLB file imported successfully")
    except Exception as e:
        print(f"❌ Failed to import GLB: {e}")
        return False
    
    # Check scene objects
    print(f"\n🔍 Scene objects: {len(bpy.context.scene.objects)}")
    armature_count = 0
    mesh_count = 0
    
    for obj in bpy.context.scene.objects:
        print(f"  - {obj.name}: {obj.type}")
        if obj.type == 'ARMATURE':
            armature_count += 1
        elif obj.type == 'MESH':
            mesh_count += 1
    
    print(f"\n📊 Summary: {armature_count} armatures, {mesh_count} meshes")
    
    # Check actions (animations)
    print(f"\n🎬 Actions: {len(bpy.data.actions)}")
    animation_found = False
    
    for action in bpy.data.actions:
        print(f"  - Action: '{action.name}'")
        print(f"    Frame range: {action.frame_range[0]:.0f} - {action.frame_range[1]:.0f}")
        print(f"    FCurves: {len(action.fcurves)}")
        
        if action.name == 'WalkCycle':
            animation_found = True
            print("    ✅ WalkCycle animation found!")
            
            # Show some FCurve details
            for i, fcurve in enumerate(action.fcurves[:3]):
                print(f"      FCurve {i}: {fcurve.data_path} [{fcurve.array_index}]")
    
    if not animation_found:
        print("    ❌ WalkCycle animation NOT found!")
        print("    Available actions:", [action.name for action in bpy.data.actions])
    
    # Check armature animation data
    print(f"\n🦴 Armature animation data:")
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            print(f"  Armature: {obj.name}")
            print(f"    Bones: {len(obj.data.bones)}")
            
            if obj.animation_data:
                print(f"    ✅ Has animation_data")
                if obj.animation_data.action:
                    print(f"    Current action: '{obj.animation_data.action.name}'")
                else:
                    print(f"    No current action set")
            else:
                print(f"    ❌ No animation_data")
    
    success = animation_found and armature_count > 0
    
    if success:
        print(f"\n✅ GLB file verification PASSED")
    else:
        print(f"\n❌ GLB file verification FAILED")
        if not animation_found:
            print("   - Missing WalkCycle animation")
        if armature_count == 0:
            print("   - No armatures found")
    
    return success

if __name__ == "__main__":
    verify_glb_animation()
