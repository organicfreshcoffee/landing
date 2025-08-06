#!/usr/bin/env python3
"""
Script to inspect the StickMan.blend file for animations and structure.
"""

import bpy
import os

def inspect_stickman():
    """Inspect StickMan.blend for animations and structure."""
    
    print("=== INSPECTING STICKMAN.BLEND ===")
    
    # Clear existing scene and load StickMan
    bpy.ops.wm.read_homefile(use_empty=True)
    stickman_path = os.path.join(os.path.dirname(__file__), "StickMan.blend")
    
    if not os.path.exists(stickman_path):
        print(f"❌ StickMan.blend not found at: {stickman_path}")
        return False
    
    print(f"📂 Loading: {stickman_path}")
    bpy.ops.wm.open_mainfile(filepath=stickman_path)
    
    # Inspect scene objects
    print("\n🔍 Scene objects:")
    armatures = []
    meshes = []
    for obj in bpy.context.scene.objects:
        print(f"  - {obj.name}: {obj.type}")
        if obj.type == 'ARMATURE':
            armatures.append(obj)
        elif obj.type == 'MESH':
            meshes.append(obj)
    
    print(f"\n📊 Summary: {len(armatures)} armatures, {len(meshes)} meshes")
    
    # Check for animations
    print("\n🎬 Checking for animations...")
    
    # Check actions in the file
    actions = bpy.data.actions
    print(f"Actions in file: {len(actions)}")
    
    for action in actions:
        print(f"  - Action: '{action.name}'")
        print(f"    Frame range: {int(action.frame_range[0])} - {int(action.frame_range[1])}")
        print(f"    FCurves: {len(action.fcurves)}")
        
        # Show first few fcurves for context
        if action.fcurves:
            for i, fcurve in enumerate(action.fcurves[:3]):
                print(f"      FCurve {i}: {fcurve.data_path}")
    
    # Check armatures for animation data
    for armature in armatures:
        print(f"\n🦴 Armature: {armature.name}")
        print(f"    Bones: {len(armature.data.bones)}")
        
        if armature.animation_data:
            print("    ✅ Has animation_data")
            if armature.animation_data.action:
                print(f"    Current action: '{armature.animation_data.action.name}'")
            else:
                print("    No current action assigned")
        else:
            print("    ❌ No animation_data")
        
        # List some key bones
        pose_bones = armature.pose.bones if armature.pose else []
        print(f"    Pose bones: {len(pose_bones)}")
        
        # Show first 10 bones
        if pose_bones:
            print("    Key bones:")
            for i, bone in enumerate(list(pose_bones)[:10]):
                print(f"      - {bone.name}")
            if len(pose_bones) > 10:
                print(f"      ... and {len(pose_bones) - 10} more")
    
    # Check meshes for skinning
    print("\n🎭 Mesh analysis:")
    for mesh in meshes:
        print(f"  Mesh: {mesh.name}")
        modifiers = [mod for mod in mesh.modifiers if mod.type == 'ARMATURE']
        if modifiers:
            print(f"    ✅ Has armature modifier: {modifiers[0].object.name if modifiers[0].object else 'None'}")
        else:
            print("    ❌ No armature modifier")
        
        # Check for vertex groups (needed for skinning)
        if mesh.vertex_groups:
            print(f"    Vertex groups: {len(mesh.vertex_groups)}")
        else:
            print("    ❌ No vertex groups")
    
    print("\n" + "="*50)
    
    return True

if __name__ == "__main__":
    inspect_stickman()
