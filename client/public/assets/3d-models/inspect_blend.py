#!/usr/bin/env python3
"""
Universal Blender model inspection script.
Inspects any .blend file for animations, armatures, and rig information.

Usage:
    blender --background --python inspect_blend.py -- <blend_filename>
    blender --background --python inspect_blend.py -- StickMan.blend
    blender --background --python inspect_blend.py -- skeleton.blend
"""

import bpy
import os
import sys

def inspect_blend_file(blend_filename):
    """Inspect a blend file for animations and rig data."""
    
    print(f"=== INSPECTING {blend_filename.upper()} ===")
    
    # Clear existing scene
    bpy.ops.wm.read_homefile(use_empty=True)
    
    # Load the blend file
    blend_path = os.path.join(os.path.dirname(__file__), blend_filename)
    
    if not os.path.exists(blend_path):
        print(f"❌ {blend_filename} not found at: {blend_path}")
        return False
    
    print(f"📂 Loading: {blend_path}")
    
    try:
        bpy.ops.wm.open_mainfile(filepath=blend_path)
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
    
    print(f"\n📊 Summary: {len(armature_objects)} armatures, {len(mesh_objects)} meshes")
    
    # Inspect armatures in detail
    print(f"\n🦴 Armature Analysis ({len(armature_objects)} found):")
    
    for armature_obj in armature_objects:
        armature = armature_obj.data
        print(f"\n  Armature: {armature_obj.name}")
        print(f"    Bones: {len(armature.bones)}")
        
        # List bones (show first 10 to avoid too much output)
        bone_list = list(armature.bones)
        for i, bone in enumerate(bone_list[:10]):
            parent_name = bone.parent.name if bone.parent else "None"
            print(f"      - {bone.name} (parent: {parent_name})")
        if len(bone_list) > 10:
            print(f"      ... and {len(bone_list) - 10} more bones")
        
        # Check for pose mode data
        if armature_obj.pose:
            print(f"    Pose bones: {len(armature_obj.pose.bones)}")
        
        # Check animation data on this armature
        if armature_obj.animation_data:
            print("    ✅ Has animation_data")
            if armature_obj.animation_data.action:
                print(f"    Current action: '{armature_obj.animation_data.action.name}'")
            else:
                print("    No current action assigned")
        else:
            print("    ❌ No animation_data")
    
    # Check for animations
    print(f"\n🎬 Animation Analysis:")
    
    if bpy.data.actions:
        print(f"    Actions found: {len(bpy.data.actions)}")
        for action in bpy.data.actions:
            print(f"\n      - Action: '{action.name}'")
            print(f"        Frame range: {int(action.frame_range[0])} - {int(action.frame_range[1])}")
            print(f"        Duration: {int(action.frame_range[1] - action.frame_range[0] + 1)} frames")
            print(f"        FCurves: {len(action.fcurves)}")
            
            # Identify animation type based on name
            anim_type = "Unknown"
            if any(keyword in action.name.lower() for keyword in ['run', 'walk']):
                anim_type = "Walking/Running"
            elif 'idle' in action.name.lower():
                anim_type = "Idle"
            elif 'cycle' in action.name.lower():
                anim_type = "Cycle"
            print(f"        Type: {anim_type}")
            
            # List animated properties (first few)
            if action.fcurves:
                print("        Animated properties:")
                for i, fcurve in enumerate(action.fcurves[:5]):
                    if hasattr(fcurve, 'data_path'):
                        array_info = f"[{fcurve.array_index}]" if hasattr(fcurve, 'array_index') else ""
                        print(f"          {fcurve.data_path}{array_info}")
                if len(action.fcurves) > 5:
                    print(f"          ... and {len(action.fcurves) - 5} more properties")
    else:
        print("    ❌ No animations found")
    
    # Check mesh skinning
    print(f"\n🎭 Mesh Analysis:")
    for mesh in mesh_objects:
        print(f"  Mesh: {mesh.name}")
        print(f"    Vertices: {len(mesh.data.vertices)}")
        print(f"    Faces: {len(mesh.data.polygons)}")
        
        # Check for armature modifiers
        modifiers = [mod for mod in mesh.modifiers if mod.type == 'ARMATURE']
        if modifiers:
            print(f"    ✅ Has armature modifier: {modifiers[0].object.name if modifiers[0].object else 'None'}")
        else:
            print("    ❌ No armature modifier")
        
        # Check for vertex groups (needed for skinning)
        if mesh.vertex_groups:
            print(f"    Vertex groups: {len(mesh.vertex_groups)} (for bone weights)")
        else:
            print("    ❌ No vertex groups (not skinned)")
    
    # Scene frame information
    scene = bpy.context.scene
    print(f"\n📊 Scene Settings:")
    print(f"    Frame start: {scene.frame_start}")
    print(f"    Frame end: {scene.frame_end}")
    print(f"    Frame current: {scene.frame_current}")
    print(f"    FPS: {scene.render.fps}")
    
    # Overall assessment
    has_armatures = len(armature_objects) > 0
    has_meshes = len(mesh_objects) > 0
    has_animations = len(bpy.data.actions) > 0
    has_skinning = any(len(mesh.vertex_groups) > 0 for mesh in mesh_objects)
    
    print(f"\n{'='*50}")
    print(f"📋 INSPECTION SUMMARY:")
    print(f"   ✅ Armatures: {len(armature_objects)}" if has_armatures else "   ❌ No armatures found")
    print(f"   ✅ Meshes: {len(mesh_objects)}" if has_meshes else "   ❌ No meshes found")
    print(f"   ✅ Animations: {len(bpy.data.actions)}" if has_animations else "   ❌ No animations found")
    print(f"   ✅ Skinning: Present" if has_skinning else "   ⚠️  No vertex groups (static mesh)")
    
    if has_armatures and has_meshes:
        if has_animations:
            print(f"   🎉 This model is ready for animated export!")
        else:
            print(f"   📐 This model is ready for static export")
    else:
        print(f"   ⚠️  This model may need additional setup")
    
    return True

def main():
    """Main function to handle command line arguments"""
    # Get filename from command line arguments
    argv = sys.argv
    
    # Find the -- separator that Blender uses
    try:
        index = argv.index("--")
        script_args = argv[index + 1:]
    except ValueError:
        script_args = []
    
    if len(script_args) == 0:
        print("Usage: blender --background --python inspect_blend.py -- <blend_filename>")
        print("Example: blender --background --python inspect_blend.py -- StickMan.blend")
        print("Example: blender --background --python inspect_blend.py -- skeleton.blend")
        return False
    
    blend_filename = script_args[0]
    return inspect_blend_file(blend_filename)

if __name__ == "__main__":
    success = main()
    # Exit with appropriate code for shell scripts
    import sys
    sys.exit(0 if success else 1)
