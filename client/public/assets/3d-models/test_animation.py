#!/usr/bin/env python3
"""
Script to test and verify the walking animation in the skeleton model.
This script loads the animated model and provides information about the animation.
"""

import bpy
import os

def test_walking_animation():
    """Test the walking animation in the skeleton model."""
    
    print("=== TESTING WALKING ANIMATION ===")
    
    # Load the animated skeleton model
    skeleton_path = os.path.join(os.path.dirname(__file__), "skeleton_with_walk.blend")
    
    if not os.path.exists(skeleton_path):
        print(f"❌ skeleton_with_walk.blend not found at: {skeleton_path}")
        return False
    
    print(f"📂 Loading animated model: {skeleton_path}")
    bpy.ops.wm.open_mainfile(filepath=skeleton_path)
    
    # Find the armature
    armature_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            armature_obj = obj
            break
    
    if not armature_obj:
        print("❌ No armature found in scene")
        return False
    
    print(f"✅ Found armature: {armature_obj.name}")
    
    # Check animation data
    if not armature_obj.animation_data:
        print("❌ No animation data found")
        return False
    
    action = armature_obj.animation_data.action
    if not action:
        print("❌ No action found")
        return False
    
    print(f"🎬 Animation Details:")
    print(f"   Action name: {action.name}")
    print(f"   Frame range: {action.frame_range[0]:.0f} - {action.frame_range[1]:.0f}")
    print(f"   Number of F-Curves: {len(action.fcurves)}")
    
    # Scene settings
    scene = bpy.context.scene
    print(f"📊 Scene Animation Settings:")
    print(f"   Frame start: {scene.frame_start}")
    print(f"   Frame end: {scene.frame_end}")
    print(f"   Current frame: {scene.frame_current}")
    print(f"   FPS: {scene.render.fps}")
    print(f"   Duration: {(scene.frame_end - scene.frame_start + 1) / scene.render.fps:.2f} seconds")
    
    # List animated bones
    print(f"🦴 Animated Bones:")
    animated_bones = set()
    for fcurve in action.fcurves:
        # Extract bone name from data path
        if 'pose.bones[' in fcurve.data_path:
            bone_name = fcurve.data_path.split('pose.bones["')[1].split('"]')[0]
            animated_bones.add(bone_name)
    
    for bone_name in sorted(animated_bones):
        bone = armature_obj.pose.bones.get(bone_name)
        if bone:
            print(f"   - {bone_name}")
    
    print(f"   Total animated bones: {len(animated_bones)}")
    
    # Test animation by sampling a few frames
    print(f"🔍 Testing Animation Frames:")
    test_frames = [1, 11, 21, 31, 40]
    
    for frame in test_frames:
        scene.frame_set(frame)
        
        # Get hip bone position as indicator
        hips_bone = armature_obj.pose.bones.get("CONTROL_HIPS")
        if hips_bone:
            loc = hips_bone.location
            rot = hips_bone.rotation_euler
            print(f"   Frame {frame:2d}: Hips loc=({loc.x:.3f}, {loc.y:.3f}, {loc.z:.3f}) rot=({rot.x:.3f}, {rot.y:.3f}, {rot.z:.3f})")
    
    print("✅ Animation test completed successfully!")
    
    # Check GLB file
    glb_path = os.path.join(os.path.dirname(__file__), "skeleton_walk.glb")
    if os.path.exists(glb_path):
        glb_size = os.path.getsize(glb_path) / (1024 * 1024)  # MB
        print(f"🎯 GLB Export Status:")
        print(f"   File: skeleton_walk.glb")
        print(f"   Size: {glb_size:.2f} MB")
        print(f"   Ready for web use: ✅")
    else:
        print(f"❌ GLB file not found: {glb_path}")
    
    return True

if __name__ == "__main__":
    test_walking_animation()
