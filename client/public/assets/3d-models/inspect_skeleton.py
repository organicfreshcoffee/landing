#!/usr/bin/env python3
"""
Script to inspect skeleton.blend file for animations, armatures, and rig information.
This script should be run with Blender's Python interpreter.
"""

import bpy
import os
import sys

def inspect_skeleton_model():
    """Inspect the skeleton.blend file for animations and rig data."""
    
    print("=== SKELETON MODEL INSPECTION ===")
    
    # Clear existing scene
    bpy.ops.wm.read_homefile(use_empty=True)
    
    # Load the skeleton.blend file
    skeleton_path = os.path.join(os.path.dirname(__file__), "skeleton.blend")
    
    if not os.path.exists(skeleton_path):
        print(f"❌ skeleton.blend not found at: {skeleton_path}")
        return False
    
    print(f"📂 Loading: {skeleton_path}")
    
    try:
        bpy.ops.wm.open_mainfile(filepath=skeleton_path)
    except Exception as e:
        print(f"❌ Failed to load file: {e}")
        return False
    
    # Inspect scene objects
    print(f"\n🔍 Scene Objects ({len(bpy.context.scene.objects)} total):")
    
    mesh_objects = []
    armature_objects = []
    
    for obj in bpy.context.scene.objects:
        print(f"  - {obj.name}: {obj.type}")
        if obj.type == 'MESH':
            mesh_objects.append(obj)
            # Check if mesh has armature modifier
            for modifier in obj.modifiers:
                if modifier.type == 'ARMATURE':
                    print(f"    ✅ Has Armature modifier: {modifier.object.name if modifier.object else 'None'}")
        elif obj.type == 'ARMATURE':
            armature_objects.append(obj)
    
    # Inspect armatures in detail
    print(f"\n🦴 Armature Analysis ({len(armature_objects)} found):")
    
    for armature_obj in armature_objects:
        armature = armature_obj.data
        print(f"\n  Armature: {armature_obj.name}")
        print(f"    Bones: {len(armature.bones)}")
        
        # List bones
        for bone in armature.bones:
            parent_name = bone.parent.name if bone.parent else "None"
            print(f"      - {bone.name} (parent: {parent_name})")
        
        # Check for pose mode data
        if armature_obj.pose:
            print(f"    Pose bones: {len(armature_obj.pose.bones)}")
    
    # Check for animations
    print(f"\n🎬 Animation Analysis:")
    
    if bpy.data.actions:
        print(f"    Actions found: {len(bpy.data.actions)}")
        for action in bpy.data.actions:
            print(f"      - {action.name}")
            print(f"        Frame range: {action.frame_range}")
            print(f"        Keyframes: {len(action.fcurves)}")
            
            # List animated properties
            for fcurve in action.fcurves:
                print(f"          {fcurve.data_path}[{fcurve.array_index}]")
    else:
        print("    ❌ No animations found")
    
    # Check animation data on objects
    for obj in bpy.context.scene.objects:
        if obj.animation_data and obj.animation_data.action:
            print(f"    Object {obj.name} has action: {obj.animation_data.action.name}")
    
    # Scene frame information
    scene = bpy.context.scene
    print(f"\n📊 Scene Settings:")
    print(f"    Frame start: {scene.frame_start}")
    print(f"    Frame end: {scene.frame_end}")
    print(f"    Frame current: {scene.frame_current}")
    print(f"    FPS: {scene.render.fps}")
    
    return True

if __name__ == "__main__":
    inspect_skeleton_model()
