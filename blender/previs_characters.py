"""Procedural rough character rigs for the T11 Blender previs.

Coordinate contract
-------------------
Blender Z is up, local +Y is character forward, local -X is the character's
left and local +X is the character's right.  All measurements are metres.

The meshes are deliberately simple, rigid pieces parented to deform bones.
That keeps the silhouettes readable and the saved .blend directly poseable in
Blender while making scripted posing deterministic.
"""

from __future__ import annotations

import math
from typing import Dict, Iterable, Mapping, MutableMapping, Optional, Sequence

import bpy
from mathutils import Matrix, Vector


COLLECTION_NAME = "Previs.Characters"
GROUP_TAG = "character"
FINGER_NAMES = ("thumb", "index", "middle", "ring", "pinky")


CHARACTER_SPECS = {
    "yuki": {
        "label": "Yuki",
        "height": 1.60,
        "pelvis_z": 0.82,
        "hip_z": 0.84,
        "knee_z": 0.46,
        "ankle_z": 0.105,
        "shoulder_z": 1.285,
        "shoulder_x": 0.145,
        "neck_z": 1.405,
        "head_center_z": 1.505,
        "upper_arm": 0.275,
        "forearm": 0.245,
        "hand": 0.095,
        "thigh": 0.385,
        "shin": 0.355,
        "coat_bottom": 0.61,
        "palette": {
            "skin": (0.86, 0.67, 0.56, 1.0),
            "hair": (0.24, 0.045, 0.075, 1.0),
            "coat": (0.78, 0.70, 0.57, 1.0),
            "inner": (0.18, 0.15, 0.18, 1.0),
            "trouser": (0.035, 0.055, 0.09, 1.0),
            "boot": (0.025, 0.035, 0.055, 1.0),
            "accent": (0.055, 0.07, 0.09, 1.0),
        },
    },
    "touya": {
        "label": "Touya",
        "height": 1.75,
        "pelvis_z": 0.91,
        "hip_z": 0.93,
        "knee_z": 0.505,
        "ankle_z": 0.11,
        "shoulder_z": 1.405,
        "shoulder_x": 0.155,
        "neck_z": 1.535,
        "head_center_z": 1.645,
        "upper_arm": 0.30,
        "forearm": 0.27,
        "hand": 0.105,
        "thigh": 0.43,
        "shin": 0.405,
        "coat_bottom": 0.66,
        "palette": {
            "skin": (0.82, 0.64, 0.52, 1.0),
            "hair": (0.025, 0.03, 0.045, 1.0),
            "coat": (0.74, 0.72, 0.65, 1.0),
            "inner": (0.42, 0.59, 0.64, 1.0),
            "trouser": (0.08, 0.12, 0.16, 1.0),
            "boot": (0.22, 0.13, 0.075, 1.0),
            "accent": (0.19, 0.13, 0.085, 1.0),
        },
    },
}


def _vec(value: Sequence[float]) -> Vector:
    return Vector((float(value[0]), float(value[1]), float(value[2])))


def _tag(obj: bpy.types.Object, character_id: str, side: Optional[str] = None) -> None:
    obj["previs_group"] = GROUP_TAG
    obj["character_id"] = character_id
    if side:
        obj["previs_side"] = side


def _collection() -> bpy.types.Collection:
    collection = bpy.data.collections.get(COLLECTION_NAME)
    if collection is None:
        collection = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _move_to_collection(obj: bpy.types.Object) -> None:
    collection = _collection()
    for source in tuple(obj.users_collection):
        source.objects.unlink(obj)
    collection.objects.link(obj)


def _material(name: str, rgba: Sequence[float]) -> bpy.types.Material:
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.diffuse_color = tuple(rgba)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = tuple(rgba)
        bsdf.inputs["Roughness"].default_value = 0.82
    return mat


def _set_material(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    if hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def _parent_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, bone: str) -> None:
    # Bake the primitive's placement into its vertices, then give every vertex
    # full weight on one bone.  This is a rigid skin (no rubbery interpolation)
    # and is more stable across save/reload than BONE-parent inverse matrices.
    # dimensions/rotation assignments are dependency-graph lazy; update once
    # so the matrix baked below contains the intended primitive dimensions.
    bpy.context.view_layer.update()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.parent = armature
    obj.parent_type = "OBJECT"
    obj.matrix_parent_inverse = Matrix.Identity(4)
    group = obj.vertex_groups.new(name=bone)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new(name="Previs.RigidSkin", type="ARMATURE")
    modifier.object = armature
    modifier.use_vertex_groups = True


def _cube(
    name: str,
    location: Sequence[float],
    dimensions: Sequence[float],
    mat: bpy.types.Material,
    character_id: str,
    armature: bpy.types.Object,
    bone: str,
    side: Optional[str] = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    _set_material(obj, mat)
    _tag(obj, character_id, side)
    _move_to_collection(obj)
    _parent_to_bone(obj, armature, bone)
    return obj


def _sphere(
    name: str,
    location: Sequence[float],
    dimensions: Sequence[float],
    mat: bpy.types.Material,
    character_id: str,
    armature: bpy.types.Object,
    bone: str,
    side: Optional[str] = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.5, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    _set_material(obj, mat)
    _tag(obj, character_id, side)
    _move_to_collection(obj)
    _parent_to_bone(obj, armature, bone)
    return obj


def _cylinder(
    name: str,
    start: Sequence[float],
    end: Sequence[float],
    radius: float,
    mat: bpy.types.Material,
    character_id: str,
    armature: bpy.types.Object,
    bone: str,
    side: Optional[str] = None,
    vertices: int = 10,
) -> bpy.types.Object:
    a, b = _vec(start), _vec(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=(a + b) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    _set_material(obj, mat)
    _tag(obj, character_id, side)
    _move_to_collection(obj)
    _parent_to_bone(obj, armature, bone)
    return obj


def _trapezoid(
    name: str,
    z_bottom: float,
    z_top: float,
    width_bottom: float,
    width_top: float,
    depth: float,
    mat: bpy.types.Material,
    character_id: str,
    armature: bpy.types.Object,
    bone: str,
) -> bpy.types.Object:
    xb, xt, yd = width_bottom * 0.5, width_top * 0.5, depth * 0.5
    verts = [
        (-xb, -yd, z_bottom), (xb, -yd, z_bottom), (xb, yd, z_bottom), (-xb, yd, z_bottom),
        (-xt, -yd, z_top), (xt, -yd, z_top), (xt, yd, z_top), (-xt, yd, z_top),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
    mesh = bpy.data.meshes.new(name + ".Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    _collection().objects.link(obj)
    _set_material(obj, mat)
    _tag(obj, character_id)
    _parent_to_bone(obj, armature, bone)
    return obj


def _add_edit_bone(
    armature_data: bpy.types.Armature,
    name: str,
    head: Sequence[float],
    tail: Sequence[float],
    parent: Optional[bpy.types.EditBone] = None,
) -> bpy.types.EditBone:
    bone = armature_data.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    bone.parent = parent
    bone.use_connect = False
    return bone


def _build_armature(character_id: str) -> bpy.types.Object:
    spec = CHARACTER_SPECS[character_id]
    label = spec["label"]
    data = bpy.data.armatures.new(f"{label}.RigData")
    armature = bpy.data.objects.new(f"{label}.Rig", data)
    _collection().objects.link(armature)
    _tag(armature, character_id)
    armature.show_in_front = True
    armature.display_type = "WIRE"
    armature["neutral_height_m"] = spec["height"]
    armature["forward_axis"] = "+Y"
    armature["left_axis"] = "-X"

    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    root = _add_edit_bone(data, "root", (0, 0, 0), (0, 0, 0.08))
    pelvis = _add_edit_bone(data, "pelvis", (0, 0, spec["pelvis_z"] - 0.06), (0, 0, spec["pelvis_z"] + 0.06), root)
    spine = _add_edit_bone(data, "spine", pelvis.tail, (0, 0, spec["shoulder_z"] - 0.18), pelvis)
    chest = _add_edit_bone(data, "chest", spine.tail, (0, 0, spec["shoulder_z"]), spine)
    neck = _add_edit_bone(data, "neck", chest.tail, (0, 0, spec["neck_z"]), chest)
    head = _add_edit_bone(data, "head", neck.tail, (0, 0, spec["height"] - 0.025), neck)

    for side, sign in (("L", -1.0), ("R", 1.0)):
        clavicle = _add_edit_bone(
            data, f"clavicle.{side}", (0, 0, spec["shoulder_z"] - 0.01),
            (sign * spec["shoulder_x"], 0, spec["shoulder_z"]), chest,
        )
        shoulder = _vec(clavicle.tail)
        elbow = shoulder + Vector((sign * 0.72, 0, -0.69)).normalized() * spec["upper_arm"]
        wrist = elbow + Vector((sign * 0.56, 0.04, -0.83)).normalized() * spec["forearm"]
        palm = wrist + Vector((sign * 0.46, 0.06, -0.88)).normalized() * spec["hand"]
        upper = _add_edit_bone(data, f"upper_arm.{side}", shoulder, elbow, clavicle)
        fore = _add_edit_bone(data, f"forearm.{side}", elbow, wrist, upper)
        hand = _add_edit_bone(data, f"hand.{side}", wrist, palm, fore)
        fan = {"thumb": 0.030, "index": 0.020, "middle": 0.006, "ring": -0.010, "pinky": -0.025}
        lengths = {"thumb": 0.050, "index": 0.072, "middle": 0.075, "ring": 0.068, "pinky": 0.058}
        for finger_name in FINGER_NAMES:
            y = fan[finger_name]
            start = palm + Vector((0, y, 0))
            finish = start + Vector((sign * 0.30, 0, -0.95)).normalized() * lengths[finger_name]
            _add_edit_bone(data, f"finger.{finger_name}.{side}", start, finish, hand)

        hip = _add_edit_bone(data, f"hip.{side}", (0, 0, spec["hip_z"]), (sign * 0.092, 0, spec["hip_z"]), pelvis)
        thigh = _add_edit_bone(data, f"thigh.{side}", hip.tail, hip.tail + Vector((0, 0, -spec["thigh"])), hip)
        shin = _add_edit_bone(data, f"shin.{side}", thigh.tail, thigh.tail + Vector((0, 0, -spec["shin"])), thigh)
        _add_edit_bone(data, f"foot.{side}", shin.tail, (sign * 0.092, 0.205, 0.075), shin)

    bpy.ops.object.mode_set(mode="OBJECT")
    for bone in data.bones:
        if bone.name.endswith(".L"):
            bone["previs_side"] = "L"
        elif bone.name.endswith(".R"):
            bone["previs_side"] = "R"
    armature.select_set(False)
    return armature


def _build_meshes(character_id: str, armature: bpy.types.Object) -> None:
    spec = CHARACTER_SPECS[character_id]
    label = spec["label"]
    mats = {key: _material(f"Previs.Char.{label}.{key.title()}", value) for key, value in spec["palette"].items()}

    # Body core.  The coat is a single readable A-line block for previs.
    _trapezoid(f"{label}.Coat", spec["coat_bottom"], spec["shoulder_z"] - 0.015, 0.43 if character_id == "yuki" else 0.40, 0.31, 0.22, mats["coat"], character_id, armature, "chest")
    _cube(f"{label}.Pelvis", (0, 0, spec["pelvis_z"]), (0.235, 0.15, 0.18), mats["trouser"], character_id, armature, "pelvis")
    _cylinder(f"{label}.Neck", (0, 0, spec["shoulder_z"] - 0.01), (0, 0, spec["neck_z"] + 0.015), 0.048, mats["skin"], character_id, armature, "neck")
    head_z = spec["head_center_z"]
    head_dims = (0.155, 0.145, 0.19) if character_id == "yuki" else (0.165, 0.155, 0.205)
    _sphere(f"{label}.Head", (0, 0.018, head_z), head_dims, mats["skin"], character_id, armature, "head")

    if character_id == "yuki":
        # Straight chest-long hair: compact cap, broad back panel, two face locks.
        _sphere(f"{label}.HairCap", (0, -0.018, 1.50), (0.176, 0.145, 0.20), mats["hair"], character_id, armature, "head")
        _cube(f"{label}.HairBack", (0, -0.072, 1.315), (0.24, 0.075, 0.43), mats["hair"], character_id, armature, "head")
        _cube(f"{label}.HairLock.L", (-0.078, 0.052, 1.325), (0.038, 0.035, 0.34), mats["hair"], character_id, armature, "head")
        _cube(f"{label}.HairLock.R", (0.078, 0.052, 1.325), (0.038, 0.035, 0.34), mats["hair"], character_id, armature, "head")
        # Three high-contrast duffle toggles on the +Y front.
        for index, z in enumerate((0.91, 1.065, 1.20), start=1):
            _cube(f"{label}.Toggle.{index}", (0, 0.121, z), (0.13, 0.026, 0.018), mats["accent"], character_id, armature, "chest")
            _sphere(f"{label}.ToggleL.{index}", (-0.072, 0.125, z), (0.034, 0.03, 0.034), mats["accent"], character_id, armature, "chest")
            _sphere(f"{label}.ToggleR.{index}", (0.072, 0.125, z), (0.034, 0.03, 0.034), mats["accent"], character_id, armature, "chest")
    else:
        # No facial marks: Touya stays a plain previs head with layered dark hair.
        _sphere(f"{label}.HairCap", (0, -0.012, 1.65), (0.178, 0.15, 0.20), mats["hair"], character_id, armature, "head")
        for index, x in enumerate((-0.065, -0.022, 0.025, 0.067), start=1):
            _cube(f"{label}.HairLayer.{index}", (x, 0.063, 1.675 - 0.015 * (index % 2)), (0.052, 0.04, 0.12), mats["hair"], character_id, armature, "head")
        # Pale hood rests visibly on the -Y back of the thigh-length coat.
        _cube(f"{label}.HoodBack", (0, -0.145, 1.34), (0.24, 0.075, 0.17), mats["inner"], character_id, armature, "chest")
        _cube(f"{label}.HoodL", (-0.105, -0.125, 1.38), (0.055, 0.07, 0.18), mats["inner"], character_id, armature, "chest")
        _cube(f"{label}.HoodR", (0.105, -0.125, 1.38), (0.055, 0.07, 0.18), mats["inner"], character_id, armature, "chest")

    # Articulated rigid pieces.  Their names and side tags are renderer-friendly.
    bones = armature.data.bones
    for side in ("L", "R"):
        for part, radius, material in (
            ("upper_arm", 0.052, "coat"), ("forearm", 0.047, "coat"), ("hand", 0.030, "skin"),
            ("thigh", 0.064, "trouser"), ("shin", 0.054, "trouser"),
        ):
            bone_name = f"{part}.{side}"
            bone = bones[bone_name]
            _cylinder(f"{label}.{part}.{side}", bone.head_local, bone.tail_local, radius, mats[material], character_id, armature, bone_name, side)
        foot = bones[f"foot.{side}"]
        # Axis-aligned rest boot spans exactly z=0.00..0.09, establishing the
        # neutral visual height datum before any walk-cycle foot rotation.
        center = Vector((foot.head_local.x, 0.105, 0.045))
        _cube(f"{label}.Boot.{side}", center, (0.125, 0.27, 0.09), mats["boot"], character_id, armature, f"foot.{side}", side)
        for finger in FINGER_NAMES:
            bone_name = f"finger.{finger}.{side}"
            bone = bones[bone_name]
            _cylinder(f"{label}.finger.{finger}.{side}", bone.head_local, bone.tail_local, 0.009 if finger != "thumb" else 0.011, mats["skin"], character_id, armature, bone_name, side, vertices=8)


def _delete_existing_characters() -> None:
    for obj in list(bpy.data.objects):
        if obj.get("previs_group") == GROUP_TAG:
            bpy.data.objects.remove(obj, do_unlink=True)


def _segment_matrix(head: Vector, tail: Vector) -> Matrix:
    direction = tail - head
    if direction.length < 1.0e-6:
        direction = Vector((0, 0, 1.0e-4))
    rotation = direction.normalized().to_track_quat("Y", "Z").to_matrix().to_4x4()
    return Matrix.Translation(head) @ rotation


def _set_segment(armature: bpy.types.Object, bone_name: str, head: Vector, tail: Vector) -> None:
    armature.pose.bones[bone_name].matrix = _segment_matrix(head, tail)
    # Blender evaluates parent-space pose matrices lazily.  Force the parent
    # result before placing the next child, otherwise a whole chain can inherit
    # the previous evaluated parent and drift away from analytical targets.
    bpy.context.view_layer.update()


def _solve_two_bone(start: Vector, target: Vector, length_a: float, length_b: float, pole: Vector) -> tuple[Vector, Vector, Vector]:
    delta = target - start
    distance = max(1.0e-5, delta.length)
    direction = delta / distance
    reachable = min(max(distance, abs(length_a - length_b) + 1.0e-4), length_a + length_b - 1.0e-4)
    projected = (length_a * length_a - length_b * length_b + reachable * reachable) / (2.0 * reachable)
    height = math.sqrt(max(0.0, length_a * length_a - projected * projected))
    pole_delta = pole - start
    perpendicular = pole_delta - direction * pole_delta.dot(direction)
    if perpendicular.length < 1.0e-5:
        perpendicular = direction.cross(Vector((1, 0, 0)))
    if perpendicular.length < 1.0e-5:
        perpendicular = direction.cross(Vector((0, 1, 0)))
    elbow = start + direction * projected + perpendicular.normalized() * height
    return start, elbow, start + direction * reachable


def _pose_fingers(
    armature: bpy.types.Object,
    side: str,
    palm: Vector,
    hand_direction: Vector,
    pose_name: str,
    dial_tip: Optional[Vector] = None,
) -> None:
    sign = -1.0 if side == "L" else 1.0
    across = Vector((0, 1, 0))
    spacing = {"thumb": 0.030, "index": 0.018, "middle": 0.004, "ring": -0.011, "pinky": -0.025}
    lengths = {"thumb": 0.050, "index": 0.072, "middle": 0.075, "ring": 0.068, "pinky": 0.058}
    for finger in FINGER_NAMES:
        root = palm + across * spacing[finger]
        if dial_tip is not None and side == "R" and finger == "index":
            tip = dial_tip
        elif pose_name == "hold_walk":
            curl_y = 0.24 if finger in ("thumb", "index") else -0.10
            tip = root + Vector((sign * 0.25, curl_y, -0.94)).normalized() * lengths[finger]
        else:
            fan_y = 0.18 if finger == "thumb" else spacing[finger] * 4.0
            tip = root + Vector((sign * 0.23, fan_y, -0.97)).normalized() * lengths[finger]
        _set_segment(armature, f"finger.{finger}.{side}", root, tip)


def _pose_arm(
    armature: bpy.types.Object,
    character_id: str,
    side: str,
    shoulder: Vector,
    palm: Vector,
    pose_name: str,
    dial_tip: Optional[Vector] = None,
    require_reachable: bool = False,
) -> None:
    spec = CHARACTER_SPECS[character_id]
    sign = -1.0 if side == "L" else 1.0
    if pose_name == "dial" and side == "R":
        hand_direction = Vector((sign * 0.28, 0.88, 0.10)).normalized()
    elif pose_name == "hold_walk":
        hand_direction = Vector((sign * 0.86, 0.08, -0.50)).normalized()
    else:
        hand_direction = Vector((sign * 0.38, 0.08, -0.92)).normalized()
    wrist = palm - hand_direction * spec["hand"]
    # Let the elbow trail the hand swing instead of forcing both elbows toward
    # +Y.  The lower pole also yields a relaxed, almost-straight pendulum arm.
    pole = shoulder + Vector((sign * 0.18, (palm.y - shoulder.y) * 0.35, -0.34))
    _, elbow, solved_wrist = _solve_two_bone(shoulder, wrist, spec["upper_arm"], spec["forearm"], pole)
    reach_error = (solved_wrist - wrist).length
    if require_reachable and reach_error > 0.005:
        raise ValueError(
            f"unreachable explicit {character_id} hand target for {side}: "
            f"wrist error {reach_error:.6f} m exceeds 0.005 m"
        )
    _set_segment(armature, f"upper_arm.{side}", shoulder, elbow)
    _set_segment(armature, f"forearm.{side}", elbow, solved_wrist)
    _set_segment(armature, f"hand.{side}", solved_wrist, palm)
    _pose_fingers(armature, side, palm, hand_direction, pose_name, dial_tip=dial_tip)


def _pose_leg(
    armature: bpy.types.Object,
    character_id: str,
    side: str,
    hip: Vector,
    ankle: Vector,
    toe_y: float,
) -> None:
    spec = CHARACTER_SPECS[character_id]
    sign = -1.0 if side == "L" else 1.0
    pole = hip + Vector((sign * 0.025, 0.50, -0.32))
    _, knee, solved_ankle = _solve_two_bone(hip, ankle, spec["thigh"], spec["shin"], pole)
    hip_root = Vector((0, hip.y, hip.z))
    _set_segment(armature, f"hip.{side}", hip_root, hip)
    _set_segment(armature, f"thigh.{side}", hip, knee)
    _set_segment(armature, f"shin.{side}", knee, solved_ankle)
    _set_segment(armature, f"foot.{side}", solved_ankle, Vector((solved_ankle.x, toe_y, 0.075)))


WALK_PHASES = {
    # Side-view palms intentionally clear the coat's y=-.11..+.11 silhouette.
    # The L arm is the far/blue arm in the anatomical guide render.
    "contact": {"bob": 0.000, "lean": 0.018, "L": (0.245, 0.105), "R": (-0.225, 0.105), "hands": (-0.225, 0.225)},
    "down": {"bob": -0.040, "lean": 0.030, "L": (0.175, 0.105), "R": (-0.125, 0.120), "hands": (-0.215, 0.175)},
    "passing": {"bob": 0.000, "lean": 0.015, "L": (-0.035, 0.105), "R": (0.045, 0.190), "hands": (-0.205, 0.150)},
    "up": {"bob": 0.032, "lean": 0.010, "L": (-0.115, 0.115), "R": (0.155, 0.145), "hands": (0.185, -0.185)},
}


def _reset_pose(armature: bpy.types.Object) -> None:
    for pose_bone in armature.pose.bones:
        pose_bone.matrix_basis.identity()


def _armature_for(character_id: str) -> bpy.types.Object:
    label = CHARACTER_SPECS[character_id]["label"]
    armature = bpy.data.objects.get(f"{label}.Rig")
    if armature is None or armature.type != "ARMATURE":
        raise KeyError(f"Character rig is not loaded: {character_id}")
    return armature


def _world_to_local(armature: bpy.types.Object, point: Sequence[float]) -> Vector:
    return armature.matrix_world.inverted() @ _vec(point)


def evaluate_character_endpoints(character_id: str, world: bool = True) -> Dict[str, object]:
    """Return palm centres and every finger tip after dependency evaluation."""
    armature = _armature_for(character_id)
    bpy.context.view_layer.update()
    matrix = armature.matrix_world if world else Matrix.Identity(4)
    result: Dict[str, object] = {"palms": {}, "fingertips": {}}
    for side in ("L", "R"):
        result["palms"][side] = tuple(matrix @ armature.pose.bones[f"hand.{side}"].tail)
        result["fingertips"][side] = {
            finger: tuple(matrix @ armature.pose.bones[f"finger.{finger}.{side}"].tail)
            for finger in FINGER_NAMES
        }
    return result


def pose_character(character_id: str, spec: Optional[Mapping[str, object]] = None) -> Dict[str, object]:
    """Pose one loaded rig from a renderer-friendly dictionary.

    Supported keys: ``position``, ``heading_deg``, ``pose`` (stand/walk/dial/
    hold_walk), ``phase`` (contact/down/passing/up), optional per-bone Euler
    degree overrides in ``bones``, and optional world-space palm targets in
    ``hands``.  For ``dial`` the R target is the right index fingertip/contact
    point; for other poses a hand target is the palm centre.
    """
    if character_id not in CHARACTER_SPECS:
        raise ValueError(f"Unknown character_id: {character_id}")
    values: Mapping[str, object] = spec or {}
    armature = _armature_for(character_id)
    char = CHARACTER_SPECS[character_id]
    position = _vec(values.get("position", (0, 0, 0)))
    heading = math.radians(float(values.get("heading_deg", 0.0)))
    pose_name = str(values.get("pose", "stand"))
    if pose_name not in {"stand", "walk", "dial", "hold_walk"}:
        raise ValueError(f"Unsupported pose: {pose_name}")
    phase_name = str(values.get("phase", "contact"))
    if phase_name not in WALK_PHASES:
        raise ValueError(f"Unsupported walk phase: {phase_name}")

    armature.location = position
    armature.rotation_mode = "XYZ"
    armature.rotation_euler = (0, 0, heading)
    _reset_pose(armature)

    phase = WALK_PHASES[phase_name] if pose_name in {"walk", "hold_walk"} else {"bob": 0.0, "lean": 0.0, "L": (0.0, char["ankle_z"]), "R": (0.0, char["ankle_z"]), "hands": (0.0, 0.0)}
    bob = float(phase["bob"])
    lean = float(phase["lean"])
    pelvis = Vector((0, lean * 0.30, char["pelvis_z"] + bob))
    shoulder_y = lean

    # Central chain has a subtle walking lean while preserving scale.
    _set_segment(armature, "root", Vector((0, 0, 0)), Vector((0, 0, 0.08)))
    _set_segment(armature, "pelvis", pelvis + Vector((0, 0, -0.06)), pelvis + Vector((0, 0, 0.06)))
    _set_segment(armature, "spine", pelvis + Vector((0, 0, 0.06)), Vector((0, shoulder_y * 0.55, char["shoulder_z"] - 0.18 + bob)))
    _set_segment(armature, "chest", Vector((0, shoulder_y * 0.55, char["shoulder_z"] - 0.18 + bob)), Vector((0, shoulder_y, char["shoulder_z"] + bob)))
    _set_segment(armature, "neck", Vector((0, shoulder_y, char["shoulder_z"] + bob)), Vector((0, shoulder_y, char["neck_z"] + bob)))
    _set_segment(armature, "head", Vector((0, shoulder_y, char["neck_z"] + bob)), Vector((0, shoulder_y, char["height"] - 0.025 + bob)))

    hands = values.get("hands", {}) or {}
    for side, sign, hand_swing in (("L", -1.0, phase["hands"][0]), ("R", 1.0, phase["hands"][1])):
        shoulder = Vector((sign * char["shoulder_x"], shoulder_y, char["shoulder_z"] + bob))
        _set_segment(armature, f"clavicle.{side}", Vector((0, shoulder_y, char["shoulder_z"] - 0.01 + bob)), shoulder)
        explicit = hands.get(side) if isinstance(hands, Mapping) else None
        dial_tip = None
        if explicit is not None:
            local_target = _world_to_local(armature, explicit)
            if pose_name == "dial" and side == "R":
                dial_tip = local_target
                index_direction = Vector((0, 1.0, 0.08)).normalized()
                palm = local_target - index_direction * 0.072 - Vector((0, 0.018, 0))
            else:
                palm = local_target
        elif pose_name == "dial" and side == "R":
            dial_tip = Vector((0.34, 0.42, 1.18 + bob))
            index_direction = Vector((0, 1.0, 0.08)).normalized()
            palm = dial_tip - index_direction * 0.072 - Vector((0, 0.018, 0))
        else:
            base_z = char["pelvis_z"] + (0.03 if side == "R" else 0.0) + bob
            if phase_name == "passing" and pose_name in {"walk", "hold_walk"}:
                base_z += 0.035 if side == "R" else -0.015
            # Hands hang close to the hips in the transverse (X) direction;
            # their Y swing supplies the readable exact-side silhouette.
            palm = Vector((sign * (0.34 if character_id == "yuki" else 0.36), hand_swing + shoulder_y, base_z))
        _pose_arm(
            armature,
            character_id,
            side,
            shoulder,
            palm,
            pose_name,
            dial_tip=dial_tip,
            require_reachable=explicit is not None,
        )

    if pose_name in {"walk", "hold_walk"}:
        for side, sign in (("L", -1.0), ("R", 1.0)):
            step_y, ankle_z = phase[side]
            hip = Vector((sign * 0.092, pelvis.y, char["hip_z"] + bob))
            ankle = Vector((sign * 0.092, step_y, ankle_z))
            _pose_leg(armature, character_id, side, hip, ankle, step_y + 0.19)

    # Last-mile director overrides: Euler degrees on any named pose bone.
    bone_overrides = values.get("bones", {}) or {}
    if isinstance(bone_overrides, Mapping):
        for bone_name, degrees in bone_overrides.items():
            pose_bone = armature.pose.bones.get(str(bone_name))
            if pose_bone is None:
                raise KeyError(f"Unknown bone {bone_name!r} on {character_id}")
            pose_bone.rotation_mode = "XYZ"
            pose_bone.rotation_euler = tuple(math.radians(float(v)) for v in degrees)

    armature["active_pose"] = pose_name
    armature["active_phase"] = phase_name
    bpy.context.view_layer.update()
    return {
        "character_id": character_id,
        "armature": armature.name,
        "pose": pose_name,
        "phase": phase_name,
        "endpoints": evaluate_character_endpoints(character_id, world=True),
    }


def _bone_metadata(armature: bpy.types.Object) -> Dict[str, object]:
    return {
        "root": "root",
        "central": ["pelvis", "spine", "chest", "neck", "head"],
        "arms": {
            side: [f"clavicle.{side}", f"upper_arm.{side}", f"forearm.{side}", f"hand.{side}"]
            for side in ("L", "R")
        },
        "fingers": {
            side: [f"finger.{finger}.{side}" for finger in FINGER_NAMES]
            for side in ("L", "R")
        },
        "legs": {
            side: [f"hip.{side}", f"thigh.{side}", f"shin.{side}", f"foot.{side}"]
            for side in ("L", "R")
        },
        "all": [bone.name for bone in armature.data.bones],
    }


def build_characters() -> Dict[str, object]:
    """Rebuild Yuki and Touya deterministically and return renderer metadata."""
    _delete_existing_characters()
    result: MutableMapping[str, object] = {}
    for character_id in ("yuki", "touya"):
        armature = _build_armature(character_id)
        _build_meshes(character_id, armature)
        pose_character(character_id, {"pose": "stand"})
        char = CHARACTER_SPECS[character_id]
        result[character_id] = {
            "armature": armature.name,
            "height_m": char["height"],
            "coordinate_system": {"up": "+Z", "forward": "+Y", "left": "-X", "right": "+X"},
            "bones": _bone_metadata(armature),
            "endpoint_api": "evaluate_character_endpoints(character_id, world=True)",
            "supported_poses": ["stand", "walk", "dial", "hold_walk"],
            "walk_phases": list(WALK_PHASES.keys()),
        }
    bpy.context.view_layer.update()
    return dict(result)


__all__ = ["build_characters", "pose_character", "evaluate_character_endpoints", "WALK_PHASES"]

