#!/usr/bin/env python3
"""
Script to export StickMan.blend to GLB with animations.
"""

import bpy
import os

def export_stickman():
    """Export StickMan.blend to GLB with animations."""
    
    print("=== EXPORTING STICKMAN TO GLB ===")
    
    # Clear existing scene and load StickMan
    bpy.ops.wm.read_homefile(use_empty=True)
    stickman_path = os.path.join(os.path.dirname(__file__), "StickMan.blend")
    
    if not os.path.exists(stickman_path):
        print(f"❌ StickMan.blend not found at: {stickman_path}")
        return False
    
    print(f"📂 Loading: {stickman_path}")
    bpy.ops.wm.open_mainfile(filepath=stickman_path)
    
    # Find the armature and verify animations
    armature_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            armature_obj = obj
            break
    
    if not armature_obj:
        print("❌ No armature found in scene")
        return False
    
    print(f"✅ Found armature: {armature_obj.name}")
    
    # List available animations
    actions = bpy.data.actions
    print(f"\n🎬 Available animations: {len(actions)}")
    for action in actions:
        print(f"  - {action.name}: {int(action.frame_range[0])}-{int(action.frame_range[1])} frames")
    
    # Set the run animation as active (this will be our walking animation)
    run_action = bpy.data.actions.get('StickMan_Run')
    if run_action:
        armature_obj.animation_data.action = run_action
        print(f"✅ Set active animation: {run_action.name}")
        
        # Set frame range to match the run animation
        scene = bpy.context.scene
        scene.frame_start = int(run_action.frame_range[0])
        scene.frame_end = int(run_action.frame_range[1])
        print(f"   Frame range: {scene.frame_start}-{scene.frame_end}")
    else:
        print("❌ StickMan_Run animation not found")
    
    # Export as GLB with animations
    glb_path = os.path.join(os.path.dirname(__file__), "stickman.glb")
    print(f"\n🎯 Exporting to GLB: {glb_path}")
    
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
        
        # Check file size
        glb_size = os.path.getsize(glb_path) / (1024 * 1024)  # MB
        print(f"📊 File size: {glb_size:.2f} MB")
        
        # Export idle animation as separate GLB for later use
        if bpy.data.actions.get('SitckMan_Idle'):
            idle_action = bpy.data.actions.get('SitckMan_Idle')
            armature_obj.animation_data.action = idle_action
            
            scene.frame_start = int(idle_action.frame_range[0])
            scene.frame_end = int(idle_action.frame_range[1])
            
            idle_glb_path = os.path.join(os.path.dirname(__file__), "stickman_idle.glb")
            
            bpy.ops.export_scene.gltf(
                filepath=idle_glb_path,
                export_format='GLB',
                use_selection=False,
                export_animations=True,
                export_frame_range=True,
                export_frame_step=1,
                export_force_sampling=True,
                export_apply=False,
                export_yup=True,
                export_normals=True,
                export_materials='EXPORT',
                export_cameras=False,
                export_lights=False
            )
            
            idle_size = os.path.getsize(idle_glb_path) / (1024 * 1024)
            print(f"✅ Also exported idle animation: stickman_idle.glb ({idle_size:.2f} MB)")
    else:
        print(f"❌ GLB export failed: {result}")
        return False
    
    print("\n🎉 StickMan export completed!")
    print("   Main file: stickman.glb (with StickMan_Run animation)")
    print("   Bonus file: stickman_idle.glb (with SitckMan_Idle animation)")
    
    return True

if __name__ == "__main__":
    export_stickman()
