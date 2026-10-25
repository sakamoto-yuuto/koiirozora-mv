"""Render one declarative shot or all T11 pilots, using actual Blender geometry.

  blender -b --factory-startup --python render_guides.py -- shots/street_wide.json
  blender -b --factory-startup --python render_guides.py -- --all

Each shot emits line/clay/normalized camera-Z depth PNGs and a pose/camera audit.
Four-frame shots are rendered with one invariant camera and assembled at 1672x941.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import math
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from previs_common import BASE, BLEND, TMP, in_blender, inside_base, launch_blender, script_args


def read_shot(path):
    path = Path(path)
    if not path.is_absolute() and not path.is_file():
        path = BASE / path
    data = json.loads(path.read_text(encoding="utf-8"))
    if not re.fullmatch(r"[a-z0-9_]+", data["name"]):
        raise ValueError("Shot name must use lowercase ASCII letters, digits and underscore")
    camera = data["camera"]
    for key in ("position", "target"):
        if len(camera[key]) != 3 or not all(math.isfinite(float(v)) for v in camera[key]):
            raise ValueError(f"Invalid camera {key}")
    if camera["position"] == camera["target"]:
        raise ValueError("Camera and target must differ")
    if data.get("orientation", "landscape") not in ("landscape", "portrait"):
        raise ValueError("orientation must be landscape or portrait")
    if len(data.get("frames", [{}])) not in (1, 4):
        raise ValueError("Use one frame or exactly four panels")
    near, far = data.get("depth_range_m", [0.1, 50])
    if not 0 <= near < far:
        raise ValueError("depth_range_m must satisfy 0 <= near < far")
    return data


def load_pixels(path):
    import bpy
    import numpy as np
    image = bpy.data.images.load(str(path), check_existing=False)
    image.colorspace_settings.name = "Non-Color"
    w, h = image.size
    pixels = np.empty(w*h*4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    result = np.rint(np.clip(pixels.reshape(h,w,4)[::-1,:,:3], 0, 1)*255).astype(np.uint8)
    bpy.data.images.remove(image)
    return result


def material(name, depth=None):
    import bpy
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    if depth is None:
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Base Color"].default_value = (0.35,0.35,0.35,1)
        shader.inputs["Roughness"].default_value = 0.88
        shader.inputs["Specular IOR Level"].default_value = 0.15
    else:
        shader = nodes.new("ShaderNodeEmission")
        camera = nodes.new("ShaderNodeCameraData")
        remap = nodes.new("ShaderNodeMapRange")
        remap.inputs["From Min"].default_value, remap.inputs["From Max"].default_value = depth
        remap.inputs["To Min"].default_value = 1
        remap.inputs["To Max"].default_value = 0
        remap.clamp = True
        mat.node_tree.links.new(camera.outputs["View Z Depth"], remap.inputs["Value"])
        mat.node_tree.links.new(remap.outputs["Result"], shader.inputs["Color"])
    mat.node_tree.links.new(shader.outputs[0], output.inputs["Surface"])
    return mat


def configure_pass(scene, mode, shot):
    import bpy
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.use_freestyle = False
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.view_settings.look = "None"
    world_bg = scene.world.node_tree.nodes.get("Background")
    scene.view_settings.view_transform = "Standard"
    if mode == "line":
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.world.color = (1,1,1)
        sh = scene.display.shading
        sh.light, sh.color_type = "FLAT", "OBJECT"
        sh.show_shadows = False
        sh.show_specular_highlight = False
        sh.show_cavity = True
        sh.cavity_type = "SCREEN"
        sh.cavity_ridge_factor = 0
        sh.cavity_valley_factor = 1.2
        sh.curvature_ridge_factor = 0
        sh.curvature_valley_factor = 1.1
        sh.show_object_outline = True
        sh.object_outline_color = (0,0,0)
        sh.background_type = "WORLD"
        for obj in scene.objects:
            side = obj.get("previs_side")
            obj.color = ((0.015,0.08,0.75,1) if side == "L" else
                         (0.8,0.025,0.02,1) if side == "R" else (1,1,1,1))
    else:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = int(shot.get("clay_samples", 12)) if mode == "clay" else 1
        scene.cycles.use_denoising = mode == "clay"
        scene.cycles.max_bounces = 2 if mode == "clay" else 0
        scene.cycles.diffuse_bounces = 1 if mode == "clay" else 0
        scene.cycles.seed = 110
        scene.cycles.use_animated_seed = False
        scene.world.color = (0,0,0)
        world_bg.inputs["Color"].default_value = (0.8,0.8,0.8,1) if mode == "clay" else (0,0,0,1)
        world_bg.inputs["Strength"].default_value = 0.8 if mode == "clay" else 0
        scene.view_settings.view_transform = "AgX" if mode == "clay" else "Raw"
        scene.view_settings.exposure = -0.8 if mode == "clay" else 0
        mat = material("Previs.Render.Clay" if mode == "clay" else "Previs.Render.Depth",
                       None if mode == "clay" else shot.get("depth_range_m", [0.1,50]))
        for obj in scene.objects:
            if obj.type in {"MESH", "CURVE", "FONT", "SURFACE"}:
                obj.data.materials.clear()
                obj.data.materials.append(mat)


def configure_shot(shot, frame, frame_index):
    import bpy
    from mathutils import Vector
    from previs_characters import pose_character
    scene = bpy.context.scene
    scene.frame_set(frame_index+1)
    specs = {key: dict(value) for key,value in shot.get("characters", {}).items()}
    for key, value in frame.get("characters", {}).items():
        specs.setdefault(key, {}).update(value)
    for value in specs.values():
        if "phase" in frame:
            value["phase"] = frame["phase"]
    evidence = {key: pose_character(key, value) for key,value in specs.items()}
    for character_id, spec in specs.items():
        errors = {}
        for side, target in spec.get("hands", {}).items():
            endpoints = evidence[character_id]["endpoints"]
            actual = endpoints["fingertips"][side]["index"] if spec.get("pose") == "dial" and side == "R" else endpoints["palms"][side]
            error = (Vector(actual)-Vector(target)).length
            errors[side] = error
            if error > 0.005:
                raise ValueError(f"{shot['name']}/{character_id}/{side}: unreachable target or pose override: {error:.4f}m error")
        evidence[character_id]["hand_target_errors_m"] = errors
    visible_groups = set(shot.get("groups", []))
    hide_patterns = shot.get("hide", [])
    for obj in scene.objects:
        group = obj.get("previs_group")
        hidden = bool(group) and group not in visible_groups
        if group == "character":
            hidden = obj.get("character_id") not in specs
        if obj.get("previs_glass") and shot.get("hide_glass", False):
            hidden = True
        if any(fnmatch.fnmatchcase(obj.name, p) or obj.name == p or obj.name.startswith(p+".") for p in hide_patterns):
            hidden = True
        if obj.type == "LIGHT":
            hidden = obj.name != "Previs.Key"
        obj.hide_render = hidden
        obj.hide_set(False)
    camera = scene.camera
    cam = shot["camera"] | frame.get("camera", {})
    camera.location = cam["position"]
    camera.rotation_euler = (Vector(cam["target"])-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type = "ORTHO" if "ortho_scale" in cam else "PERSP"
    camera.data.lens = float(cam.get("lens_mm", 35))
    camera.data.sensor_width = 36
    camera.data.sensor_fit = "VERTICAL" if camera.data.type == "ORTHO" else "HORIZONTAL"
    if "ortho_scale" in cam:
        camera.data.ortho_scale = float(cam["ortho_scale"])
    camera.data.clip_start = float(cam.get("clip_start", 0.02))
    camera.data.clip_end = float(cam.get("clip_end", 150))
    key = bpy.data.objects.get("Previs.Key")
    if key is None:
        data = bpy.data.lights.new("Previs.Key", "AREA")
        key = bpy.data.objects.new("Previs.Key", data)
        scene.collection.objects.link(key)
    target = Vector(cam["target"])
    key.location = Vector(shot.get("key_light", {}).get("position", target+Vector((2,-3,5))))
    key.rotation_euler = (target-key.location).to_track_quat("-Z","Y").to_euler()
    key.data.energy = float(shot.get("key_light", {}).get("energy", 650))
    key.data.shape = "DISK"
    key.data.size = float(shot.get("key_light", {}).get("size", 4))
    key.data.color = (1,1,1)
    key.hide_render = False
    bpy.context.view_layer.update()
    return {"phase": frame.get("phase", "stand"), "camera": cam, "characters": evidence,
            "visible_geometry": sum(not o.hide_render and o.type in {"MESH","CURVE","FONT"} for o in scene.objects)}


def render_shot(shot, modes=("line","clay","depth")):
    import bpy
    import numpy as np
    from png_tools import label, outline_image, write_png
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    scene = bpy.context.scene
    frames = shot.get("frames", [{}])
    w, h = (941,1672) if shot.get("orientation") == "portrait" else (1672,941)
    count = len(frames)
    widths = [w//count]*count
    widths[-1] += w-sum(widths)
    paths = []
    audits = []
    arrays = {mode: np.full((h,w,3), 0 if mode == "depth" else 255, dtype=np.uint8) for mode in modes}
    scratch = inside_base(TMP / shot["name"])
    scratch.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        audits.append(configure_shot(shot, frame, index))
        scene.render.resolution_x, scene.render.resolution_y = widths[index], h
        scene.render.resolution_percentage = 100
        for mode in modes:
            configure_pass(scene, mode, shot)
            raw = scratch / f"{index}_{mode}.png"
            scene.render.filepath = str(raw)
            print(f"GUIDE {shot['name']} {index+1}/{count} {mode}", flush=True)
            bpy.ops.render.render(write_still=True)
            pixels = load_pixels(raw)
            if mode == "line":
                pixels = outline_image(pixels)
            x = sum(widths[:index])
            arrays[mode][:,x:x+widths[index]] = pixels
            if count > 1 and mode != "depth":
                arrays[mode][:62,x:x+widths[index]] = 255
                label(arrays[mode], f"{index+1:02d} / {frame.get('phase','')}", x+20, 24, 2)
                if index:
                    arrays[mode][62:,x:x+1] = (220,220,220)
    for mode, pixels in arrays.items():
        if mode == "line":
            pixels[-38:] = 255
            label(pixels, "L = BLUE", 20, h-25, 2, (24,80,215))
            label(pixels, "R = RED", 180, h-25, 2, (218,45,43))
            label(pixels, "ANATOMICAL SIDES / T11 PREVIS", 340, h-25, 2)
        path = BASE / "out" / f"{shot['name']}_{mode}.png"
        write_png(path, pixels[:,:,0] if mode == "depth" else pixels)
        paths.append(str(path))
    # Keep per-frame numerical evidence independent of raster labels.
    audit = {"shot": shot["name"], "resolution": [w,h], "frames": audits,
             "depth": {"formula": "clamp((far - camera_z) / (far - near), 0, 1)",
                       "near_far_m": shot.get("depth_range_m", [0.1,50]), "sky": 0, "transfer": "Raw/linear"},
             "line": "Workbench hidden-surface object/crease outline; blue anatomical L and red R contours",
             "files": paths}
    (BASE / "out" / f"{shot['name']}.audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(f"SHOT_COMPLETE {shot['name']}", flush=True)


def contact_sheet():
    import numpy as np
    from png_tools import label, write_png
    names = ["street_wide", "walk_cycle_side", "walk_back_pair", "booth_inside_over_shoulder", "his_room_from_door"]
    paths = [BASE / "out" / f"{name}_line.png" for name in names]
    if not all(p.is_file() for p in paths):
        return
    # Three wide rows preserve the four-panel timing strips; two location views below.
    result = np.full((2900,1712,3),255,dtype=np.uint8)
    label(result, "T11 / BLENDER PREVIS", 28,20,4)
    label(result, "LAYOUT ONLY / METRES / L BLUE - R RED", 28,62,2)
    y = 110
    for index, (name,path) in enumerate(zip(names,paths)):
        raw = load_pixels(path)
        if index < 3:
            label(result, name, 25,y,3)
            # Uniformly resize wide location and four-frame strip views alike.
            height = 680
            width = round(raw.shape[1] * height/raw.shape[0])
            yy = np.linspace(0,raw.shape[0]-1,height).astype(int)
            xx = np.linspace(0,raw.shape[1]-1,width).astype(int)
            x = (1712-width)//2
            result[y+34:y+34+height,x:x+width] = raw[yy[:,None],xx]
            y += height+72
        else:
            x = 25 if index == 3 else 866
            row_y = y if index == 3 else y
            label(result, "BOOTH / OVER SHOULDER" if index == 3 else "ROOM / FROM DOOR", x,row_y,2)
            height = round(800*raw.shape[0]/raw.shape[1])
            yy = np.linspace(0,raw.shape[0]-1,height).astype(int)
            xx = np.linspace(0,raw.shape[1]-1,800).astype(int)
            result[row_y+30:row_y+30+height,x:x+800] = raw[yy[:,None],xx]
    write_png(BASE / "out/contact.png", result)
    print("CONTACT_COMPLETE", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("shot", nargs="?")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--passes", default="line,clay,depth")
    parser.add_argument("--contact-only", action="store_true")
    args = parser.parse_args(script_args())
    if not in_blender():
        raise SystemExit(launch_blender(__file__, script_args()))
    if args.contact_only:
        contact_sheet()
        return
    if not BLEND.exists():
        raise FileNotFoundError("Run blender/build_previs.py first")
    modes = tuple(args.passes.split(","))
    if not modes or not set(modes).issubset({"line","clay","depth"}):
        parser.error("--passes must contain line,clay,depth")
    files = sorted((BASE / "shots").glob("*.json")) if args.all else [args.shot] if args.shot else []
    if not files:
        parser.error("Give a shot JSON or --all")
    for path in files:
        render_shot(read_shot(path), modes)
    contact_sheet()


if __name__ == "__main__":
    main()
