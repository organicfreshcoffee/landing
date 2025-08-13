#!/usr/bin/env python3
"""
OBJ to GLB converter for Kenney Medieval Town Base pack.
Converts OBJ/MTL files to GLB format with proper settings for web use.

Usage:
    blender --background --python convert_obj_to_glb.py -- \
        <obj_filename> [output_filename]
    blender --background --python convert_obj_to_glb.py -- \
        Banner_01.obj banner.glb
    blender --background --python convert_obj_to_glb.py -- \
        Castle_Wall_01.obj  # outputs Castle_Wall_01.glb

Or run the batch conversion for all kenney models:
    python3 convert_obj_to_glb.py --batch-kenney
"""

import bpy
import os
import sys
import glob


def enable_required_addons():
    """Enable all required addons for the conversion process."""
    addons_to_enable = [
        'io_scene_obj',      # OBJ import/export
        'io_scene_gltf2',    # GLTF/GLB import/export
    ]
    
    for addon in addons_to_enable:
        try:
            bpy.ops.preferences.addon_enable(module=addon)
            print(f"✅ Enabled addon: {addon}")
        except Exception as e:
            print(f"⚠️  Could not enable addon {addon}: {e}")


def clear_scene():
    """Clear the entire scene."""
    # Delete all mesh objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    # Clear orphaned data
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.textures:
        bpy.data.textures.remove(block)
    for block in bpy.data.images:
        bpy.data.images.remove(block)


def convert_obj_to_glb(obj_filename, output_filename=None, obj_dir=None):
    """Convert an OBJ file to GLB with optimized settings."""
    
    print(f"=== CONVERTING {obj_filename} TO GLB ===")
    
    # Enable the OBJ importer addon
    try:
        bpy.ops.preferences.addon_enable(module='io_scene_obj')
        print("✅ OBJ importer addon enabled")
    except Exception as e:
        print(f"⚠️  Could not enable OBJ addon: {e}")
    
    # Clear existing scene
    clear_scene()
    
    # Determine the OBJ file path
    if obj_dir:
        obj_path = os.path.join(obj_dir, obj_filename)
    else:
        obj_path = os.path.join(os.path.dirname(__file__), obj_filename)
    
    if not os.path.exists(obj_path):
        print(f"❌ {obj_filename} not found at: {obj_path}")
        return False
    
    print(f"📂 Loading: {obj_path}")
    
    try:
        # Import OBJ file with more specific parameters
        bpy.ops.wm.obj_import(filepath=obj_path, use_split_objects=False,
                              use_split_groups=False)
    except Exception as e:
        print(f"❌ Failed to load OBJ file: {e}")
        # Try the old importer as fallback
        try:
            bpy.ops.import_scene.obj(filepath=obj_path)
        except Exception as e2:
            print(f"❌ Fallback import also failed: {e2}")
            return False
    
    # Determine output filename
    if output_filename is None:
        base_name = os.path.splitext(obj_filename)[0]
        output_filename = f"{base_name}.glb"
    
    # Determine output directory
    if obj_dir:
        output_dir = os.path.join(obj_dir, "GLB")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, output_filename)
    else:
        output_path = os.path.join(os.path.dirname(__file__), output_filename)
    
    # Analyze the imported objects
    print("\n🔍 Analyzing imported objects...")
    
    mesh_objects = [obj for obj in bpy.context.scene.objects
                    if obj.type == 'MESH']
    
    if not mesh_objects:
        print("❌ No mesh objects found in the scene!")
        return False
    
    print(f"📦 Found {len(mesh_objects)} mesh object(s):")
    for obj in mesh_objects:
        print(f"   - {obj.name} ({len(obj.data.vertices)} vertices)")
        
        # Check for materials
        if obj.data.materials:
            materials = [mat.name for mat in obj.data.materials if mat]
            print(f"     Materials: {materials}")
        else:
            print("     No materials assigned")
    
    # Select all objects for export
    bpy.ops.object.select_all(action='SELECT')
    
    # Configure export settings optimized for Three.js
    print(f"\n📤 Exporting to: {output_path}")
    
    try:
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            
            # Include settings
            use_selection=True,
            export_extras=False,
            export_cameras=False,
            export_lights=False,
            
            # Transform settings
            export_yup=True,  # Convert to Y-up coordinate system
            
            # Geometry settings
            export_apply=True,  # Apply modifiers
            export_texcoords=True,
            export_normals=True,
            export_tangents=True,
            
            # Material settings
            export_materials='EXPORT',
            
            # Animation settings (not applicable for static models)
            export_animations=False,
            
            # Compression settings
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_draco_position_quantization=14,
            export_draco_normal_quantization=10,
            export_draco_texcoord_quantization=12,
            
            # Other optimizations
            export_optimize_animation_size=False
        )
        
        print(f"✅ Successfully exported: {output_filename}")
        
        # Check file size
        if os.path.exists(output_path):
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            print(f"📊 File size: {size_mb:.2f} MB")
        
        return True
        
    except Exception as e:
        print(f"❌ Export failed: {e}")
        return False


def batch_convert_kenney_models():
    """Convert all OBJ files in the kenney_medieval-town-base pack."""
    
    # Enable required addons first
    enable_required_addons()
    
    script_dir = os.path.dirname(__file__)
    kenney_dir = os.path.join(script_dir, "kenney_medieval-town-base",
                              "Models")
    
    if not os.path.exists(kenney_dir):
        print(f"❌ Kenney models directory not found: {kenney_dir}")
        return False
    
    # Find all OBJ files
    obj_files = glob.glob(os.path.join(kenney_dir, "*.obj"))
    
    if not obj_files:
        print(f"❌ No OBJ files found in: {kenney_dir}")
        return False
    
    print(f"🎯 Found {len(obj_files)} OBJ files to convert")
    
    success_count = 0
    
    for obj_file in sorted(obj_files):
        obj_filename = os.path.basename(obj_file)
        
        print(f"\n{'='*60}")
        progress = f"({success_count + 1}/{len(obj_files)})"
        print(f"Converting {obj_filename} {progress}")
        print(f"{'='*60}")
        
        if convert_obj_to_glb(obj_filename, None, kenney_dir):
            success_count += 1
        else:
            print(f"❌ Failed to convert {obj_filename}")
    
    print("\n🎉 Batch conversion complete!")
    print(f"✅ Successfully converted: {success_count}/{len(obj_files)} models")
    
    # Show output directory
    output_dir = os.path.join(kenney_dir, "GLB")
    if os.path.exists(output_dir):
        glb_files = glob.glob(os.path.join(output_dir, "*.glb"))
        print(f"📁 GLB files created in: {output_dir}")
        print(f"📦 Total GLB files: {len(glb_files)}")
    
    return success_count == len(obj_files)


def main():
    """Main function to handle command line arguments."""
    
    # Handle direct Python execution for batch conversion
    if len(sys.argv) == 2 and sys.argv[1] == "--batch-kenney":
        batch_convert_kenney_models()
        return
    
    # Handle Blender script execution
    try:
        # When called from Blender, arguments come after "--"
        argv = sys.argv
        if "--" in argv:
            argv = argv[argv.index("--") + 1:]
        else:
            argv = argv[1:]  # Remove script name
        
        if len(argv) == 0:
            usage_msg = ("Usage: blender --background --python "
                         "convert_obj_to_glb.py -- <obj_filename> "
                         "[output_filename]")
            print(usage_msg)
            print("   or: python3 convert_obj_to_glb.py --batch-kenney")
            return
        
        if argv[0] == "--batch-kenney":
            batch_convert_kenney_models()
            return
        
        obj_filename = argv[0]
        output_filename = argv[1] if len(argv) > 1 else None
        
        convert_obj_to_glb(obj_filename, output_filename)
        
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()
