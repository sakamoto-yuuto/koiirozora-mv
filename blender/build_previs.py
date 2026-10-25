"""Build the T11 metric blockout. Blender -b --factory-startup --python this.py.

Also accepts ordinary Python; all Blender subprocess state remains in _tmp/.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from previs_common import BASE, BLEND, in_blender, launch_blender


def build():
    import bpy
    from mathutils import Vector
    from previs_environment import build_environment
    from previs_characters import build_characters, pose_character

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.resolution_x = 1672
    scene.render.resolution_y = 941
    scene.render.resolution_percentage = 100
    scene.render.fps = 12
    scene.frame_start, scene.frame_end = 1, 4
    bpy.context.preferences.filepaths.save_version = 0
    environment = build_environment()
    characters = build_characters()
    pose_character("yuki", {"position": [-1.7,-0.5,0.03], "heading_deg": -55, "pose": "stand"})
    pose_character("touya", {"position": [-2.9,3,0.03], "pose": "stand"})
    world = bpy.data.worlds.new("Previs.World")
    world.use_nodes = True
    world.node_tree.nodes.get("Background").inputs[0].default_value = (0.8, 0.8, 0.8, 1)
    world.node_tree.nodes.get("Background").inputs[1].default_value = 0.8
    scene.world = world
    camera_data = bpy.data.cameras.new("Previs.Camera")
    camera = bpy.data.objects.new("Previs.Camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (-0.35, -8.3, 1.95)
    camera.rotation_euler = (Vector((0.25, 18, 1.6)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 29
    camera_data.clip_end = 150
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.view_settings.view_transform = "Standard"
    scene["previs_units"] = "metres; +Z up, street +Y; character own L=-X, R=+X"
    scene["previs_scope"] = "T11 blockout only; not final MV art"
    scene["previs_environment_metadata"] = json.dumps(environment)
    scene["previs_character_metadata"] = json.dumps(characters)
    for area in bpy.context.screen.areas if bpy.context.screen else []:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    metadata = {"units": "m", "environment": environment, "characters": characters,
                "object_count": len(bpy.data.objects), "blender": bpy.app.version_string}
    (BASE / "scene_manifest.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PREVIS_BUILT {BLEND} objects={len(bpy.data.objects)}", flush=True)


if __name__ == "__main__":
    if in_blender():
        build()
    else:
        raise SystemExit(launch_blender(__file__))
