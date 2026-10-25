"""Blender-side geometry, contact, API and actual depth-polarity regression tests."""
from pathlib import Path
import json
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from previs_common import BASE, BLEND, TMP, in_blender, launch_blender

if not in_blender():
    raise SystemExit(launch_blender(__file__))

import bpy
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from previs_characters import pose_character, evaluate_character_endpoints, FINGER_NAMES
from render_guides import configure_pass, configure_shot, load_pixels, read_shot


class PrevisTests(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))

    def test_metric_geometry_and_rigs(self):
        self.assertEqual(bpy.context.scene.unit_settings.system, "METRIC")
        self.assertAlmostEqual(bpy.context.scene.unit_settings.scale_length, 1)
        room = json.loads(bpy.context.scene["previs_environment_metadata"])["room"]
        self.assertEqual(room["tatami"]["count"], 6)
        self.assertEqual(len([o for o in bpy.data.objects if o.name.startswith("Room.Tatami.") and o.name.count(".") == 3]), 6)
        self.assertEqual(tuple(round(v,2) for v in bpy.data.objects["Booth.Phone.Body"].dimensions), (0.23,0.26,0.37))
        for cid, expected in (("yuki",1.6),("touya",1.75)):
            pose_character(cid, {"pose":"stand"})
            rig = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o.get("character_id") == cid)
            self.assertEqual(len(rig.data.bones),32)
            for side in ("L","R"):
                for finger in FINGER_NAMES:
                    self.assertIn(f"finger.{finger}.{side}",rig.data.bones)
            zs=[]
            graph=bpy.context.evaluated_depsgraph_get()
            for obj in bpy.data.objects:
                if obj.type == "MESH" and obj.get("character_id") == cid:
                    self.assertTrue(any(m.type == "ARMATURE" for m in obj.modifiers),obj.name)
                    evaluated=obj.evaluated_get(graph)
                    zs.extend((evaluated.matrix_world@Vector(c)).z for c in evaluated.bound_box)
            self.assertAlmostEqual(min(zs),0,places=3)
            self.assertAlmostEqual(max(zs),expected,places=3)

    def test_contacts_and_camera_framing(self):
        checks=[]
        for filename in ("street_wide","walk_cycle_side","walk_back_pair","booth_inside_over_shoulder","his_room_from_door"):
            shot=read_shot(BASE/"shots"/f"{filename}.json")
            for index, frame in enumerate(shot.get("frames",[{}])):
                audit=configure_shot(shot,frame,index)
                if filename == "street_wide":
                    scene=bpy.context.scene
                    booth=world_to_camera_view(scene,scene.camera,Vector((3.6,1,1.1)))
                    yuki=world_to_camera_view(scene,scene.camera,Vector((-1.7,-0.5,0.83)))
                    self.assertGreater(booth.x,2/3)
                    self.assertLess(booth.x,0.95)
                    self.assertLess(yuki.x,0.5)
                if filename == "walk_back_pair":
                    a=audit["characters"]["yuki"]["endpoints"]["palms"]["L"]
                    b=audit["characters"]["touya"]["endpoints"]["palms"]["R"]
                    self.assertLess((Vector(a)-Vector(b)).length,0.005)
                if filename == "walk_cycle_side":
                    hands=audit["characters"]["yuki"]["endpoints"]["palms"]
                    self.assertGreater(abs(hands["L"][1]-hands["R"][1]),0.2)
                for value in audit["characters"].values():
                    self.assertTrue(all(error<0.005 for error in value["hand_target_errors_m"].values()))
                checks.append(audit)
        self.assertEqual(len(checks),11)

    def test_mesh_really_moves_with_pose(self):
        def points():
            obj=bpy.data.objects["Yuki.Boot.L"].evaluated_get(bpy.context.evaluated_depsgraph_get())
            return [obj.matrix_world@v.co for v in obj.data.vertices]
        pose_character("yuki",{"pose":"walk","phase":"contact"})
        a=points()
        pose_character("yuki",{"pose":"walk","phase":"passing"})
        b=points()
        self.assertGreater(max((p-q).length for p,q in zip(a,b)),0.1)

    def test_unreachable_target_fails(self):
        shot=read_shot(BASE/"shots/booth_inside_over_shoulder.json")
        shot["characters"]["yuki"]["hands"]["R"]=[100,100,100]
        with self.assertRaisesRegex(ValueError,"unreachable"):
            configure_shot(shot,{},0)

    def test_hidden_glass_and_room_cutaway(self):
        shot=read_shot(BASE/"shots/his_room_from_door.json")
        configure_shot(shot,{},0)
        for obj in bpy.data.objects:
            if obj.get("previs_glass"):
                self.assertTrue(obj.hide_render,obj.name)
        self.assertTrue(bpy.data.objects["Room.Ceiling"].hide_render)
        self.assertFalse(bpy.data.objects["Room.Table.Top"].hide_render)

    def test_depth_actual_near_white_far_black(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene=bpy.context.scene
        scene.world=bpy.data.worlds.new("Fixture.World")
        scene.world.use_nodes=True
        data=bpy.data.cameras.new("Fixture.Camera")
        camera=bpy.data.objects.new("Fixture.Camera",data)
        scene.collection.objects.link(camera)
        camera.location=(0,-6,1)
        camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat("-Z","Y").to_euler()
        data.type="ORTHO"
        data.ortho_scale=5
        scene.camera=camera
        for x,y in ((-1,-2),(1,2)):
            bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,1))
        scene.render.resolution_x,scene.render.resolution_y=320,180
        scene.render.resolution_percentage=100
        bpy.context.view_layer.update()
        configure_pass(scene,"depth",{"depth_range_m":[2,10]})
        path=TMP/"depth_polarity_fixture.png"
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        pixels=load_pixels(path)
        values=[]
        for x,y in ((-1,-2),(1,2)):
            uv=world_to_camera_view(scene,camera,Vector((x,y,1)))
            value=int(pixels[int((1-uv.y)*180),int(uv.x*320),0])
            expected=round((10-((y-0.5)-(-6)))/8*255)
            self.assertLess(abs(value-expected),3,(value,expected))
            values.append(value)
        self.assertGreater(values[0],values[1]+100)
        self.assertEqual(int(pixels[0,0,0]),0)
        self.assertTrue(np.array_equal(pixels[:,:,0],pixels[:,:,1]))


suite=unittest.defaultTestLoader.loadTestsFromTestCase(PrevisTests)
result=unittest.TextTestRunner(verbosity=2).run(suite)
report={"tests":result.testsRun,"failures":len(result.failures),"errors":len(result.errors),"passed":result.wasSuccessful(),
        "failure_details":[{"test":str(t),"traceback":trace} for t,trace in result.failures+result.errors]}
(BASE/"out/test_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
if not result.wasSuccessful():
    raise RuntimeError("Previs regression tests failed")
