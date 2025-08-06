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
    
    # Animation keyframes - More detailed walk cycle with proper stepping
    # 8 key poses for a complete walk cycle
    
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
    
    # Create proper walk cycle with 8 key poses
    walk_frames = [1, 6, 11, 16, 21, 26, 31, 36, 40]
    
    for i, frame in enumerate(walk_frames):
        scene.frame_set(frame)
        
        # Calculate cycle position (0-1) for complete walk cycle
        cycle_pos = i / 8.0 if i < 8 else 0  # 8 poses, then loop
        
        print(f"📍 Setting keyframe at frame {frame} (cycle pos: {cycle_pos:.2f})")
        
        # Define walk cycle phases
        # 0.0 - 0.25: Left foot contact, right foot lift
        # 0.25 - 0.5: Right foot swing forward, left foot pushoff
        # 0.5 - 0.75: Right foot contact, left foot lift  
        # 0.75 - 1.0: Left foot swing forward, right foot pushoff
        
        for bone_name, bone in available_bones:
            if not bone:
                continue
                
            # Reset bone first
            clear_transforms(bone)
            
            if bone == hips_bone:
                # Hip movement - DRAMATIC vertical bob and forward progress
                # Much more pronounced hip movement for visible walking
                hip_height = 0.2 * (0.5 + 0.5 * math.cos(cycle_pos * 4 * math.pi))  # Increased from 0.08
                # Stronger side-to-side hip shift during weight transfer
                hip_sway = 0.12 * math.sin(cycle_pos * 2 * math.pi)  # Increased from 0.03
                # Forward progression
                forward_move = cycle_pos * 1.0  # Increased forward movement
                bone.location = (forward_move, hip_sway, hip_height)
                
                # More dramatic hip rotation for natural walking motion
                hip_rotation = math.radians(25) * math.sin(cycle_pos * 2 * math.pi)  # Increased from 8 degrees
                bone.rotation_euler = (0, 0, hip_rotation)
                
            elif bone == left_leg:
                # Left thigh rotation for DRAMATIC stepping - BIG leg swings
                if 0.5 <= cycle_pos < 1.0:  # Left leg swing phase
                    swing_progress = (cycle_pos - 0.5) * 2  # 0-1 during swing
                    # MASSIVE forward swing - thigh rotates WAY forward
                    thigh_rotation = math.radians(80) * math.sin(swing_progress * math.pi)  # Increased from 45
                    bone.rotation_euler = (-thigh_rotation, 0, 0)
                else:  # Support phase
                    # Thigh extends WAY backward during support for dramatic effect
                    support_progress = cycle_pos * 2 if cycle_pos < 0.5 else 0
                    thigh_rotation = math.radians(50) * (1 - support_progress)  # Increased from 25
                    bone.rotation_euler = (thigh_rotation, 0, 0)
                    
            elif bone == right_leg:
                # Right thigh - opposite phase of left with DRAMATIC swings
                if 0.0 <= cycle_pos < 0.5:  # Right leg swing phase
                    swing_progress = cycle_pos * 2  # 0-1 during swing
                    # MASSIVE forward swing - thigh rotates WAY forward
                    thigh_rotation = math.radians(80) * math.sin(swing_progress * math.pi)  # Increased from 45
                    bone.rotation_euler = (-thigh_rotation, 0, 0)
                else:  # Support phase
                    # Thigh extends WAY backward during support
                    support_progress = (cycle_pos - 0.5) * 2
                    thigh_rotation = math.radians(50) * (1 - support_progress)  # Increased from 25
                    bone.rotation_euler = (thigh_rotation, 0, 0)
                
            elif bone == left_foot:
                # Left foot - DRAMATIC step cycle with HIGH lift and plant
                if 0.4 <= cycle_pos < 0.9:  # Left foot swing phase (longer for realism)
                    swing_progress = (cycle_pos - 0.4) / 0.5  # 0-1 during swing
                    
                    if swing_progress < 0.3:  # Lift phase - LIFT HIGH!
                        foot_height = 0.4 * (swing_progress / 0.3)  # Much higher lift! (was 0.15)
                        foot_forward = 0.3 * (swing_progress / 0.3)  # More forward movement
                        foot_angle = math.radians(-45) * (swing_progress / 0.3)  # More toe up
                    elif swing_progress < 0.7:  # Forward swing
                        foot_height = 0.4  # Maximum height - VERY HIGH
                        foot_forward = 0.3 + 0.8 * ((swing_progress - 0.3) / 0.4)  # Much more forward
                        foot_angle = math.radians(-30)  # More toe up
                    else:  # Plant preparation
                        plant_progress = (swing_progress - 0.7) / 0.3
                        foot_height = 0.4 * (1 - plant_progress)  # Lower down from high position
                        foot_forward = 1.1  # Far forward position
                        foot_angle = math.radians(-30 + 50 * plant_progress)  # More dramatic heel strike
                        
                    bone.location = (foot_forward, 0, foot_height)
                    bone.rotation_euler = (foot_angle, 0, 0)
                else:  # Support phase - foot on ground
                    support_progress = cycle_pos if cycle_pos < 0.4 else (cycle_pos - 0.9) / 0.1
                    foot_forward = 1.1 * (1 - support_progress * 2)  # Move backward relative to body
                    bone.location = (foot_forward, 0, 0)
                    # Stronger push off angle at end of support
                    pushoff = math.radians(30) * max(0, (support_progress * 2 - 0.8) / 0.2) if support_progress else 0
                    bone.rotation_euler = (pushoff, 0, 0)
                    
            elif bone == right_foot:
                # Right foot - opposite phase of left foot with DRAMATIC movements
                offset_cycle = (cycle_pos + 0.5) % 1.0
                
                if 0.4 <= offset_cycle < 0.9:  # Right foot swing phase
                    swing_progress = (offset_cycle - 0.4) / 0.5  # 0-1 during swing
                    
                    if swing_progress < 0.3:  # Lift phase - LIFT HIGH!
                        foot_height = 0.4 * (swing_progress / 0.3)  # Much higher
                        foot_forward = 0.3 * (swing_progress / 0.3)
                        foot_angle = math.radians(-45) * (swing_progress / 0.3)
                    elif swing_progress < 0.7:  # Forward swing
                        foot_height = 0.4  # VERY HIGH
                        foot_forward = 0.3 + 0.8 * ((swing_progress - 0.3) / 0.4)
                        foot_angle = math.radians(-30)
                    else:  # Plant preparation
                        plant_progress = (swing_progress - 0.7) / 0.3
                        foot_height = 0.4 * (1 - plant_progress)
                        foot_forward = 1.1
                        foot_angle = math.radians(-30 + 50 * plant_progress)
                        
                    bone.location = (foot_forward, 0, foot_height)
                    bone.rotation_euler = (foot_angle, 0, 0)
                else:  # Support phase
                    support_progress = offset_cycle if offset_cycle < 0.4 else (offset_cycle - 0.9) / 0.1
                    foot_forward = 1.1 * (1 - support_progress * 2)
                    bone.location = (foot_forward, 0, 0)
                    pushoff = math.radians(30) * max(0, (support_progress * 2 - 0.8) / 0.2) if support_progress else 0
                    bone.rotation_euler = (pushoff, 0, 0)
                    
            elif bone == left_arm:
                # Left arm swing - MASSIVE arm swings for dramatic effect!
                # Much more pronounced arm swing - REALLY SWING those arms!
                arm_swing = math.radians(70) * math.sin((cycle_pos + 0.5) * 2 * math.pi)  # Increased from 35!
                # Add dramatic outward motion
                arm_side = math.radians(20) * math.sin((cycle_pos + 0.5) * 2 * math.pi)  # Increased from 5!
                # Add some elbow bend for more natural swing
                arm_twist = math.radians(15) * math.cos((cycle_pos + 0.5) * 2 * math.pi)
                bone.rotation_euler = (arm_swing, arm_twist, arm_side)
                
            elif bone == right_arm:
                # Right arm swing - MASSIVE opposite swings
                arm_swing = math.radians(70) * math.sin(cycle_pos * 2 * math.pi)  # Increased from 35!
                arm_side = math.radians(20) * math.sin(cycle_pos * 2 * math.pi)  # Increased from 5!
                arm_twist = math.radians(15) * math.cos(cycle_pos * 2 * math.pi)
                bone.rotation_euler = (arm_swing, arm_twist, -arm_side)
                
            elif bone == left_hand:
                # Hand follows arm motion with MORE dramatic movement
                hand_curl = math.radians(35) * math.sin((cycle_pos + 0.3) * 2 * math.pi)  # Increased from 15
                hand_twist = math.radians(20) * math.cos((cycle_pos + 0.3) * 2 * math.pi)
                bone.rotation_euler = (hand_curl, 0, hand_twist)
                
            elif bone == right_hand:
                # Right hand with MORE dramatic opposite motion
                hand_curl = math.radians(35) * math.sin((cycle_pos + 0.8) * 2 * math.pi)  # Increased from 15
                hand_twist = math.radians(20) * math.cos((cycle_pos + 0.8) * 2 * math.pi)
                bone.rotation_euler = (hand_curl, 0, hand_twist)
                
            elif bone == chest_bone:
                # Chest counter-rotation and breathing motion - MORE DRAMATIC
                chest_twist = math.radians(20) * math.sin(cycle_pos * 2 * math.pi)  # Increased from 6
                chest_tilt = math.radians(8) * math.sin(cycle_pos * 4 * math.pi)  # Increased breathing motion
                # Add forward/backward lean for more dynamic walking
                chest_lean = math.radians(10) * math.sin((cycle_pos + 0.25) * 2 * math.pi)
                bone.rotation_euler = (chest_tilt + chest_lean, 0, -chest_twist)  # Counter hip rotation
            
            # Insert keyframes
            keyframe_bone(bone, frame)
    
    # Set interpolation mode for smooth, natural motion
    if action.fcurves:
        for fcurve in action.fcurves:
            for keyframe in fcurve.keyframe_points:
                # Use BEZIER interpolation for more natural motion
                keyframe.interpolation = 'BEZIER'
                keyframe.handle_left_type = 'AUTO'
                keyframe.handle_right_type = 'AUTO'
    
    # Ensure the animation loops properly
    scene.frame_set(1)  # Reset to first frame
    
    print("✅ SUPER DRAMATIC Enhanced walk cycle animation created!")
    print(f"   Frames: {scene.frame_start}-{scene.frame_end} ({len(walk_frames)} keyframes)")
    print(f"   Duration: {(scene.frame_end - scene.frame_start + 1) / scene.render.fps:.2f} seconds")
    print(f"   Action: {action.name}")
    print("   Features:")
    print("     - MASSIVE foot lifting (0.4 units high!)")
    print("     - DRAMATIC hip sway and movement")
    print("     - HUGE arm swings (70 degrees!)")
    print("     - BIG thigh rotation for stepping (80 degrees!)")
    print("     - Exaggerated body movement")
    print("     - Smooth bezier interpolation")
    print("   This animation will be VERY visible!")
    
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
