#!/usr/bin/env python3
"""
Texture Processing Script

This script splits texture images that contain a 4x6 grid (24 total textures)
into individual square texture files.

Each input image is expected to be organized as:
- 4 rows (height)
- 6 columns (width)
- 24 total square textures

The script will:
1. Scan all subdirectories in the Textures folder
2. Process all PNG files in each subdirectory
3. Split each PNG into 24 individual texture files
4. Save them with descriptive names in an 'individual' subdirectory
"""

import os
import sys
from PIL import Image
import argparse


def split_texture_image(input_path, output_dir, base_name):
    """
    Split a texture image into individual square textures.
    
    Args:
        input_path (str): Path to the input PNG file
        output_dir (str): Directory to save individual textures
        base_name (str): Base name for output files (without extension)
    """
    try:
        # Open the image
        img = Image.open(input_path)
        width, height = img.size
        
        # Calculate individual texture size
        texture_width = width // 6  # 6 columns
        texture_height = height // 4  # 4 rows
        
        # Verify the image dimensions are divisible
        if width % 6 != 0 or height % 4 != 0:
            print(f"Warning: {input_path} dimensions ({width}x{height}) "
                  f"are not evenly divisible by 6x4")
            print(f"Expected dimensions to be multiples of 6x4, "
                  f"got {width//6}x{height//4} per texture")
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Split the image into individual textures
        texture_count = 0
        for row in range(4):
            for col in range(6):
                # Calculate crop coordinates
                left = col * texture_width
                top = row * texture_height
                right = left + texture_width
                bottom = top + texture_height
                
                # Crop the individual texture
                texture = img.crop((left, top, right, bottom))
                
                # Generate output filename
                output_filename = (f"{base_name}_r{row+1}c{col+1}_"
                                   f"{texture_count+1:02d}.png")
                output_path = os.path.join(output_dir, output_filename)
                
                # Save the individual texture
                texture.save(output_path)
                texture_count += 1
                
                print(f"  Saved: {output_filename} "
                      f"({texture_width}x{texture_height})")
        
        print(f"Successfully split {input_path} into {texture_count} "
              f"individual textures")
        return texture_count
        
    except Exception as e:
        print(f"Error processing {input_path}: {str(e)}")
        return 0


def process_material_directory(material_dir):
    """
    Process all PNG files in a material directory.
    
    Args:
        material_dir (str): Path to the material directory
    """
    material_name = os.path.basename(material_dir)
    print(f"\nProcessing material: {material_name}")
    
    # Create individual textures output directory
    individual_dir = os.path.join(material_dir, "individual")
    
    # Find all PNG files in the material directory
    png_files = [f for f in os.listdir(material_dir)
                 if f.lower().endswith('.png')]
    
    if not png_files:
        print(f"  No PNG files found in {material_dir}")
        return
    
    total_textures = 0
    for png_file in png_files:
        input_path = os.path.join(material_dir, png_file)
        base_name = os.path.splitext(png_file)[0]
        
        print(f"\n  Processing: {png_file}")
        textures_created = split_texture_image(input_path, individual_dir,
                                               base_name)
        total_textures += textures_created
    
    print(f"\nCompleted {material_name}: {total_textures} total individual "
          f"textures created")


def main():
    parser = argparse.ArgumentParser(
        description='Split texture grid images into individual textures')
    parser.add_argument('--material', type=str,
                        help='Process only a specific material directory')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be processed without '
                             'actually doing it')
    args = parser.parse_args()
    
    # Get the script directory and textures directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    textures_dir = os.path.join(script_dir, "Textures")
    
    if not os.path.exists(textures_dir):
        print(f"Error: Textures directory not found at {textures_dir}")
        sys.exit(1)
    
    print("Texture Processing Script")
    print(f"Working directory: {textures_dir}")
    print("Expected grid: 4 rows x 6 columns (24 textures per image)")
    
    if args.dry_run:
        print("DRY RUN MODE - No files will be created")
    
    # Get all material directories
    material_dirs = []
    for item in os.listdir(textures_dir):
        item_path = os.path.join(textures_dir, item)
        if os.path.isdir(item_path) and not item.startswith('.'):
            material_dirs.append(item_path)
    
    if not material_dirs:
        print("No material directories found!")
        sys.exit(1)
    
    # Filter by specific material if requested
    if args.material:
        material_dirs = [d for d in material_dirs
                         if (os.path.basename(d).lower() ==
                             args.material.lower())]
        if not material_dirs:
            print(f"Material '{args.material}' not found!")
            sys.exit(1)
    
    # Process each material directory
    for material_dir in sorted(material_dirs):
        if args.dry_run:
            material_name = os.path.basename(material_dir)
            png_files = [f for f in os.listdir(material_dir)
                         if f.lower().endswith('.png')]
            print(f"\nWould process material: {material_name}")
            print(f"  Found {len(png_files)} PNG files: "
                  f"{', '.join(png_files)}")
        else:
            process_material_directory(material_dir)
    
    if not args.dry_run:
        print("\n✅ Texture processing complete!")
        print("Individual textures have been saved in 'individual' "
              "subdirectories within each material folder.")


if __name__ == "__main__":
    main()
