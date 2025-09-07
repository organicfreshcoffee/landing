#!/usr/bin/env python3
"""
Pixel Adventure 2 Sprite Processor

This script processes sprite sheets from the Pixel Adventure 2/Enemies folder.
Each sprite sheet contains multiple frames arranged horizontally
(one row high, multiple frames wide).
The frame dimensions are specified in the filename format:
"<animation name> (<width>x<height>).png"

Input structure:
client/public/assets/sprites/Pixel Adventure 2/Enemies/<enemy_name>/
<animation name> (<pixel width>x<pixel height>).png

Output structure:
client/public/assets/sprites/Pixel Adventure 2/parsed/<enemy name>/
<animation name>/<frame number>.png
"""

import os
import re
import argparse
from PIL import Image


def parse_filename(filename):
    """
    Parse the animation name and frame dimensions from filename.
    
    Args:
        filename (str): Filename in format "Animation Name (WIDTHxHEIGHT).png"
        
    Returns:
        tuple: (animation_name, frame_width, frame_height) or
               (None, None, None) if parsing fails
    """
    # Pattern to match "Animation Name (WIDTHxHEIGHT).png"
    pattern = r'^(.+?)\s+\((\d+)x(\d+)\)\.png$'
    match = re.match(pattern, filename)
    
    if match:
        animation_name = match.group(1).strip()
        frame_width = int(match.group(2))
        frame_height = int(match.group(3))
        return animation_name, frame_width, frame_height
    
    return None, None, None


def process_sprite_sheet(input_path, output_dir, enemy_name):
    """
    Process a single sprite sheet and split it into individual frames.
    
    Args:
        input_path (str): Path to the input sprite sheet
        output_dir (str): Base output directory for parsed sprites
        enemy_name (str): Name of the enemy (folder name)
    """
    filename = os.path.basename(input_path)
    animation_name, frame_width, frame_height = parse_filename(filename)
    
    if not animation_name:
        print(f"⚠️  Skipping {filename}: Could not parse filename format")
        return
    
    # Open the sprite sheet
    try:
        sprite_sheet = Image.open(input_path)
        sheet_width, sheet_height = sprite_sheet.size
    except Exception as e:
        print(f"❌ Error opening {filename}: {e}")
        return
    
    # Validate dimensions
    if sheet_height != frame_height:
        print(f"⚠️  Warning: {filename} height ({sheet_height}) doesn't "
              f"match expected frame height ({frame_height})")
    
    # Calculate number of frames
    num_frames = sheet_width // frame_width
    
    if sheet_width % frame_width != 0:
        print(f"⚠️  Warning: {filename} width ({sheet_width}) is not "
              f"evenly divisible by frame width ({frame_width})")
    
    # Create output directory for this enemy and animation
    enemy_output_dir = os.path.join(output_dir, enemy_name, animation_name)
    os.makedirs(enemy_output_dir, exist_ok=True)
    
    print(f"Processing {enemy_name}/{animation_name} "
          f"({sheet_width}x{sheet_height}) -> "
          f"{num_frames} frames ({frame_width}x{frame_height})")
    
    # Extract each frame
    for frame_idx in range(num_frames):
        # Calculate coordinates for this frame
        left = frame_idx * frame_width
        top = 0
        right = left + frame_width
        bottom = frame_height
        
        # Extract the frame
        frame = sprite_sheet.crop((left, top, right, bottom))
        
        # Create output filename: frame number (1-indexed)
        frame_number = frame_idx + 1
        output_filename = f"{frame_number}.png"
        output_path = os.path.join(enemy_output_dir, output_filename)
        
        # Save the frame
        frame.save(output_path, 'PNG')
        print(f"  Saved: {enemy_name}/{animation_name}/{output_filename}")


def process_enemy_directory(enemy_dir, output_dir):
    """
    Process all sprite sheets for a single enemy.
    
    Args:
        enemy_dir (str): Path to the enemy directory
        output_dir (str): Base output directory for parsed sprites
    """
    enemy_name = os.path.basename(enemy_dir)
    print(f"\n🎮 Processing enemy: {enemy_name}")
    
    # Find all PNG files in the enemy directory
    png_files = [f for f in os.listdir(enemy_dir)
                 if f.lower().endswith('.png')]
    
    if not png_files:
        print(f"  No PNG files found in {enemy_dir}")
        return
    
    # Process each sprite sheet
    for png_file in png_files:
        input_path = os.path.join(enemy_dir, png_file)
        process_sprite_sheet(input_path, output_dir, enemy_name)


def main():
    parser = argparse.ArgumentParser(
        description='Process Pixel Adventure 2 sprite sheets into '
                    'individual frames'
    )
    parser.add_argument(
        '--input-dir',
        help='Input directory containing Pixel Adventure 2 enemies '
             '(default: auto-detect from script location)'
    )
    parser.add_argument(
        '--output-dir',
        help='Output directory for parsed sprites '
             '(default: auto-detect from script location)'
    )
    parser.add_argument(
        '--enemy',
        help='Process only a specific enemy (enemy folder name)'
    )
    parser.add_argument(
        '--list-enemies',
        action='store_true',
        help='List available enemies and exit'
    )
    
    args = parser.parse_args()
    
    # Get the script directory to resolve relative paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Set default input directory
    if args.input_dir:
        input_dir = args.input_dir
    else:
        input_dir = os.path.join(
            script_dir, '..', 'client', 'public', 'assets', 'sprites',
            'Pixel Adventure 2', 'Enemies'
        )
    
    # Set default output directory
    if args.output_dir:
        output_dir = args.output_dir
    else:
        output_dir = os.path.join(
            script_dir, '..', 'client', 'public', 'assets', 'sprites',
            'Pixel Adventure 2', 'parsed'
        )
    
    # Resolve absolute paths
    input_dir = os.path.abspath(input_dir)
    output_dir = os.path.abspath(output_dir)
    
    if not os.path.exists(input_dir):
        print(f"❌ Input directory not found: {input_dir}")
        return 1
    
    # Get list of enemy directories
    enemy_dirs = []
    for item in os.listdir(input_dir):
        item_path = os.path.join(input_dir, item)
        if os.path.isdir(item_path) and not item.startswith('.'):
            enemy_dirs.append(item)
    
    enemy_dirs.sort()
    
    if args.list_enemies:
        print("Available enemies:")
        for enemy in enemy_dirs:
            print(f"  - {enemy}")
        return 0
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    
    if args.enemy:
        # Process specific enemy
        if args.enemy not in enemy_dirs:
            print(f"❌ Enemy '{args.enemy}' not found. "
                  f"Available enemies: {', '.join(enemy_dirs)}")
            return 1
        
        enemy_path = os.path.join(input_dir, args.enemy)
        process_enemy_directory(enemy_path, output_dir)
    else:
        # Process all enemies
        print(f"Processing {len(enemy_dirs)} enemies...\n")
        
        for enemy_name in enemy_dirs:
            enemy_path = os.path.join(input_dir, enemy_name)
            try:
                process_enemy_directory(enemy_path, output_dir)
            except Exception as e:
                print(f"❌ Error processing {enemy_name}: {e}")
    
    print(f"\n✅ Processing complete! Parsed sprites saved to: {output_dir}")
    return 0


if __name__ == "__main__":
    exit(main())
