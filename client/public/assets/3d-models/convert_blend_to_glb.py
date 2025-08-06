#!/usr/bin/env python3
"""
Universal Blender model converter.
Converts any .blend file to .glb format with proper settings for web use.

Usage:
    blender --background --python convert_blend_to_glb.py -- <blend_filename> [output_filename]
    blender --background --python convert_blend_to_glb.py -- StickMan.blend stickman.glb
    blender --background --python convert_blend_to_glb.py -- skeleton.blend skeleton.glb
    blender --background --python convert_blend_to_glb.py -- human_male.blend  # outputs human_male.glb
"""

import bpy
import os
import sys

def convert_blend_to_glb(blend_filename, output_filename=None):
    """Convert a .blend file to .glb with optimized settings."""
    
    print(f"=== CONVERTING {blend_filename} TO GLB ===")
    
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
    
    # Determine output filename
    if output_filename is None:
        base_name = os.path.splitext(blend_filename)[0]
        output_filename = f"{base_name}.glb"
    
    output_path = os.path.join(os.path.dirname(__file__), output_filename)
    
    # Analyze the scene
    print(f"\n🔍 Analyzing scene...")
    
    mesh_objects = []
    armature_objects = []
    has_animations = len(bpy.data.actions) > 0
    
    for obj in bpy.context.scene.objects:
        print(f"  - {obj.name}: {obj.type}")
        if obj.type == 'MESH':
            mesh_objects.append(obj)
        elif obj.type == 'ARMATURE':
            armature_objects.append(obj)
    
    print(f"\n📊 Scene summary:")
    print(f"   Meshes: {len(mesh_objects)}")
    print(f"   Armatures: {len(armature_objects)}")
    print(f"   Animations: {len(bpy.data.actions)}")
    
    if len(mesh_objects) == 0:
        print("❌ No mesh objects found - nothing to export!")
        return False
    
    # Handle animations for armatures
    export_animations = False
    if has_animations and len(armature_objects) > 0:
        export_animations = True
        print(f"\n🎬 Animation setup:")
        
        # Find the primary armature
        main_armature = armature_objects[0]
        
        # List available animations
        for i, action in enumerate(bpy.data.actions):
            print(f"   {i+1}. {action.name}: frames {int(action.frame_range[0])}-{int(action.frame_range[1])}")
        
        # Set up frame range based on available animations
        if bpy.data.actions:
            # Use the first action's frame range, or combine all if multiple
            all_actions = list(bpy.data.actions)
            min_frame = min(int(action.frame_range[0]) for action in all_actions)
            max_frame = max(int(action.frame_range[1]) for action in all_actions)
            
            scene = bpy.context.scene
            scene.frame_start = min_frame
            scene.frame_end = max_frame
            
            print(f"   Set frame range: {min_frame} - {max_frame}")
    
    # Prepare scene for export
    print(f"\n🔧 Preparing for export...")
    
    # Switch to object mode
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Select all mesh and armature objects
    bpy.ops.object.select_all(action='DESELECT')
    objects_to_export = mesh_objects + armature_objects
    
    for obj in objects_to_export:
        obj.select_set(True)
        print(f"   Selected: {obj.name}")
    
    if objects_to_export:
        bpy.context.view_layer.objects.active = objects_to_export[0]
    
    # Apply transforms only to meshes without armature modifiers
    for mesh in mesh_objects:
        has_armature_mod = any(mod.type == 'ARMATURE' for mod in mesh.modifiers)
        if not has_armature_mod:
            bpy.context.view_layer.objects.active = mesh
            print(f"   Applying transforms to: {mesh.name}")
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    # Fix normals for all meshes
    for mesh in mesh_objects:
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        print(f"   Fixed normals for: {mesh.name}")
    
    # Export settings
    print(f"\n🎯 Exporting to: {output_path}")
    print(f"   Format: GLB")
    print(f"   Animations: {'Yes' if export_animations else 'No'}")
    
    try:
        result = bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            use_selection=True,  # Export only selected objects
            export_animations=export_animations,
            export_frame_range=export_animations,
            export_frame_step=1,
            export_force_sampling=export_animations,  # Important for consistent animation export
            export_apply=not export_animations,  # Don't apply modifiers if we have animations (preserves armature)
            export_yup=True,  # Use Y-up coordinate system (standard for web)
            export_normals=True,
            export_tangents=False,  # Skip tangents to reduce file size
            export_materials='EXPORT',  # Export materials
            export_colors=True,  # Export vertex colors if present
            export_cameras=False,  # Don't export cameras
            export_lights=False,  # Don't export lights
            export_extras=False,  # Skip extra data
            export_optimize_animation_size=True,  # Optimize animations
        )
        
        if result == {'FINISHED'}:
            print(f"✅ Successfully exported to: {output_filename}")
            
            # Check file size
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
                print(f"📊 File size: {file_size:.2f} MB")
            
            # Export additional versions if this model has multiple animations
            if export_animations and len(bpy.data.actions) > 1:
                print(f"\n🎭 Exporting individual animation versions...")
                
                # Export each animation separately
                for action in bpy.data.actions:
                    # Set this action as the only active one
                    for armature in armature_objects:
                        if armature.animation_data:
                            armature.animation_data.action = action
                    
                    # Set frame range for this animation
                    scene = bpy.context.scene
                    scene.frame_start = int(action.frame_range[0])
                    scene.frame_end = int(action.frame_range[1])
                    
                    # Create output filename for this animation
                    action_name = action.name.lower().replace(' ', '_')
                    base_name = os.path.splitext(output_filename)[0]
                    action_filename = f"{base_name}_{action_name}.glb"
                    action_path = os.path.join(os.path.dirname(__file__), action_filename)
                    
                    # Export this specific animation
                    result = bpy.ops.export_scene.gltf(
                        filepath=action_path,
                        export_format='GLB',
                        use_selection=True,
                        export_animations=True,
                        export_frame_range=True,
                        export_frame_step=1,
                        export_force_sampling=True,
                        export_apply=False,
                        export_yup=True,
                        export_normals=True,
                        export_materials='EXPORT',
                        export_cameras=False,
                        export_lights=False
                    )
                    
                    if result == {'FINISHED'}:
                        action_size = os.path.getsize(action_path) / (1024 * 1024)
                        print(f"   ✅ {action_filename} ({action_size:.2f} MB)")
                    else:
                        print(f"   ❌ Failed to export {action_filename}")
            
            return True
            
        else:
            print(f"❌ Export failed with result: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Export failed with exception: {e}")
        return False

def main():
    """Main function to handle command line arguments"""
    # Get arguments from command line
    argv = sys.argv
    
    # Find the -- separator that Blender uses
    try:
        index = argv.index("--")
        script_args = argv[index + 1:]
    except ValueError:
        script_args = []
    
    if len(script_args) == 0:
        print("Usage: blender --background --python convert_blend_to_glb.py -- <blend_filename> [output_filename]")
        print("Examples:")
        print("  blender --background --python convert_blend_to_glb.py -- StickMan.blend")
        print("  blender --background --python convert_blend_to_glb.py -- skeleton.blend skeleton_new.glb")
        print("  blender --background --python convert_blend_to_glb.py -- human_male.blend")
        return False
    
    blend_filename = script_args[0]
    output_filename = script_args[1] if len(script_args) > 1 else None
    
    return convert_blend_to_glb(blend_filename, output_filename)

if __name__ == "__main__":
    success = main()
    # Exit with appropriate code for shell scripts
    import sys
    sys.exit(0 if success else 1)
