#!/usr/bin/env python3
"""
Sprite Sheet Processor for Stendhal Animals

This script processes sprite sheets from the stendhal_animals folder.
Each sprite sheet is 3 frames wide by 4 sides tall:
- Row 1: Back side (frames 1, 2, 3)
- Row 2: Right side (frames 1, 2, 3)
- Row 3: Front side (frames 1, 2, 3)
- Row 4: Left side (frames 1, 2, 3)

Output: 12 individual frame files per input sprite sheet
"""

import os
import argparse
from PIL import Image


def process_sprite_sheet(input_path, output_dir):
    """
    Process a single sprite sheet and split it into individual frames.
    
    Args:
        input_path (str): Path to the input sprite sheet
        output_dir (str): Directory to save the individual frames
    """
    # Open the sprite sheet
    sprite_sheet = Image.open(input_path)
    width, height = sprite_sheet.size
    
    # Calculate frame dimensions (3 frames wide, 4 rows tall)
    frame_width = width // 3
    frame_height = height // 4
    
    # Get the base filename without extension
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    
    # Define side names for each row
    sides = ['back', 'right', 'front', 'left']
    
    print(f"Processing {base_name}.png ({width}x{height}) -> "
          f"frames ({frame_width}x{frame_height})")
    
    # Extract each frame
    for row in range(4):  # 4 rows (sides)
        side = sides[row]
        for col in range(3):  # 3 columns (frames)
            frame_num = col + 1
            
            # Calculate coordinates for this frame
            left = col * frame_width
            top = row * frame_height
            right = left + frame_width
            bottom = top + frame_height
            
            # Extract the frame
            frame = sprite_sheet.crop((left, top, right, bottom))
            
            # Create output filename: animal_side_frame.png
            output_filename = f"{base_name}_{side}_{frame_num}.png"
            output_path = os.path.join(output_dir, output_filename)
            
            # Save the frame
            frame.save(output_path)
            print(f"  Saved: {output_filename}")


def main():
    parser = argparse.ArgumentParser(
        description='Process sprite sheets into individual frames'
    )
    parser.add_argument(
        '--input-dir',
        default='../client/public/assets/sprites/stendhal_animals',
        help='Input directory containing sprite sheets'
    )
    parser.add_argument(
        '--output-subdir',
        default='frames',
        help='Subdirectory name for output frames'
    )
    
    args = parser.parse_args()
    
    # Get the script directory to resolve relative paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Resolve input directory path
    if os.path.isabs(args.input_dir):
        input_dir = args.input_dir
    else:
        input_dir = os.path.join(script_dir, args.input_dir)
    
    # Create output directory
    output_dir = os.path.join(input_dir, args.output_subdir)
    os.makedirs(output_dir, exist_ok=True)
    
    # List of sprite files to process
    sprite_files = [
        'bull.png', 'cow.png', 'lion.png',
        'monkey.png', 'ram.png', 'tiger.png'
    ]
    
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Processing {len(sprite_files)} sprite sheets...\n")
    
    # Process each sprite file
    for sprite_file in sprite_files:
        input_path = os.path.join(input_dir, sprite_file)
        
        if os.path.exists(input_path):
            try:
                process_sprite_sheet(input_path, output_dir)
                print()  # Add blank line between files
            except Exception as e:
                print(f"Error processing {sprite_file}: {e}")
        else:
            print(f"Warning: {sprite_file} not found in {input_dir}")
    
    print(f"Processing complete! Frames saved to: {output_dir}")


if __name__ == "__main__":
    main()
