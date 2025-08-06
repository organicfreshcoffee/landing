#!/bin/bash
# 3D Model Processing Helper Script
# Provides easy commands for working with 3D models in this project

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Blender is available
if ! command -v blender &> /dev/null; then
    echo "❌ Error: Blender is not installed or not in PATH"
    echo "Please install Blender and ensure it's available in your PATH"
    exit 1
fi

show_help() {
    echo "3D Model Processing Helper"
    echo ""
    echo "Usage: $0 <command> <file> [output]"
    echo ""
    echo "Commands:"
    echo "  inspect <file.blend>              - Inspect a Blender file"
    echo "  convert <file.blend> [output.glb] - Convert Blender file to GLB"
    echo "  verify <file.glb>                 - Verify a GLB file"
    echo ""
    echo "Examples:"
    echo "  $0 inspect StickMan.blend"
    echo "  $0 convert StickMan.blend"
    echo "  $0 convert skeleton.blend my_skeleton.glb"
    echo "  $0 verify stickman.glb"
    echo ""
    echo "Available files:"
    echo "  Blend files:"
    for file in "$SCRIPT_DIR"/*.blend; do
        if [ -f "$file" ]; then
            echo "    $(basename "$file")"
        fi
    done
    echo "  GLB files:"
    for file in "$SCRIPT_DIR"/*.glb; do
        if [ -f "$file" ]; then
            echo "    $(basename "$file")"
        fi
    done
}

if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

COMMAND=$1
FILE=$2
OUTPUT=$3

case $COMMAND in
    "inspect")
        if [ -z "$FILE" ]; then
            echo "❌ Error: Please specify a .blend file to inspect"
            exit 1
        fi
        if [ ! -f "$SCRIPT_DIR/$FILE" ]; then
            echo "❌ Error: File not found: $FILE"
            exit 1
        fi
        echo "🔍 Inspecting $FILE..."
        cd "$SCRIPT_DIR"
        blender --background --python inspect_blend.py -- "$FILE"
        ;;
    
    "convert")
        if [ -z "$FILE" ]; then
            echo "❌ Error: Please specify a .blend file to convert"
            exit 1
        fi
        if [ ! -f "$SCRIPT_DIR/$FILE" ]; then
            echo "❌ Error: File not found: $FILE"
            exit 1
        fi
        echo "🔄 Converting $FILE to GLB..."
        cd "$SCRIPT_DIR"
        if [ -n "$OUTPUT" ]; then
            blender --background --python convert_blend_to_glb.py -- "$FILE" "$OUTPUT"
        else
            blender --background --python convert_blend_to_glb.py -- "$FILE"
        fi
        ;;
    
    "verify")
        if [ -z "$FILE" ]; then
            echo "❌ Error: Please specify a .glb file to verify"
            exit 1
        fi
        if [ ! -f "$SCRIPT_DIR/$FILE" ]; then
            echo "❌ Error: File not found: $FILE"
            exit 1
        fi
        echo "✅ Verifying $FILE..."
        cd "$SCRIPT_DIR"
        blender --background --python verify_glb.py -- "$FILE"
        ;;
    
    "help"|"-h"|"--help")
        show_help
        ;;
    
    *)
        echo "❌ Error: Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
