"""Small deterministic PNG writer and technical labels, no extra dependency.

PNG composition is performed on Blender-rendered data, never generated imagery.
"""
import struct
import zlib
import numpy as np


def write_png(path, array):
    array = np.asarray(array, dtype=np.uint8)
    if array.ndim == 2:
        color_type = 0
    else:
        assert array.shape[2] == 3
        color_type = 2
    h, w = array.shape[:2]
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    rows = b"".join(b"\x00" + row.tobytes() for row in array)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(rows, 6)) + chunk(b"IEND", b""))


GLYPHS = {
    "A": [14,17,17,31,17,17,17], "B": [30,17,17,30,17,17,30], "C": [15,16,16,16,16,16,15],
    "D": [30,17,17,17,17,17,30], "E": [31,16,16,30,16,16,31], "F": [31,16,16,30,16,16,16],
    "G": [15,16,16,23,17,17,15], "H": [17,17,17,31,17,17,17], "I": [31,4,4,4,4,4,31],
    "J": [7,2,2,2,18,18,12], "K": [17,18,20,24,20,18,17], "L": [16,16,16,16,16,16,31],
    "M": [17,27,21,21,17,17,17], "N": [17,25,25,21,19,19,17], "O": [14,17,17,17,17,17,14],
    "P": [30,17,17,30,16,16,16], "Q": [14,17,17,17,21,18,13], "R": [30,17,17,30,20,18,17],
    "S": [15,16,16,14,1,1,30], "T": [31,4,4,4,4,4,4], "U": [17,17,17,17,17,17,14],
    "V": [17,17,17,17,17,10,4], "W": [17,17,17,21,21,27,17], "X": [17,17,10,4,10,17,17],
    "Y": [17,17,10,4,4,4,4], "Z": [31,1,2,4,8,16,31], "0": [14,17,19,21,25,17,14],
    "1": [4,12,4,4,4,4,14], "2": [14,17,1,2,4,8,31], "3": [30,1,1,14,1,1,30],
    "4": [2,6,10,18,31,2,2], "5": [31,16,16,30,1,1,30], "6": [14,16,16,30,17,17,14],
    "7": [31,1,2,4,8,8,8], "8": [14,17,17,14,17,17,14], "9": [14,17,17,15,1,1,14],
    "-": [0,0,0,31,0,0,0], "_": [0,0,0,0,0,0,31], "/": [1,2,2,4,8,8,16],
    ":": [0,4,4,0,4,4,0], ".": [0,0,0,0,0,12,12], "+": [0,4,4,31,4,4,0],
    "=": [0,0,31,0,31,0,0], " ": [0]*7,
}


def label(image, text, x, y, scale=2, color=(35,35,35)):
    for ch in text.upper():
        for row, bits in enumerate(GLYPHS.get(ch, GLYPHS[" "])):
            for col in range(5):
                if bits & (1 << (4-col)):
                    yy, xx = y+row*scale, x+col*scale
                    if 0 <= xx < image.shape[1]-scale and 0 <= yy < image.shape[0]-scale:
                        image[yy:yy+scale, xx:xx+scale] = color
        x += 6*scale


def erode(mask):
    padded = np.pad(mask, 1, constant_values=False)
    h, w = mask.shape
    result = mask.copy()
    for dy in range(3):
        for dx in range(3):
            result &= padded[dy:dy+h, dx:dx+w]
    return result


def dilate(mask):
    padded = np.pad(mask, 1, constant_values=False)
    h, w = mask.shape
    result = mask.copy()
    for dy in range(3):
        for dx in range(3):
            result |= padded[dy:dy+h, dx:dx+w]
    return result


def outline_image(raw):
    """Workbench hidden-surface outlines; recolor anatomical L/R contour only."""
    rgb = raw.astype(np.int16)
    left = (rgb[:,:,2] > rgb[:,:,0]+40) & (rgb[:,:,2] > rgb[:,:,1]+20)
    right = (rgb[:,:,0] > rgb[:,:,1]+40) & (rgb[:,:,0] > rgb[:,:,2]+30)
    gray = rgb.min(axis=2)
    # Workbench anti-aliased outline is grey on a white unlit surface.
    tone = np.clip((gray-180)*255/65, 0, 255).astype(np.uint8)
    result = np.repeat(tone[:,:,None], 3, axis=2)
    for mask, color in ((left, (24,80,215)), (right, (218,45,43))):
        result[mask] = 255
        border = dilate(mask) & ~erode(mask)
        result[border] = color
    return result
