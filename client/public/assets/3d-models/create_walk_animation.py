#!/usr/bin/env python3
"""
Script to create a basic walking animation for the skeleton model.
This script will create keyframes for a simple walk cycle.
"""

import bpy
import mathutils
import math
import os

def create_walking_animation():
    """Create a basic walking animation for the skeleton."""
    
    print("=== CREATING WALKING ANIMATION ===")
    
    # Clear existing scene and load skeleton
    bpy.ops.wm.read_homefile(use_empty=True)
    skeleton_path = os.path.join(os.path.dirname(__file__), "skeleton.blend")
    
    if not os.path.exists(skeleton_path):
        print(f"❌ skeleton.blend not found at: {skeleton_path}")
        return False
    
    print(f"📂 Loading: {skeleton_path}")
    bpy.ops.wm.open_mainfile(filepath=skeleton_path)
    
    # Find the armature
    armature_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            armature_obj = obj
            break
    
    if not armature_obj:
        print("❌ No armature found in scene")
        return False
    
    print(f"✅ Found armature: {armature_obj.name}")
    
    # Select and activate the armature
    bpy.context.view_layer.objects.active = armature_obj
    armature_obj.select_set(True)
    
    # Switch to pose mode
    bpy.ops.object.mode_set(mode='POSE')
    
    # Set up animation settings
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 40  # 40 frames for a complete walk cycle at 30fps
    scene.render.fps = 30
    
    # Create new action
    if armature_obj.animation_data is None:
        armature_obj.animation_data_create()
    
    action = bpy.data.actions.new("WalkCycle")
    armature_obj.animation_data.action = action
    
    print("🎬 Creating walk cycle animation...")
    
    # Define key bones for walking animation
    pose_bones = armature_obj.pose.bones
    
    # Find main bones (handle missing bones gracefully)
    def find_bone(bone_name, alternatives=None):
        if alternatives is None:
            alternatives = []
        
        for name in [bone_name] + alternatives:
            if name in pose_bones:
                return pose_bones[name]
        return None
    
    # Key bones for animation
    hips_bone = find_bone("CONTROL_HIPS", ["PELVIS", "PIV_HIPS"])
    chest_bone = find_bone("CONTROL_CHEST", ["STERNUM"])
    
    # Leg bones
    left_foot = find_bone("CONTROL_FOOT.L", ["FOOT.L"])
    right_foot = find_bone("CONTROL_FOOT.R", ["FOOT.R"])
    left_leg = find_bone("FEMUR.L", ["MCH_femur.L"])
    right_leg = find_bone("FEMUR.R", ["MCH_femur.R"])
    
    # Arm bones
    left_hand = find_bone("HAND.L")
    right_hand = find_bone("HAND.R")
    left_arm = find_bone("HUMERUS.L")
    right_arm = find_bone("HUMERUS.R")
    
    print("🦴 Found bones for animation:")
    bones_to_animate = [
        ("Hips", hips_bone),
        ("Chest", chest_bone), 
        ("Left Foot", left_foot),
        ("Right Foot", right_foot),
        ("Left Leg", left_leg),
        ("Right Leg", right_leg),
        ("Left Hand", left_hand),
        ("Right Hand", right_hand),
        ("Left Arm", left_arm),
        ("Right Arm", right_arm)
    ]
    
    available_bones = []
    for name, bone in bones_to_animate:
        if bone:
            print(f"  ✅ {name}: {bone.name}")
            available_bones.append((name, bone))
        else:
            print(f"  ❌ {name}: Not found")
    
    if not available_bones:
        print("❌ No suitable bones found for animation")
        return False
    
    # Animation keyframes - 40 frame walk cycle
    # Frame positions: 1, 11, 21, 31, 41 (repeating cycle)
    
    def clear_transforms(bone):
        """Reset bone to default position"""
        bone.location = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)
    
    def keyframe_bone(bone, frame):
        """Insert keyframes for bone at specified frame"""
        bone.keyframe_insert(data_path="location", frame=frame)
        bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    
    # Create walk cycle
    walk_frames = [1, 11, 21, 31, 40]
    
    for i, frame in enumerate(walk_frames):
        scene.frame_set(frame)
        
        # Calculate cycle position (0-1)
        cycle_pos = (i % 4) / 4.0  # 4 key poses in walk cycle
        
        print(f"📍 Setting keyframe at frame {frame} (cycle pos: {cycle_pos:.2f})")
        
        # Animate available bones
        for bone_name, bone in available_bones:
            if not bone:
                continue
                
            # Reset bone first
            clear_transforms(bone)
            
            if bone == hips_bone:
                # Hip movement - vertical bob and slight forward movement
                bob_height = 0.02 * math.sin(cycle_pos * 4 * math.pi)
                forward_move = cycle_pos * 0.1  # Subtle forward progression
                bone.location = (forward_move, 0, bob_height)
                
            elif bone == left_foot:
                # Left foot - step cycle
                if cycle_pos < 0.25:  # Lift phase
                    bone.location = (0, 0, 0.05)
                    bone.rotation_euler = (math.radians(-10), 0, 0)
                elif cycle_pos < 0.5:  # Forward swing
                    bone.location = (0.1, 0, 0.03)
                    bone.rotation_euler = (0, 0, 0)
                elif cycle_pos < 0.75:  # Plant down
                    bone.location = (0.15, 0, 0)
                    bone.rotation_euler = (math.radians(5), 0, 0)
                else:  # Push off
                    bone.location = (0.05, 0, 0)
                    bone.rotation_euler = (math.radians(10), 0, 0)
                    
            elif bone == right_foot:
                # Right foot - opposite phase of left foot
                opposite_cycle = (cycle_pos + 0.5) % 1.0
                if opposite_cycle < 0.25:  # Lift phase
                    bone.location = (0, 0, 0.05)
                    bone.rotation_euler = (math.radians(-10), 0, 0)
                elif opposite_cycle < 0.5:  # Forward swing
                    bone.location = (0.1, 0, 0.03)
                    bone.rotation_euler = (0, 0, 0)
                elif opposite_cycle < 0.75:  # Plant down
                    bone.location = (0.15, 0, 0)
                    bone.rotation_euler = (math.radians(5), 0, 0)
                else:  # Push off
                    bone.location = (0.05, 0, 0)
                    bone.rotation_euler = (math.radians(10), 0, 0)
                    
            elif bone == left_arm:
                # Left arm swing - opposite to right leg
                swing_angle = math.radians(20) * math.sin((cycle_pos + 0.5) * 2 * math.pi)
                bone.rotation_euler = (swing_angle, 0, 0)
                
            elif bone == right_arm:
                # Right arm swing - opposite to left leg  
                swing_angle = math.radians(20) * math.sin(cycle_pos * 2 * math.pi)
                bone.rotation_euler = (swing_angle, 0, 0)
                
            elif bone == chest_bone:
                # Subtle chest counter-rotation
                twist = math.radians(3) * math.sin(cycle_pos * 4 * math.pi)
                bone.rotation_euler = (0, 0, twist)
            
            # Insert keyframes
            keyframe_bone(bone, frame)
    
    # Set interpolation mode to linear for smooth motion
    if action.fcurves:
        for fcurve in action.fcurves:
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = 'LINEAR'
    
    print("✅ Walk cycle animation created!")
    print(f"   Frames: {scene.frame_start}-{scene.frame_end}")
    print(f"   Duration: {(scene.frame_end - scene.frame_start + 1) / scene.render.fps:.2f} seconds")
    print(f"   Action: {action.name}")
    
    # Save the file with animation
    output_path = os.path.join(os.path.dirname(__file__), "skeleton_with_walk.blend")
    bpy.ops.wm.save_as_mainfile(filepath=output_path)
    print(f"💾 Saved animated model to: {output_path}")
    
    # Export as GLB with animation
    glb_path = os.path.join(os.path.dirname(__file__), "skeleton_walk.glb")
    print(f"🎯 Exporting to GLB: {glb_path}")
    
    # Select all objects for export
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    
    result = bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_animations=True,  # Enable animation export
        export_frame_range=True,
        export_frame_step=1,
        export_force_sampling=True,
        export_apply=False,  # Don't apply modifiers to preserve armature
        export_yup=True,
        export_normals=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False
    )
    
    if result == {'FINISHED'}:
        print(f"✅ Successfully exported animated GLB: {glb_path}")
        
        # Check file sizes
        blend_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
        glb_size = os.path.getsize(glb_path) / (1024 * 1024)  # MB
        print(f"📊 File sizes:")
        print(f"   Blend: {blend_size:.2f} MB")
        print(f"   GLB: {glb_size:.2f} MB")
    else:
        print(f"❌ GLB export failed: {result}")
    
    return True

if __name__ == "__main__":
    create_walking_animation()
