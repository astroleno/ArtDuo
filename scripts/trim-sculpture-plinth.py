"""Run in background Blender: trim a reviewed Y-up source below one plane.

Only an unlinked temporary mesh is created. No .blend file is opened or saved.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
import bmesh
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--floor-y', required=True, type=float)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source, output = Path(args.input).resolve(), Path(args.output).resolve()
data = source.read_bytes()
count = struct.unpack_from('<I', data, 80)[0]
if len(data) != 84 + count * 50 or not np.isfinite(args.floor_y):
    raise ValueError('Invalid reviewed preparation source')
dtype = np.dtype([('normal', '<f4', (3,)), ('vertices', '<f4', (3, 3)), ('attribute', '<u2')])
triangles = np.frombuffer(data, dtype=dtype, count=count, offset=84)['vertices']
vertices, indices = np.unique(triangles.reshape(-1, 3), axis=0, return_inverse=True)
if not np.isfinite(vertices).all() or not vertices[:, 1].min() < args.floor_y < vertices[:, 1].max():
    raise ValueError('Invalid source crop plane')
mesh = bpy.data.meshes.new('ArtDuoTemporarySourceTrim')
bm = bmesh.new()
try:
    mesh.vertices.add(len(vertices))
    mesh.vertices.foreach_set('co', vertices.ravel())
    mesh.loops.add(len(indices))
    mesh.loops.foreach_set('vertex_index', indices)
    mesh.polygons.add(count)
    mesh.polygons.foreach_set('loop_start', np.arange(count, dtype=np.int32) * 3)
    mesh.polygons.foreach_set('loop_total', np.full(count, 3, dtype=np.int32))
    mesh.update()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00005)
    result = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        dist=0.00001, plane_co=(0, args.floor_y, 0), plane_no=(0, 1, 0), clear_inner=True, clear_outer=False)
    boundary = [edge for edge in bm.edges if edge.is_boundary and all(abs(v.co.y - args.floor_y) < 0.0002 for v in edge.verts)]
    if not boundary:
        raise ValueError('The reviewed crop did not produce a cap boundary')
    caps = bmesh.ops.holes_fill(bm, edges=boundary, sides=0)['faces']
    if not caps:
        raise ValueError('The new source bottom could not be closed')
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    remaining = [edge for edge in bm.edges if edge.is_boundary and all(abs(v.co.y - args.floor_y) < 0.0002 for v in edge.verts)]
    if remaining:
        raise ValueError('The new source bottom still has open edges')
    faces = list(bm.faces)
    binary = bytearray(84 + len(faces) * 50)
    binary[:80] = b'ArtDuo: removed later display plinth; closed source bottom.'.ljust(80, b'\0')
    struct.pack_into('<I', binary, 80, len(faces))
    for index, face in enumerate(faces):
        if len(face.verts) != 3:
            raise ValueError('Non-triangular trimmed source')
        values = list(face.normal)
        for vertex in face.verts:
            values.extend(vertex.co)
        struct.pack_into('<12fH', binary, 84 + index * 50, *values, 0)
    output.write_bytes(binary)
    receipt = {'recipe': 'reviewed-plinth-bisect-v1', 'blender': bpy.app.version_string,
        'inputFile': source.name, 'inputSha256': hashlib.sha256(data).hexdigest(), 'inputTriangles': count,
        'outputFile': output.name, 'sha256': hashlib.sha256(binary).hexdigest(), 'bytes': len(binary),
        'triangles': len(faces), 'floorY': args.floor_y, 'closedCutBoundary': True,
        'minY': min(v.co.y for v in bm.verts), 'maxY': max(v.co.y for v in bm.verts),
        'modifications': 'Removed the later high display plinth below a reviewed plane; retained the sculptural figure and thin integral base; closed the new underside.'}
    Path(str(output) + '.trim.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt), flush=True)
finally:
    bm.free()
    bpy.data.meshes.remove(mesh)
