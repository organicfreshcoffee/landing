#!/usr/bin/env python3
"""
Universal GLB verification script.
Verifies any GLB file for proper structure, animations, armatures, and meshes.

Usage:
    blender --background --python verify_glb.py -- <glb_filename>
    blender --background --python verify_glb.py -- stickman.glb
    blender --background --python verify_glb.py -- skeleton_walk.glb
"""

import bpy
import os
import sys

def verify_glb_file(glb_filename):
    """Verify a GLB file contains proper structure and animation data"""
    
    print(f"=== VERIFYING {glb_filename} ===")
    
    # Clear scene first
    bpy.ops.wm.read_homefile(use_empty=True)
    
    # Path to the GLB file
    glb_path = os.path.join(os.path.dirname(__file__), glb_filename)
    
    if not os.path.exists(glb_path):
        print(f"❌ GLB file not found: {glb_path}")
        return False
    
    file_size = os.path.getsize(glb_path) / (1024 * 1024)  # MB
    print(f"📁 File size: {file_size:.2f} MB")
    
    try:
        # Import the GLB file
        result = bpy.ops.import_scene.gltf(filepath=glb_path)
        if result != {'FINISHED'}:
            print(f"❌ Failed to import GLB: {result}")
            return False
        print("✅ GLB file imported successfully")
    except Exception as e:
        print(f"❌ Failed to import GLB: {e}")
        return False
    
    # Check scene objects
    print(f"\n🔍 Scene objects: {len(bpy.context.scene.objects)}")
    armature_count = 0
    mesh_count = 0
    armatures = []
    meshes = []
    
    for obj in bpy.context.scene.objects:
        print(f"  - {obj.name}: {obj.type}")
        if obj.type == 'ARMATURE':
            armature_count += 1
            armatures.append(obj)
        elif obj.type == 'MESH':
            mesh_count += 1
            meshes.append(obj)
    
    print(f"\n📊 Summary: {armature_count} armatures, {mesh_count} meshes")
    
    # Check actions (animations)
    print(f"\n🎬 Actions: {len(bpy.data.actions)}")
    animation_found = False
    expected_animations = []
    
    # Determine expected animations based on filename
    if 'stickman' in glb_filename.lower():
        expected_animations = ['StickMan_Run', 'SitckMan_Idle']
    elif 'skeleton' in glb_filename.lower():
        expected_animations = ['WalkCycle']
    
    for action in bpy.data.actions:
        print(f"  - Action: '{action.name}'")
        print(f"    Frame range: {action.frame_range[0]:.0f} - {action.frame_range[1]:.0f}")
        print(f"    FCurves: {len(action.fcurves)}")
        
        # Check for expected animations or generic walking/running animations
        if (action.name in expected_animations or 
            'run' in action.name.lower() or 
            'walk' in action.name.lower() or
            'cycle' in action.name.lower()):
            animation_found = True
            print(f"    ✅ Found expected animation: {action.name}")
        
        # Show some FCurve details for the first few curves
        for i, fcurve in enumerate(action.fcurves[:3]):
            if hasattr(fcurve, 'data_path'):
                array_info = f"[{fcurve.array_index}]" if hasattr(fcurve, 'array_index') else ""
                print(f"      FCurve {i}: {fcurve.data_path}{array_info}")
    
    if not animation_found and len(bpy.data.actions) > 0:
        print("    ⚠️  No recognized walk/run animations found!")
        print("    Available actions:", [action.name for action in bpy.data.actions])
    elif len(bpy.data.actions) == 0:
        print("    ❌ No animations found in this GLB file!")
    
    # Check armature animation data
    print(f"\n🦴 Armature animation data:")
    for obj in armatures:
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
    
    # Check mesh skinning
    print(f"\n🎭 Mesh skinning analysis:")
    for mesh in meshes:
        print(f"  Mesh: {mesh.name}")
        armature_modifiers = [mod for mod in mesh.modifiers if mod.type == 'ARMATURE']
        if armature_modifiers:
            mod = armature_modifiers[0]
            print(f"    ✅ Has armature modifier: {mod.object.name if mod.object else 'None'}")
        else:
            print("    ❌ No armature modifier found")
        
        if mesh.vertex_groups:
            print(f"    Vertex groups: {len(mesh.vertex_groups)}")
        else:
            print("    ⚠️  No vertex groups (may not be skinned)")
    
    # Overall verification result
    success = armature_count > 0 and mesh_count > 0
    
    if success:
        print(f"\n✅ GLB file verification PASSED")
        if animation_found:
            print("   - Animations found and verified")
        elif len(bpy.data.actions) > 0:
            print("   - Animations present but may need manual verification")
        else:
            print("   - No animations (static model)")
        print(f"   - {armature_count} armature(s), {mesh_count} mesh(es)")
    else:
        print(f"\n❌ GLB file verification FAILED")
        if armature_count == 0:
            print("   - No armatures found")
        if mesh_count == 0:
            print("   - No meshes found")
    
    return success

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
        print("Usage: blender --background --python verify_glb.py -- <glb_filename>")
        print("Example: blender --background --python verify_glb.py -- stickman.glb")
        return False
    
    glb_filename = script_args[0]
    return verify_glb_file(glb_filename)

if __name__ == "__main__":
    success = main()
    # Exit with appropriate code for shell scripts
    import sys
    sys.exit(0 if success else 1)
