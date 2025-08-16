#!/usr/bin/env python3
"""
Script to convert white pixels to transparent in sprite images.
Processes all .gif files in the last-guardian-sprites directory and outputs PNG files.
"""

import os
import sys
from PIL import Image
import glob

def convert_white_to_transparent(input_path, output_path):
    """
    Convert white pixels to transparent in an image.
    
    Args:
        input_path (str): Path to input image
        output_path (str): Path to output image
    """
    try:
        # Open the image
        img = Image.open(input_path)
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get image data
        data = img.getdata()
        
        # Create new data with white pixels made transparent
        new_data = []
        for item in data:
            # Check if pixel is white (or very close to white)
            # We use a threshold to catch slightly off-white pixels too
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                # Make it transparent
                new_data.append((255, 255, 255, 0))
            else:
                # Keep original pixel
                new_data.append(item)
        
        # Update image data
        img.putdata(new_data)
        
        # Save as PNG
        img.save(output_path, 'PNG')
        print(f"✅ Converted: {os.path.basename(input_path)} -> {os.path.basename(output_path)}")
        
    except Exception as e:
        print(f"❌ Error processing {input_path}: {e}")

def main():
    """Main function to process all sprite files."""
    
    # Define paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sprites_dir = os.path.join(script_dir, '..', 'client', 'public', 'assets', 'sprites', 'last-guardian-sprites')
    
    # Create output directory for PNG files
    output_dir = os.path.join(sprites_dir, 'png')
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all .gif files
    gif_pattern = os.path.join(sprites_dir, '*.gif')
    gif_files = glob.glob(gif_pattern)
    
    if not gif_files:
        print(f"❌ No .gif files found in {sprites_dir}")
        return
    
    print(f"🎮 Found {len(gif_files)} sprite files to process...")
    
    # Process each file
    processed = 0
    for gif_file in gif_files:
        # Skip non-sprite files (house and back images)
        filename = os.path.basename(gif_file)
        if filename.startswith(('house', 'back')):
            print(f"⏭️  Skipping non-sprite file: {filename}")
            continue
            
        # Generate output filename (change .gif to .png)
        output_filename = filename.replace('.gif', '.png')
        output_path = os.path.join(output_dir, output_filename)
        
        # Convert the file
        convert_white_to_transparent(gif_file, output_path)
        processed += 1
    
    print(f"\n🎉 Processing complete! Converted {processed} sprite files.")
    print(f"📁 PNG files saved to: {output_dir}")
    print(f"💡 Remember to update your code to use .png extensions instead of .gif")

if __name__ == "__main__":
    main()
