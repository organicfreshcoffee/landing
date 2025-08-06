#!/bin/bash

# Alternative conversion script with more diagnostic information
# This script tries multiple export methods to ensure proper geometry export

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR"

echo "Alternative Blender model conversion with diagnostics..."

# Check if Blender is available
if ! command -v blender &> /dev/null; then
    echo "Error: Blender is not installed or not in PATH"
    exit 1
fi

# Convert human_male.blend to GLB with diagnostics
if [ -f "$MODELS_DIR/human_male.blend" ]; then
    echo "Converting human_male.blend with diagnostic information..."
    
    blender "$MODELS_DIR/human_male.blend" --background --python-expr "
import bpy
import bmesh
import os

print('=== BLENDER FILE DIAGNOSTICS ===')

# Print scene information
print(f'Scene objects: {len(bpy.context.scene.objects)}')
for obj in bpy.context.scene.objects:
    print(f'  - {obj.name}: {obj.type}')
    if obj.type == 'MESH':
        print(f'    Vertices: {len(obj.data.vertices)}')
        print(f'    Faces: {len(obj.data.polygons)}')
        print(f'    Location: {obj.location}')
        print(f'    Scale: {obj.scale}')

# Clear selection and select all mesh objects
bpy.ops.object.select_all(action='DESELECT')
mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

if not mesh_objects:
    print('ERROR: No mesh objects found in the scene!')
    exit(1)

# Select all mesh objects
for obj in mesh_objects:
    obj.select_set(True)
    print(f'Selected mesh: {obj.name}')

# Set active object
bpy.context.view_layer.objects.active = mesh_objects[0]

# Apply all transforms to ensure proper export
print('Applying transforms...')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Recalculate normals
for obj in mesh_objects:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

print('=== STARTING GLB EXPORT ===')

# Export as GLB with fixed compatible parameters
output_path = os.path.join('$MODELS_DIR', 'human_male_v2.glb')
result = bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=False,        # Export everything
    export_animations=False,    # Disable animations for now to focus on geometry
    export_apply=True,          # Apply modifiers
    export_yup=True,           # Use Y-up coordinate system
    export_normals=True,       # Export vertex normals
    export_tangents=False,     # Skip tangents for now
    export_materials='EXPORT', # Export materials
    export_cameras=False,      # Don't export cameras
    export_lights=False        # Don't export lights
)

if result == {'FINISHED'}:
    print(f'✅ Successfully exported to: {output_path}')
else:
    print(f'❌ Export failed with result: {result}')

print('=== EXPORT COMPLETE ===')
bpy.ops.wm.quit_blender()
"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully created human_male_v2.glb with diagnostics"
        
        # Check file size
        if [ -f "$MODELS_DIR/human_male_v2.glb" ]; then
            filesize=$(ls -lh "$MODELS_DIR/human_male_v2.glb" | awk '{print $5}')
            echo "File size: $filesize"
        fi
    else
        echo "❌ Failed to convert with alternative method"
    fi
else
    echo "⚠️  human_male.blend not found in $MODELS_DIR"
fi

echo ""
echo "Files in models directory:"
ls -la "$MODELS_DIR"/*.glb 2>/dev/null || echo "No GLB files found"
