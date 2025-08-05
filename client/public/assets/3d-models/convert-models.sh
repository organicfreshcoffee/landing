#!/bin/bash

# Convert Blender files to GLB format for web use
# Requires Blender to be installed and available in PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR"

echo "Converting Blender models to GLB format..."

# Check if Blender is available
if ! command -v blender &> /dev/null; then
    echo "Error: Blender is not installed or not in PATH"
    echo "Please install Blender from https://www.blender.org/download/"
    exit 1
fi

# Convert human_male.blend to GLB
if [ -f "$MODELS_DIR/human_male.blend" ]; then
    echo "Converting human_male.blend to human_male.glb..."
    
    blender "$MODELS_DIR/human_male.blend" --background --python-expr "
import bpy
import os

# Export as GLB
output_path = os.path.join('$MODELS_DIR', 'human_male.glb')
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    export_animations=True
)

print(f'Exported to: {output_path}')
bpy.ops.wm.quit_blender()
"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully converted human_male.blend to human_male.glb"
    else
        echo "❌ Failed to convert human_male.blend"
    fi
else
    echo "⚠️  human_male.blend not found in $MODELS_DIR"
fi

echo "Conversion complete!"
echo ""
echo "To use the converted models:"
echo "1. Restart your Next.js development server"
echo "2. The game will automatically load GLB models instead of cube fallbacks"
