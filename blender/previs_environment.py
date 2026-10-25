"""Procedural environment blockout for the T11 Blender previs.

The module deliberately does not clear or save the scene.  ``build_environment``
only replaces objects whose names start with Street., Booth. or Room., so it can
be called repeatedly next to the independently built character rigs.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


GENERATED_PREFIXES = ("Street.", "Booth.", "Room.")
COLLECTION_NAME = "Previs.Environment"


COLORS = {
    "asphalt": (0.095, 0.13, 0.18, 1.0),
    "snow": (0.77, 0.86, 0.91, 1.0),
    "building": (0.15, 0.18, 0.22, 1.0),
    "building_alt": (0.20, 0.22, 0.24, 1.0),
    "shutter": (0.22, 0.25, 0.28, 1.0),
    "awning": (0.22, 0.27, 0.34, 1.0),
    "window": (0.38, 0.55, 0.66, 1.0),
    "warm_window": (0.95, 0.66, 0.29, 1.0),
    "wood": (0.28, 0.18, 0.12, 1.0),
    "booth_brown": (0.31, 0.20, 0.14, 1.0),
    "booth_dark": (0.16, 0.10, 0.075, 1.0),
    "glass": (0.36, 0.58, 0.62, 0.22),
    "green": (0.18, 0.42, 0.33, 1.0),
    "green_dark": (0.08, 0.21, 0.16, 1.0),
    "key": (0.66, 0.69, 0.66, 1.0),
    "metal": (0.42, 0.45, 0.47, 1.0),
    "led_dark": (0.16, 0.018, 0.012, 1.0),
    "led": (1.0, 0.055, 0.018, 1.0),
    "lamp": (1.0, 0.79, 0.43, 1.0),
    "tatami": (0.44, 0.42, 0.25, 1.0),
    "tatami_edge": (0.12, 0.17, 0.15, 1.0),
    "room_wall": (0.35, 0.33, 0.28, 1.0),
    "cream": (0.72, 0.68, 0.56, 1.0),
    "fabric": (0.25, 0.28, 0.32, 1.0),
    "black": (0.025, 0.03, 0.035, 1.0),
}


def _material(label: str, rgba: Sequence[float], roughness: float = 0.82,
              metallic: float = 0.0, glass: bool = False) -> bpy.types.Material:
    name = f"Previs.Mat.{label}"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    color = tuple(float(v) for v in rgba)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Alpha"].default_value = color[3]
        if glass:
            # Transmission is intentionally modest: the pane remains readable in
            # clay/line guides while still being visibly transparent in previews.
            transmission = bsdf.inputs.get("Transmission Weight") or bsdf.inputs.get("Transmission")
            if transmission:
                transmission.default_value = 0.35
            bsdf.inputs["Roughness"].default_value = 0.25
    if glass:
        try:
            mat.surface_render_method = "DITHERED"
        except (AttributeError, TypeError):
            try:
                mat.blend_method = "BLEND"
            except AttributeError:
                pass
        mat.use_transparency_overlap = False
    return mat


def _env_collection() -> bpy.types.Collection:
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        collection = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(collection)
    elif collection.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(collection)
    return collection


def _move_to_collection(obj: bpy.types.Object) -> None:
    collection = _env_collection()
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)


def _finish(obj: bpy.types.Object, name: str, color_name: str, group: str,
            *, glass: bool = False, roughness: float = 0.82,
            metallic: float = 0.0) -> bpy.types.Object:
    obj.name = name
    rgba = COLORS[color_name]
    obj.color = rgba
    mat = _material(color_name, rgba, roughness, metallic, glass)
    obj.data.materials.append(mat)
    obj["previs_group"] = group
    if glass:
        obj["previs_glass"] = True
    _move_to_collection(obj)
    return obj


def _box(name: str, location: Sequence[float], scale: Sequence[float],
         color: str, group: str, *, rotation=(0.0, 0.0, 0.0),
         glass: bool = False, bevel: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = (scale[0] / 2.0, scale[1] / 2.0, scale[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _finish(obj, name, color, group, glass=glass)
    if bevel > 0.0:
        mod = obj.modifiers.new("Previs bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    return obj


def _cylinder(name: str, location: Sequence[float], radius: float, depth: float,
              color: str, group: str, *, rotation=(0.0, 0.0, 0.0),
              vertices: int = 12) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth,
        location=location, rotation=rotation,
    )
    return _finish(bpy.context.object, name, color, group)


def _sphere(name: str, location: Sequence[float], scale: Sequence[float],
            color: str, group: str) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, name, color, group)


def _curve(name: str, points: Iterable[Sequence[float]], radius: float,
           color: str, group: str) -> bpy.types.Object:
    coords = [tuple(p) for p in points]
    data = bpy.data.curves.new(name + ".Data", "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = radius
    data.bevel_resolution = 0
    spline = data.splines.new("POLY")
    spline.points.add(len(coords) - 1)
    for point, co in zip(spline.points, coords):
        point.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, data)
    _env_collection().objects.link(obj)
    return _finish(obj, name, color, group)


def _cylinder_between(name: str, start: Sequence[float], end: Sequence[float],
                      radius: float, color: str, group: str,
                      vertices: int = 10) -> bpy.types.Object:
    a, b = Vector(start), Vector(end)
    delta = b - a
    obj = _cylinder(name, (a + b) / 2.0, radius, delta.length, color, group,
                    vertices=vertices)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(delta.normalized())
    return obj


def _clear_previous() -> None:
    for obj in list(bpy.data.objects):
        if obj.name.startswith(GENERATED_PREFIXES):
            bpy.data.objects.remove(obj, do_unlink=True)


def _build_shop_row(side: str, x: float) -> None:
    sign = 1.0 if x > 0.0 else -1.0
    inward_x = x - sign * 1.02
    for i, y in enumerate((-1.0, 7.0, 15.0, 23.0, 31.0, 39.0)):
        prefix = f"Street.Shop.{side}.{i:02d}"
        color = "building" if i % 2 == 0 else "building_alt"
        _box(prefix + ".Shell", (x, y, 2.65), (2.05, 7.6, 5.3), color, "street")
        _box(prefix + ".Shutter", (inward_x, y - 0.55, 1.28),
             (0.08, 3.55, 2.35), "shutter", "street")
        # Strong horizontal shutter ribs remain legible in line renders.
        for rib in range(7):
            z = 0.35 + rib * 0.29
            _box(prefix + f".ShutterRib.{rib:02d}",
                 (inward_x - sign * 0.045, y - 0.55, z),
                 (0.045, 3.58, 0.035), "metal", "street")
        _box(prefix + ".Awning", (inward_x - sign * 0.30, y - 0.55, 2.65),
             (0.72, 3.9, 0.14), "awning", "street",
             rotation=(0.0, sign * math.radians(8.0), 0.0))
        _box(prefix + ".Sign", (inward_x - sign * 0.10, y + 1.85, 2.18),
             (0.16, 1.8, 0.62), "cream", "street", bevel=0.03)
        for w in range(2):
            wy = y - 1.65 + w * 3.3
            warm = (i + w) % 3 != 1
            _box(prefix + f".Window.{w:02d}", (inward_x - sign * 0.045, wy, 4.08),
                 (0.06, 1.52, 1.25), "warm_window" if warm else "window", "street")
            _box(prefix + f".WindowSill.{w:02d}", (inward_x - sign * 0.09, wy, 3.40),
                 (0.13, 1.68, 0.10), "wood", "street")
        _box(prefix + ".RoofSnow", (x - sign * 0.18, y, 5.43),
             (2.45, 7.85, 0.18), "snow", "street", bevel=0.06)


def _build_street() -> None:
    _box("Street.Ground", (0.0, 20.0, -0.08), (9.0, 55.0, 0.16), "asphalt", "street")
    _box("Street.SnowCover", (0.0, 20.0, 0.015), (8.7, 54.5, 0.05), "snow", "street")
    _build_shop_row("Left", -5.0)
    _build_shop_row("Right", 5.0)

    # Ploughed, uneven snow banks along both curbs.
    for side_i, x in enumerate((-3.92, 3.92)):
        side = "Left" if side_i == 0 else "Right"
        for i, y in enumerate(range(-4, 46, 3)):
            sx = 0.38 + 0.08 * ((i + side_i) % 3)
            sy = 0.75 + 0.10 * ((i * 2 + side_i) % 4)
            sz = 0.22 + 0.05 * ((i + 1) % 3)
            _sphere(f"Street.Snowbank.{side}.{i:02d}",
                    (x + (0.10 if i % 2 else -0.08), y, sz * 0.62),
                    (sx, sy, sz), "snow", "street")

    pole_ys = (-3.0, 9.0, 21.0, 33.0, 45.0)
    # Keep service poles clearly on the road side of the x=+/-5 storefronts.
    # At the former +/-4.25 position they sat behind the facade/awning line in
    # the primary wide shot and almost disappeared.
    for side_i, x in enumerate((-3.58, 3.58)):
        side = "Left" if side_i == 0 else "Right"
        for i, y in enumerate(pole_ys):
            prefix = f"Street.Pole.{side}.{i:02d}"
            _cylinder(prefix + ".Mast", (x, y, 3.4), 0.10, 6.8, "metal", "street", vertices=10)
            _box(prefix + ".Crossbar", (x, y, 5.72), (1.05, 0.10, 0.10), "metal", "street")
            for pin in (-0.38, 0.0, 0.38):
                _cylinder(prefix + f".Insulator.{pin:+.2f}",
                          (x + pin, y, 5.86), 0.045, 0.20, "cream", "street", vertices=8)
            # Alternating street lamps project into the roadway.
            if i < len(pole_ys) - 1:
                arm_end_x = x - math.copysign(0.68, x)
                _cylinder_between(prefix + ".LampArm", (x, y, 4.75),
                                  (arm_end_x, y, 4.72), 0.035, "metal", "street")
                _box(prefix + ".Lamp", (arm_end_x, y, 4.63),
                     (0.52, 0.36, 0.18), "lamp", "street", bevel=0.05)

        for wire_i, x_offset in enumerate((-0.38, 0.0, 0.38)):
            for span in range(len(pole_ys) - 1):
                y0, y1 = pole_ys[span], pole_ys[span + 1]
                pts = []
                for step in range(9):
                    t = step / 8.0
                    sag = 0.62 * 4.0 * t * (1.0 - t)
                    pts.append((x + x_offset, y0 + (y1 - y0) * t, 5.93 - sag))
                _curve(f"Street.Wire.{side}.{wire_i:02d}.{span:02d}",
                       pts, 0.018, "black", "street")


def _frame_piece(name: str, location: Sequence[float], scale: Sequence[float]) -> None:
    _box(name, location, scale, "booth_brown", "booth", bevel=0.012)


def _build_seven_segment_digit(prefix: str, center_x: float, y: float, center_z: float,
                               digit: str) -> None:
    # Segment labels: a top, b/c right, d bottom, e/f left, g middle.
    active = {
        "0": set("abcdef"), "1": set("bc"), "2": set("abdeg"),
        "3": set("abcdg"), "4": set("bcfg"), "5": set("acdfg"),
        "6": set("acdefg"), "7": set("abc"), "8": set("abcdefg"),
        "9": set("abcdfg"),
    }[digit]
    segments = {
        "a": (0.0, 0.018, 0.020, 0.004),
        "g": (0.0, 0.000, 0.020, 0.004),
        "d": (0.0, -0.018, 0.020, 0.004),
        "f": (-0.011, 0.009, 0.004, 0.016),
        "b": (0.011, 0.009, 0.004, 0.016),
        "e": (-0.011, -0.009, 0.004, 0.016),
        "c": (0.011, -0.009, 0.004, 0.016),
    }
    for seg, (dx, dz, width, height) in segments.items():
        _box(f"{prefix}.Segment.{seg}", (center_x + dx, y, center_z + dz),
             (width, 0.006, height), "led" if seg in active else "led_dark", "booth")


def _build_booth() -> dict:
    cx, cy = 3.6, 1.0
    half_w, half_d = 0.48, 0.50
    floor_z, roof_z = 0.08, 2.18
    # Plinth and roof/light box.
    _box("Booth.Floor", (cx, cy, floor_z), (1.02, 1.06, 0.12), "booth_dark", "booth")
    _box("Booth.Roof", (cx, cy, 2.23), (1.10, 1.14, 0.18), "booth_brown", "booth", bevel=0.025)
    _box("Booth.TopLight", (cx, cy - 0.515, 2.08), (0.70, 0.035, 0.22), "lamp", "booth")
    _box("Booth.CeilingLight", (cx, cy, 2.105), (0.58, 0.48, 0.035), "lamp", "booth")

    # Four corner posts and top/bottom rails.
    for ix, x in enumerate((cx - half_w, cx + half_w)):
        for iy, y in enumerate((cy - half_d, cy + half_d)):
            _frame_piece(f"Booth.Frame.Post.{ix}.{iy}", (x, y, 1.12), (0.075, 0.075, 2.10))
    for side, x in (("Left", cx - half_w), ("Right", cx + half_w)):
        for rail, z in (("Bottom", 0.18), ("Top", 2.04)):
            _frame_piece(f"Booth.Frame.{side}.{rail}", (x, cy, z), (0.075, 1.0, 0.08))
    for side, y in (("Front", cy - half_d), ("Back", cy + half_d)):
        for rail, z in (("Bottom", 0.18), ("Top", 2.04)):
            _frame_piece(f"Booth.Frame.{side}.{rail}", (cx, y, z), (1.0, 0.075, 0.08))

    # Three fixed panes plus the front door.  The phone has its own opaque mount
    # panel on the inside of the back pane.
    _box("Booth.Glass.Left", (cx - half_w, cy, 1.12), (0.018, 0.89, 1.76),
         "glass", "booth", glass=True)
    _box("Booth.Glass.Right", (cx + half_w, cy, 1.12), (0.018, 0.89, 1.76),
         "glass", "booth", glass=True)
    _box("Booth.Glass.Back", (cx, cy + half_d, 1.12), (0.89, 0.018, 1.76),
         "glass", "booth", glass=True)
    _box("Booth.Door.Glass", (cx, cy - half_d, 1.12), (0.83, 0.018, 1.76),
         "glass", "booth", glass=True)
    _frame_piece("Booth.Door.Frame.Left", (cx - 0.435, cy - half_d - 0.012, 1.12), (0.055, 0.055, 1.84))
    _frame_piece("Booth.Door.Frame.Right", (cx + 0.435, cy - half_d - 0.012, 1.12), (0.055, 0.055, 1.84))
    _frame_piece("Booth.Door.Frame.Top", (cx, cy - half_d - 0.012, 2.02), (0.89, 0.055, 0.055))
    _cylinder("Booth.Door.Handle", (cx + 0.31, cy - half_d - 0.045, 1.04),
              0.018, 0.22, "metal", "booth", vertices=8)

    # MC-3P: exact researched outer dimensions W 0.23 x D 0.26 x H 0.37 m.
    phone_center = (cx, cy + half_d - 0.18, 1.39)
    phone_front_y = phone_center[1] - 0.13
    _box("Booth.Phone.MountPanel", (cx, cy + half_d - 0.025, 1.37),
         (0.48, 0.035, 0.62), "metal", "booth")
    _box("Booth.Phone.Body", phone_center, (0.23, 0.26, 0.37), "green", "booth", bevel=0.018)
    _box("Booth.Phone.FacePanel", (cx + 0.026, phone_front_y - 0.004, 1.37),
         (0.122, 0.012, 0.235), "green_dark", "booth", bevel=0.008)
    # Receiver reads as three joined low-poly blocks, mounted vertically at left.
    rx = cx - 0.075
    _box("Booth.Phone.Receiver.Grip", (rx, phone_front_y - 0.025, 1.405),
         (0.036, 0.035, 0.18), "green_dark", "booth", bevel=0.012)
    _box("Booth.Phone.Receiver.Top", (rx, phone_front_y - 0.026, 1.51),
         (0.062, 0.04, 0.055), "green_dark", "booth", bevel=0.014)
    _box("Booth.Phone.Receiver.Bottom", (rx, phone_front_y - 0.026, 1.30),
         (0.062, 0.04, 0.055), "green_dark", "booth", bevel=0.014)
    cord_points = []
    for i in range(13):
        t = i / 12.0
        cord_points.append((rx - 0.015 + 0.018 * math.sin(t * math.pi * 6.0),
                            phone_front_y - 0.03,
                            1.28 - 0.34 * t))
    _curve("Booth.Phone.Cord", cord_points, 0.007, "black", "booth")

    # Key centers are part of the public interface used by pose scripts.
    key_labels = (("1", "2", "3"), ("4", "5", "6"),
                  ("7", "8", "9"), ("Star", "0", "Hash"))
    key_centers = {}
    keys_center_x = cx + 0.025
    top_z = 1.405
    for row, labels in enumerate(key_labels):
        for col, label in enumerate(labels):
            x = keys_center_x + (col - 1) * 0.034
            z = top_z - row * 0.036
            y = phone_front_y - 0.012
            _cylinder(f"Booth.Phone.Key.{label}", (x, y, z), 0.009, 0.008,
                      "key", "booth", rotation=(math.pi / 2.0, 0.0, 0.0), vertices=12)
            key_centers[label] = [round(x, 4), round(y - 0.004, 4), round(z, 4)]

    _box("Booth.Phone.LED.Window", (cx + 0.018, phone_front_y - 0.012, 1.505),
         (0.092, 0.008, 0.055), "led_dark", "booth", bevel=0.004)
    for i, digit in enumerate("050"):
        _build_seven_segment_digit(f"Booth.Phone.LED.Digit.{i}",
                                   cx - 0.012 + i * 0.030,
                                   phone_front_y - 0.018, 1.505, digit)
    _box("Booth.Phone.CardSlot", (cx + 0.073, phone_front_y - 0.013, 1.462),
         (0.060, 0.009, 0.012), "metal", "booth")
    _box("Booth.Phone.CoinSlot", (cx + 0.076, phone_front_y - 0.013, 1.432),
         (0.042, 0.009, 0.010), "metal", "booth")
    _box("Booth.Phone.Return", (cx + 0.072, phone_front_y - 0.013, 1.275),
         (0.065, 0.011, 0.045), "black", "booth", bevel=0.004)
    _box("Booth.Phone.Instruction", (cx + 0.020, phone_front_y - 0.013, 1.235),
         (0.135, 0.009, 0.030), "cream", "booth")

    _box("Booth.Shelf.Top", (cx + 0.255, cy + 0.15, 1.01),
         (0.32, 0.25, 0.045), "metal", "booth")
    _box("Booth.Shelf.Bracket", (cx + 0.38, cy + 0.24, 0.86),
         (0.035, 0.06, 0.30), "metal", "booth")

    return {
        "center": [cx, cy, 0.0],
        "dimensions": [1.10, 1.14, 2.32],
        "front_direction": [0.0, -1.0, 0.0],
        "phone": {
            "model": "MC-3P",
            "center": [round(v, 4) for v in phone_center],
            "dimensions": [0.23, 0.26, 0.37],
            "front_direction": [0.0, -1.0, 0.0],
            "front_center": [round(cx, 4), round(phone_front_y, 4), 1.39],
            "front_surface_y": round(phone_front_y, 4),
            "key_centers": key_centers,
            "key_press": {"key": "6", "target": key_centers["6"]},
        },
        "camera": {
            "position": [3.60, -0.34, 1.63],
            "target": key_centers["6"],
            "lens_mm": 32.0,
            "hide": ["Booth.Door.Glass", "Booth.Door.Frame.Left",
                     "Booth.Door.Frame.Right", "Booth.Door.Frame.Top"],
        },
    }


def _build_room_phone(x: float, y: float, z: float) -> None:
    _box("Room.Table.Phone.Body", (x, y, z), (0.30, 0.21, 0.11), "cream", "room", bevel=0.025)
    _box("Room.Table.Phone.Receiver", (x, y - 0.005, z + 0.105),
         (0.31, 0.070, 0.070), "cream", "room", bevel=0.025)
    _box("Room.Table.Phone.Receiver.Left", (x - 0.125, y - 0.005, z + 0.095),
         (0.070, 0.10, 0.085), "cream", "room", bevel=0.02)
    _box("Room.Table.Phone.Receiver.Right", (x + 0.125, y - 0.005, z + 0.095),
         (0.070, 0.10, 0.085), "cream", "room", bevel=0.02)
    for row in range(4):
        for col in range(3):
            _cylinder(f"Room.Table.Phone.Key.{row}.{col}",
                      (x - 0.045 + col * 0.045, y - 0.108, z + 0.030 + (3 - row) * 0.017),
                      0.009, 0.006, "key", "room",
                      rotation=(math.pi / 2.0, 0.0, 0.0), vertices=10)


def _build_answerer(x: float, y: float, z: float) -> None:
    _box("Room.Table.Answerer.Body", (x, y, z), (0.32, 0.23, 0.10), "building_alt", "room", bevel=0.018)
    _box("Room.Table.Answerer.CassetteWindow", (x, y - 0.119, z + 0.012),
         (0.19, 0.010, 0.065), "glass", "room", glass=True)
    for i, dx in enumerate((-0.055, 0.055)):
        _cylinder(f"Room.Table.Answerer.Reel.{i}", (x + dx, y - 0.127, z + 0.012),
                  0.026, 0.008, "cream", "room",
                  rotation=(math.pi / 2.0, 0.0, 0.0), vertices=12)
        _cylinder(f"Room.Table.Answerer.ReelHub.{i}", (x + dx, y - 0.133, z + 0.012),
                  0.009, 0.007, "black", "room",
                  rotation=(math.pi / 2.0, 0.0, 0.0), vertices=8)
    _sphere("Room.Table.Answerer.LED", (x + 0.125, y - 0.128, z + 0.024),
            (0.009, 0.005, 0.009), "led", "room")
    for i in range(3):
        _box(f"Room.Table.Answerer.Button.{i}", (x - 0.055 + i * 0.055, y - 0.128, z - 0.036),
             (0.040, 0.008, 0.018), "key", "room")


def _build_room() -> dict:
    cx, cy = 30.0, 0.0
    width, depth, height = 3.6, 2.7, 2.4
    # Six 1.8 x 0.9 m mats: two columns by three rows.
    for col in range(2):
        for row in range(3):
            x = cx - 0.9 + col * 1.8
            y = cy - 0.9 + row * 0.9
            prefix = f"Room.Tatami.{col}.{row}"
            _box(prefix, (x, y, 0.035), (1.76, 0.86, 0.07), "tatami", "room", bevel=0.012)
            _box(prefix + ".Edge.Left", (x - 0.875, y, 0.074), (0.025, 0.86, 0.025), "tatami_edge", "room")
            _box(prefix + ".Edge.Right", (x + 0.875, y, 0.074), (0.025, 0.86, 0.025), "tatami_edge", "room")

    _box("Room.Ceiling", (cx, cy, height), (width + 0.12, depth + 0.12, 0.10), "room_wall", "room")
    _box("Room.Wall.Back", (cx, cy + depth / 2.0, height / 2.0),
         (width + 0.10, 0.10, height), "room_wall", "room")
    _box("Room.Wall.Front", (cx, cy - depth / 2.0, height / 2.0),
         (width + 0.10, 0.10, height), "room_wall", "room")
    _box("Room.Wall.Left", (cx - width / 2.0, cy, height / 2.0),
         (0.10, depth, height), "room_wall", "room")
    # The right wall has a real opening rather than a glass/frame decal over a
    # solid slab.  Window opening: y -0.345..1.105, z 0.705..2.055.
    right_x = cx + width / 2.0
    _box("Room.Wall.Right.Front", (right_x, cy - 0.8475, height / 2.0),
         (0.10, 1.005, height), "room_wall", "room")
    _box("Room.Wall.Right.Back", (right_x, cy + 1.2275, height / 2.0),
         (0.10, 0.245, height), "room_wall", "room")
    _box("Room.Wall.Right.Sill", (right_x, cy + 0.38, 0.3525),
         (0.10, 1.45, 0.705), "room_wall", "room")
    _box("Room.Wall.Right.Header", (right_x, cy + 0.38, 2.2275),
         (0.10, 1.45, 0.345), "room_wall", "room")

    # Door and empty coat hooks near it, matching the left side of the reference.
    # Entry frame stays at the front-left threshold while the door leaf is open
    # inward against the left wall, keeping the bookshelf and empty hooks clear.
    door_threshold_x = cx - 1.12
    door_front_y = cy - depth / 2.0 - 0.055
    _box("Room.Door.Frame.Left", (door_threshold_x - 0.44, door_front_y, 1.05),
         (0.065, 0.075, 2.12), "wood", "room")
    _box("Room.Door.Frame.Right", (door_threshold_x + 0.44, door_front_y, 1.05),
         (0.065, 0.075, 2.12), "wood", "room")
    _box("Room.Door.Frame.Top", (door_threshold_x, door_front_y, 2.095),
         (0.94, 0.075, 0.065), "wood", "room")
    door_leaf_x = cx - width / 2.0 + 0.085
    door_leaf_y = cy - depth / 2.0 + 0.43
    _box("Room.Door", (door_leaf_x, door_leaf_y, 1.05),
         (0.82, 0.055, 2.05), "wood", "room", rotation=(0.0, 0.0, math.pi / 2.0))
    _cylinder("Room.Door.Knob", (door_leaf_x + 0.04, door_leaf_y + 0.27, 1.02),
              0.035, 0.055, "metal", "room", rotation=(0.0, math.pi / 2.0, 0.0), vertices=10)
    _box("Room.Hooks.Rail", (cx - width / 2.0 + 0.055, cy + 0.03, 1.64),
         (0.055, 0.72, 0.075), "wood", "room")
    for i in range(4):
        hook_y = cy - 0.24 + i * 0.18
        _cylinder_between(f"Room.Hooks.Empty.{i}",
                          (cx - width / 2.0 - 0.002, hook_y, 1.64),
                          (cx - width / 2.0 + 0.13, hook_y, 1.64),
                          0.012, "metal", "room", vertices=8)

    # Window is set into the right wall; its overlay is enough for blockout and
    # can be hidden separately without changing the room shell.
    _box("Room.Window.Glass", (cx + width / 2.0 + 0.056, cy + 0.38, 1.38),
         (0.018, 1.45, 1.35), "glass", "room", glass=True)
    for i, z in enumerate((0.70, 2.06)):
        _box(f"Room.Window.Frame.Horizontal.{i}", (cx + width / 2.0 + 0.07, cy + 0.38, z),
             (0.06, 1.55, 0.06), "wood", "room")
    for i, y in enumerate((cy - 0.37, cy + 0.38, cy + 1.13)):
        _box(f"Room.Window.Frame.Vertical.{i}", (cx + width / 2.0 + 0.07, y, 1.38),
             (0.06, 0.06, 1.42), "wood", "room")

    # Back-left bookshelf with readable shelf divisions and low-poly book rows.
    bx, by = cx - 1.32, cy + 1.11
    _box("Room.Bookshelf.Body", (bx, by, 1.00), (0.62, 0.38, 1.85), "wood", "room")
    _box("Room.Bookshelf.Opening", (bx, by - 0.20, 1.13), (0.50, 0.035, 1.42), "black", "room")
    for shelf in range(4):
        z = 0.50 + shelf * 0.36
        _box(f"Room.Bookshelf.Shelf.{shelf}", (bx, by - 0.225, z),
             (0.52, 0.36, 0.045), "wood", "room")
        for book in range(5):
            _box(f"Room.Bookshelf.Book.{shelf}.{book}",
                 (bx - 0.19 + book * 0.09, by - 0.246, z + 0.13),
                 (0.055 + 0.008 * ((book + shelf) % 2), 0.12, 0.22 + 0.025 * ((book + shelf) % 3)),
                 "fabric" if (book + shelf) % 2 else "cream", "room")

    # Folded futons at the back, opposite the door.
    for i in range(4):
        _box(f"Room.Futon.{i}", (cx + 0.62, cy + 1.02, 0.19 + i * 0.15),
             (1.14 - i * 0.04, 0.61, 0.16), "fabric", "room", bevel=0.055)
    _box("Room.Futon.Pillow", (cx + 0.70, cy + 1.00, 0.84),
         (0.62, 0.38, 0.16), "cream", "room", bevel=0.055)

    # Low table centered in the room, with clearly separate phone/answerer units.
    table_x, table_y, table_z = cx, cy + 0.08, 0.40
    _box("Room.Table.Top", (table_x, table_y, table_z), (1.34, 0.78, 0.085), "wood", "room", bevel=0.025)
    for ix, dx in enumerate((-0.55, 0.55)):
        for iy, dy in enumerate((-0.27, 0.27)):
            _box(f"Room.Table.Leg.{ix}.{iy}", (table_x + dx, table_y + dy, 0.20),
                 (0.09, 0.09, 0.40), "wood", "room")
    _build_room_phone(table_x - 0.32, table_y - 0.02, table_z + 0.095)
    _build_answerer(table_x + 0.34, table_y - 0.02, table_z + 0.075)

    # A simple period pendant fixture (geometry only; renderer owns actual lights).
    _cylinder("Room.Light.Cord", (cx, cy, 2.16), 0.012, 0.48, "black", "room", vertices=8)
    _box("Room.Light.Shade", (cx, cy, 1.93), (0.56, 0.42, 0.18), "cream", "room", bevel=0.035)

    return {
        "center": [cx, cy, 0.0],
        "dimensions": [width, depth, height],
        "tatami": {"count": 6, "mat_dimensions": [1.8, 0.9], "layout": [2, 3]},
        "entry": {
            "door_center": [door_threshold_x, door_front_y, 1.05],
            "door_leaf_center": [door_leaf_x, door_leaf_y, 1.05],
            "view_direction": [0.0, 1.0, 0.0],
        },
        "camera": {
            "position": [30.0, -3.35, 1.52],
            "target": [30.0, 0.25, 0.72],
            # Wide enough that the left-side entry/hooks and right-side window
            # remain readable while the low table stays centered.
            "lens_mm": 26.0,
            "hide": ["Room.Wall.Front", "Room.Ceiling"],
        },
        "table_center": [table_x, table_y, table_z],
    }


def build_environment() -> dict:
    """Build the street, booth and six-tatami room and return JSON-safe metadata.

    Scene units are meters, Z is up, the street recedes along +Y, and characters
    in the booth face +Y.  A character's own right is therefore +X.  No scene
    reset, camera creation, rendering, or file saving occurs here.
    """
    _clear_previous()
    _env_collection()
    _build_street()
    booth = _build_booth()
    room = _build_room()
    return {
        "schema": "koiirozora.previs.environment.v1",
        "units": "meters",
        "axes": {"up": "+Z", "street_forward": "+Y"},
        "street": {
            "bounds": {"x": [-6.05, 6.05], "y": [-7.0, 47.0], "z": [-0.16, 6.9]},
            "storefront_rows_x": [-5.0, 5.0],
            "camera": {
                "position": [-0.35, -10.5, 2.05],
                "target": [0.25, 18.0, 1.60],
                "lens_mm": 31.0,
            },
        },
        "booth": booth,
        "room": room,
        "interaction": {
            "character_faces": "+Y",
            "character_own_right": "+X",
            "phone_key_press": booth["phone"]["key_press"],
        },
        "hideable": {
            "glass_property": {"previs_glass": True},
            "room": ["Room.Ceiling", "Room.Wall.Front"],
        },
        "object_counts": {
            group: sum(1 for obj in bpy.data.objects if obj.get("previs_group") == group)
            for group in ("street", "booth", "room")
        },
    }


__all__ = ["build_environment"]
