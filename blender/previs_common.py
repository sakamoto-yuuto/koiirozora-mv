"""Shared paths and sandboxed Blender launch for the T11 previs tools."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

BASE = Path(__file__).resolve().parent
PROJECT = BASE.parent
BLENDER = Path(os.environ.get("PREVIS_BLENDER", r"D:\Blender\blender-5.2.2-windows-x64\blender.exe"))
TMP = BASE / "_tmp"
BLEND = BASE / "previs.blend"


def sandbox_environment():
    env = os.environ.copy()
    for key, path in {
        "BLENDER_USER_CONFIG": TMP / "config",
        "BLENDER_USER_SCRIPTS": TMP / "scripts",
        "TEMP": TMP,
        "TMP": TMP,
        "TMPDIR": TMP,
    }.items():
        path.mkdir(parents=True, exist_ok=True)
        env[key] = str(path)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    return env


def launch_blender(script, args=()):
    """No shell, detached helper, third-party process killing, or global settings."""
    if not BLENDER.is_file():
        raise FileNotFoundError(f"Blender executable not found: {BLENDER}")
    command = [str(BLENDER), "-b", "--factory-startup", "--threads", "8",
               "--python-exit-code", "1", "--python", str(script), "--", *map(str, args)]
    print("Blender:", BLENDER, flush=True)
    result = subprocess.call(command, cwd=str(PROJECT), env=sandbox_environment())
    if result:
        print(f"Blender exited with code {result}", flush=True)
        if result == 0xC0000142:
            print("Managed Windows desktop: use powershell.exe -NoProfile -ExecutionPolicy Bypass "
                  "-File blender/run_previs.ps1 -Action all (native launch).", flush=True)
    return result


def in_blender():
    try:
        import bpy  # noqa: F401
        return True
    except ImportError:
        return False


def script_args():
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return [] if in_blender() else sys.argv[1:]


def inside_base(path):
    result = Path(path).resolve()
    if not result.is_relative_to(BASE):
        raise ValueError(f"Output must remain below {BASE}: {result}")
    return result
