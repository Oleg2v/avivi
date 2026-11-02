#!/usr/bin/env python3
"""
Avivi Kitchens design concept: offline Cycles renders for the visualiser demo
and for the photography slots.

These images are concept renders, generated procedurally (no photos, no stock).
They stand in for Avivi's own photography and for live AI results.

Usage (requires `pip install bpy==5.2.3` on Python 3.13):
  python scripts/render/scenes.py --room a --style before --out out/room-a-before.png
  python scripts/render/scenes.py --room b --style dark --light evening --out out/b-dark-night.png
  python scripts/render/scenes.py --room b --style light --shot detail --out out/light-detail.png

Rooms:  a = 1980s apartment kitchen (L), b = new apartment, open plan (run + island),
        c = empty room under renovation (U)
Styles: before | modern | classic | dark | light | specials
"""
import argparse
import math
import random
import sys

import bpy

# --------------------------------------------------------------------------- args
ap = argparse.ArgumentParser()
ap.add_argument("--room", default="a", choices=["a", "b", "c"])
ap.add_argument("--style", default="modern",
                choices=["before", "modern", "classic", "dark", "light", "specials"])
ap.add_argument("--light", default="day", choices=["day", "evening"])
ap.add_argument("--shot", default="wide", choices=["wide", "detail"])
ap.add_argument("--out", required=True)
ap.add_argument("--res", nargs=2, type=int, default=[1500, 1000])
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--seed", type=int, default=7)
args = ap.parse_args(sys.argv[1:])

random.seed(args.seed)
TAU = math.tau
D2R = math.pi / 180.0

# --------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
cy = scene.cycles
cy.device = "CPU"
cy.samples = args.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.015
cy.use_denoising = True
try:
    cy.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
cy.max_bounces = 10
cy.diffuse_bounces = 5
cy.glossy_bounces = 4
cy.transmission_bounces = 6
cy.sample_clamp_indirect = 6.0
cy.blur_glossy = 1.0
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.seed = args.seed
scene.render.resolution_x, scene.render.resolution_y = args.res
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.film_transparent = False
try:
    scene.view_settings.view_transform = "AgX"
except Exception:
    pass
for look in ("AgX - Medium High Contrast", "Medium High Contrast", "AgX - Base Contrast"):
    try:
        scene.view_settings.look = look
        print("look:", look)
        break
    except Exception:
        continue

COLL = scene.collection


# --------------------------------------------------------------------------- colour
def lin(hexstr, a=1.0):
    """sRGB hex -> linear RGBA tuple (Blender node colours are linear)."""
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], a)


def scale_col(c, k):
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


# --------------------------------------------------------------------------- nodes
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, bsdf


def si(node, key, val):
    """Set an input default if the socket exists (API differs between versions)."""
    try:
        node.inputs[key].default_value = val
    except Exception:
        pass


def ramp(nt, stops, interp="LINEAR"):
    r = nt.nodes.new("ShaderNodeValToRGB")
    cr = r.color_ramp
    cr.interpolation = interp
    # first two elements exist by default
    cr.elements[0].position = stops[0][0]
    cr.elements[0].color = stops[0][1]
    cr.elements[1].position = stops[-1][0]
    cr.elements[1].color = stops[-1][1]
    for pos, col in stops[1:-1]:
        e = cr.elements.new(pos)
        e.color = col
    return r


def mix_rgb(nt, fac, a, b, blend="MIX"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    socks_a = [s for s in m.inputs if s.name == "A" and s.type == "RGBA"]
    socks_b = [s for s in m.inputs if s.name == "B" and s.type == "RGBA"]
    if isinstance(fac, (int, float)):
        m.inputs[0].default_value = fac
    else:
        nt.links.new(fac, m.inputs[0])
    for sock, src in ((socks_a[0], a), (socks_b[0], b)):
        if isinstance(src, tuple):
            sock.default_value = src
        else:
            nt.links.new(src, sock)
    out = [o for o in m.outputs if o.type == "RGBA"][0]
    return out


def math_node(nt, op, a, b=None, c=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, src in enumerate((a, b, c)):
        if src is None:
            continue
        if isinstance(src, (int, float)):
            n.inputs[i].default_value = src
        else:
            nt.links.new(src, n.inputs[i])
    return n.outputs[0]


def coords(nt, space="object", rand_offset=True):
    """Texture coordinate in metres. 'object' (local, unscaled meshes) or 'world'."""
    if space == "world":
        g = nt.nodes.new("ShaderNodeNewGeometry")
        v = g.outputs["Position"]
    else:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        v = tc.outputs["Object"]
    if rand_offset:
        oi = nt.nodes.new("ShaderNodeObjectInfo")
        comb = nt.nodes.new("ShaderNodeCombineXYZ")
        for i, k in enumerate((13.17, 7.71, 3.33)):
            nt.links.new(math_node(nt, "MULTIPLY", oi.outputs["Random"], k), comb.inputs[i])
        add = nt.nodes.new("ShaderNodeVectorMath")
        add.operation = "ADD"
        nt.links.new(v, add.inputs[0])
        nt.links.new(comb.outputs[0], add.inputs[1])
        v = add.outputs[0]
    return v


def mapping(nt, vec, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    mp = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(vec, mp.inputs["Vector"])
    mp.inputs["Location"].default_value = loc
    mp.inputs["Rotation"].default_value = rot
    mp.inputs["Scale"].default_value = scale
    return mp.outputs["Vector"]


def noise(nt, vec, scale=1.0, detail=4.0, rough=0.5, distortion=0.0):
    n = nt.nodes.new("ShaderNodeTexNoise")
    try:
        n.noise_dimensions = "3D"
    except Exception:
        pass
    nt.links.new(vec, n.inputs["Vector"])
    si(n, "Scale", scale)
    si(n, "Detail", detail)
    si(n, "Roughness", rough)
    si(n, "Distortion", distortion)
    return n.outputs["Fac"]


def bump(nt, height, strength=0.1, distance=0.001, normal=None):
    b = nt.nodes.new("ShaderNodeBump")
    si(b, "Strength", strength)
    si(b, "Distance", distance)
    nt.links.new(height, b.inputs["Height"])
    if normal is not None:
        nt.links.new(normal, b.inputs["Normal"])
    return b.outputs["Normal"]


# --------------------------------------------------------------------------- materials
MATS = {}


def mat_plain(name, hexcol, rough=0.6, metallic=0.0, coat=0.0, spec=0.5, orange_peel=0.0,
              emission=None, emission_strength=0.0):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    si(b, "Base Color", lin(hexcol) if isinstance(hexcol, str) else hexcol)
    si(b, "Roughness", rough)
    si(b, "Metallic", metallic)
    si(b, "Specular IOR Level", spec)
    if coat:
        si(b, "Coat Weight", coat)
        si(b, "Coat Roughness", 0.25)
    if orange_peel:
        h = noise(nt, coords(nt, "object", False), scale=260.0, detail=2.0)
        nt.links.new(bump(nt, h, strength=orange_peel, distance=0.0004), b.inputs["Normal"])
    if emission:
        si(b, "Emission Color", lin(emission))
        si(b, "Emission Strength", emission_strength)
    MATS[name] = m
    return m


def mat_wood(name, light, mid, dark, grain="Z", ring_scale=22.0, distortion=18.0, rough=0.48,
             coat=0.0, pore_depth=0.3, figure=0.18, space=None, spacing=0.0055, cathedral=False):
    """Procedural veneer built from first principles:
    distance to a (virtual) log axis -> irregular growth rings (fine dark latewood lines),
    broad tonal bands, fibre streaks and elongated pores. grain='Z' vertical, 'X' along local X.
    ring_scale and distortion are kept for API compatibility and scale the warp amplitude."""
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    space = space or ("world" if grain == "Z" else "object")
    v0 = coords(nt, space, rand_offset=False)
    if space == "object":
        # small random slide along/across the grain only (keeps cathedral axes close to the face)
        oi = nt.nodes.new("ShaderNodeObjectInfo")
        cmb = nt.nodes.new("ShaderNodeCombineXYZ")
        if grain == "Z":
            nt.links.new(math_node(nt, "MULTIPLY", oi.outputs["Random"], 0.37), cmb.inputs[0])
            nt.links.new(math_node(nt, "MULTIPLY", oi.outputs["Random"], 5.3), cmb.inputs[2])
        else:
            nt.links.new(math_node(nt, "MULTIPLY", oi.outputs["Random"], 5.3), cmb.inputs[0])
            nt.links.new(math_node(nt, "MULTIPLY", oi.outputs["Random"], 0.37), cmb.inputs[1])
        add = nt.nodes.new("ShaderNodeVectorMath")
        add.operation = "ADD"
        nt.links.new(v0, add.inputs[0])
        nt.links.new(cmb.outputs[0], add.inputs[1])
        v = add.outputs[0]
    else:
        v = v0
    # log axis: far away for straight (rift-like) grain, close and tilted for cathedrals
    if grain == "Z":
        q = mapping(nt, v, loc=(3.3, 6.1 if not cathedral else 0.09, 0.0),
                    rot=(0.03 if cathedral else 0.0, 0.0, 0.0))
        warp_scale = (24.0, 24.0, 0.7)
        sep_axes = (0, 1)
        fib_scale = (210.0, 210.0, 1.4)
        pore_scale = (760.0, 760.0, 9.0)
    else:
        q = mapping(nt, v, loc=(0.0, 0.09 if cathedral else 5.7, 0.47),
                    rot=(0.0, 0.03 if cathedral else 0.0, 0.0))
        warp_scale = (0.7, 24.0, 24.0)
        sep_axes = (1, 2)
        fib_scale = (1.4, 210.0, 210.0)
        pore_scale = (9.0, 760.0, 760.0)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(q, sep.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs[sep_axes[0]], comb.inputs[0])
    nt.links.new(sep.outputs[sep_axes[1]], comb.inputs[1])
    ln = nt.nodes.new("ShaderNodeVectorMath")
    ln.operation = "LENGTH"
    nt.links.new(comb.outputs[0], ln.inputs[0])
    r = ln.outputs["Value"]
    # irregular spacing: low-frequency warp, stretched along the grain
    amp = 0.0016 * distortion
    w1 = noise(nt, mapping(nt, v, scale=warp_scale), scale=1.0, detail=4.0, rough=0.6)
    lowf = tuple(c * 0.12 for c in warp_scale)
    w2 = noise(nt, mapping(nt, v, scale=lowf), scale=1.0, detail=2.0)
    warp = math_node(nt, "ADD", math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", w1, 0.5), amp * 2.0),
                     math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", w2, 0.5), amp * 5.0))
    rw = math_node(nt, "ADD", r, warp)
    f1 = math.tau / spacing
    s1 = math_node(nt, "SINE", math_node(nt, "MULTIPLY", rw, f1))
    lines = math_node(nt, "POWER", math_node(nt, "MULTIPLY_ADD", s1, 0.5, 0.5), 7.0)  # thin peaks
    # second, finer family of lines (gives the veneer its density)
    s1b = math_node(nt, "SINE", math_node(nt, "MULTIPLY", rw, f1 * 2.37))
    lines_b = math_node(nt, "POWER", math_node(nt, "MULTIPLY_ADD", s1b, 0.5, 0.5), 10.0)
    # broad tonal bands
    s2 = math_node(nt, "SINE", math_node(nt, "MULTIPLY", rw, math.tau / (spacing * 7.3)))
    band = math_node(nt, "MULTIPLY_ADD", s2, 0.5, 0.5)
    base = mix_rgb(nt, math_node(nt, "MULTIPLY", band, 0.7), lin(light), lin(mid), "MIX")
    darkc = lin(dark)
    fade = noise(nt, mapping(nt, v, scale=tuple(c * 1.7 for c in warp_scale)), scale=1.0, detail=2.0)
    fade = math_node(nt, "MULTIPLY_ADD", fade, 1.1, -0.15)
    lw = math_node(nt, "MULTIPLY", lines, fade)
    c1 = mix_rgb(nt, math_node(nt, "MULTIPLY", lw, 0.7), base, darkc, "MIX")
    c2 = mix_rgb(nt, math_node(nt, "MULTIPLY", lines_b, 0.28), c1, darkc, "MIX")
    # fibre streaks
    fib = noise(nt, mapping(nt, v, scale=fib_scale), scale=1.0, detail=3.0, rough=0.6)
    fibr = ramp(nt, [(0.3, (0.93, 0.93, 0.93, 1)), (0.7, (1.04, 1.04, 1.04, 1))])
    nt.links.new(fib, fibr.inputs["Fac"])
    c3 = mix_rgb(nt, 1.0, c2, fibr.outputs["Color"], "MULTIPLY")
    # slow figure drift
    drift = noise(nt, mapping(nt, v, scale=tuple(c * 0.9 for c in warp_scale)), scale=1.0, detail=2.0)
    c4 = mix_rgb(nt, math_node(nt, "MULTIPLY", drift, figure), c3, (0.62, 0.5, 0.38, 1.0), "MULTIPLY")
    # pores
    pn = noise(nt, mapping(nt, v, scale=pore_scale), scale=1.0, detail=1.0)
    pore = ramp(nt, [(0.0, (0, 0, 0, 1)), (0.69, (0, 0, 0, 1)), (0.75, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    nt.links.new(pn, pore.inputs["Fac"])
    pf = pore.outputs["Color"]
    c5 = mix_rgb(nt, math_node(nt, "MULTIPLY", pf, pore_depth), c4, scale_col(darkc, 0.7), "MIX")
    nt.links.new(c5, b.inputs["Base Color"])
    nt.links.new(math_node(nt, "ADD", math_node(nt, "MULTIPLY", pf, 0.1), rough), b.inputs["Roughness"])
    h = math_node(nt, "SUBTRACT", math_node(nt, "MULTIPLY", lines, 0.25), pf)
    nt.links.new(bump(nt, h, strength=0.1, distance=0.0005), b.inputs["Normal"])
    if coat:
        si(b, "Coat Weight", coat)
        si(b, "Coat Roughness", 0.32)
    MATS[name] = m
    return m


def mat_marble(name, base, vein, soft, scale=0.85, distortion=11.0, rough=0.12, rot=(0.3, 0.5, 0.65),
               cloud=0.35, secondary=0.45, bands=False):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    v = coords(nt, "object", True)
    v1 = mapping(nt, v, rot=rot, scale=(scale, scale, scale))
    w = nt.nodes.new("ShaderNodeTexWave")
    w.wave_type = "BANDS"
    w.bands_direction = "X"
    w.wave_profile = "SIN"
    nt.links.new(v1, w.inputs["Vector"])
    si(w, "Scale", 1.0)
    si(w, "Distortion", distortion)
    si(w, "Detail", 12.0)
    si(w, "Detail Scale", 1.7)
    si(w, "Detail Roughness", 0.64)
    if bands:  # travertine: soft parallel bands, few veins
        col = ramp(nt, [(0.0, lin(soft)), (0.35, lin(base)), (0.7, lin(vein)), (1.0, lin(base))])
    else:
        col = ramp(nt, [(0.0, lin(vein)), (0.022, lin(soft)), (0.07, lin(base)), (1.0, lin(base))])
    nt.links.new(w.outputs["Fac"], col.inputs["Fac"])
    c = col.outputs["Color"]
    # secondary hairline veins
    w2 = nt.nodes.new("ShaderNodeTexWave")
    w2.wave_type = "BANDS"
    w2.bands_direction = "Z"
    nt.links.new(mapping(nt, v, rot=(1.1, 0.2, 2.0), scale=(scale * 2.6,) * 3), w2.inputs["Vector"])
    si(w2, "Scale", 1.0)
    si(w2, "Distortion", distortion * 1.4)
    si(w2, "Detail", 10.0)
    si(w2, "Detail Scale", 2.2)
    col2 = ramp(nt, [(0.0, lin(soft)), (0.012, lin(base)), (1.0, lin(base))])
    nt.links.new(w2.outputs["Fac"], col2.inputs["Fac"])
    c = mix_rgb(nt, secondary, c, col2.outputs["Color"], "MULTIPLY") if not bands else c
    # cloudiness
    n = noise(nt, mapping(nt, v, scale=(2.4, 2.4, 2.4)), scale=1.0, detail=8.0, rough=0.6)
    cl = ramp(nt, [(0.25, (0.9, 0.9, 0.9, 1)), (0.75, (1.06, 1.06, 1.06, 1))])
    nt.links.new(n, cl.inputs["Fac"])
    c = mix_rgb(nt, cloud, c, cl.outputs["Color"], "MULTIPLY")
    nt.links.new(c, b.inputs["Base Color"])
    si(b, "Roughness", rough)
    if bands:
        pits = noise(nt, mapping(nt, v, scale=(40, 160, 160)), scale=1.0, detail=2.0)
        pr = ramp(nt, [(0.0, (0, 0, 0, 1)), (0.66, (0, 0, 0, 1)), (0.72, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
        nt.links.new(pits, pr.inputs["Fac"])
        nt.links.new(bump(nt, math_node(nt, "MULTIPLY", pr.outputs["Color"], -1.0), 0.2, 0.0008),
                     b.inputs["Normal"])
    MATS[name] = m
    return m


def mat_tiles(name, c1, c2, grout, w, h, plane="XZ", offset=0.0, rough=0.18, mortar=0.002,
              wobble=0.0, glaze=0.0):
    """Tiles via Brick texture in world space. plane: XZ (back wall), YZ (side wall), XY (floor)."""
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    g = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(g.outputs["Position"], sep.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    a_i, b_i = {"XZ": (0, 2), "YZ": (1, 2), "XY": (0, 1)}[plane]
    nt.links.new(sep.outputs[a_i], comb.inputs[0])
    nt.links.new(sep.outputs[b_i], comb.inputs[1])
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = offset
    br.offset_frequency = 2
    br.squash = 1.0
    br.squash_frequency = 1
    nt.links.new(comb.outputs[0], br.inputs["Vector"])
    si(br, "Color1", lin(c1))
    si(br, "Color2", lin(c2))
    si(br, "Mortar", lin(grout))
    si(br, "Scale", 1.0)
    si(br, "Mortar Size", mortar)
    si(br, "Mortar Smooth", 0.25)
    si(br, "Bias", 0.0)
    si(br, "Brick Width", w)
    si(br, "Row Height", h)
    col = br.outputs["Color"]
    if wobble:
        n = noise(nt, g.outputs["Position"], scale=9.0, detail=3.0)
        nr = ramp(nt, [(0.3, (0.94, 0.94, 0.94, 1)), (0.7, (1.04, 1.04, 1.04, 1))])
        nt.links.new(n, nr.inputs["Fac"])
        col = mix_rgb(nt, wobble, col, nr.outputs["Color"], "MULTIPLY")
    nt.links.new(col, b.inputs["Base Color"])
    rough_n = math_node(nt, "ADD", math_node(nt, "MULTIPLY", br.outputs["Fac"], 0.6), rough)
    nt.links.new(rough_n, b.inputs["Roughness"])
    height = math_node(nt, "MULTIPLY", br.outputs["Fac"], -1.0)
    if glaze:
        n2 = noise(nt, g.outputs["Position"], scale=38.0, detail=3.0)
        height = math_node(nt, "ADD", height, math_node(nt, "MULTIPLY", n2, glaze))
    nt.links.new(bump(nt, height, strength=0.35, distance=0.002), b.inputs["Normal"])
    if glaze:
        si(b, "Coat Weight", 0.3)
        si(b, "Coat Roughness", 0.08)
    MATS[name] = m
    return m


def mat_terrazzo(name):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    g = nt.nodes.new("ShaderNodeNewGeometry")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    nt.links.new(g.outputs["Position"], vor.inputs["Vector"])
    si(vor, "Scale", 70.0)
    si(vor, "Randomness", 1.0)
    chip = ramp(nt, [(0.0, lin("#8C8378")), (0.25, lin("#BDB2A3")), (0.5, lin("#5E574F")),
                     (0.75, lin("#D8D0C3")), (1.0, lin("#A2876B"))], interp="CONSTANT")
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(vor.outputs["Color"], sep.inputs[0])
    nt.links.new(sep.outputs[0], chip.inputs["Fac"])
    vor2 = nt.nodes.new("ShaderNodeTexVoronoi")
    vor2.feature = "DISTANCE_TO_EDGE"
    nt.links.new(g.outputs["Position"], vor2.inputs["Vector"])
    si(vor2, "Scale", 70.0)
    edge = ramp(nt, [(0.0, (1, 1, 1, 1)), (0.06, (1, 1, 1, 1)), (0.09, (0, 0, 0, 1)), (1.0, (0, 0, 0, 1))])
    nt.links.new(vor2.outputs["Distance"], edge.inputs["Fac"])
    matrix = lin("#CFC6B8")
    c = mix_rgb(nt, edge.outputs["Color"], chip.outputs["Color"], matrix, "MIX")
    # 20x20 tile grid with worn grout
    sepx = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(g.outputs["Position"], sepx.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sepx.outputs[0], comb.inputs[0])
    nt.links.new(sepx.outputs[1], comb.inputs[1])
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.0
    nt.links.new(comb.outputs[0], br.inputs["Vector"])
    si(br, "Scale", 1.0)
    si(br, "Brick Width", 0.2)
    si(br, "Row Height", 0.2)
    si(br, "Mortar Size", 0.0016)
    si(br, "Color1", (1, 1, 1, 1))
    si(br, "Color2", (0.93, 0.92, 0.9, 1))
    si(br, "Mortar", lin("#6F665C"))
    c = mix_rgb(nt, 1.0, c, br.outputs["Color"], "MULTIPLY")
    dirt = noise(nt, g.outputs["Position"], scale=3.0, detail=6.0)
    dr = ramp(nt, [(0.35, (0.86, 0.84, 0.8, 1)), (0.7, (1.0, 1.0, 1.0, 1))])
    nt.links.new(dirt, dr.inputs["Fac"])
    c = mix_rgb(nt, 1.0, c, dr.outputs["Color"], "MULTIPLY")
    nt.links.new(c, b.inputs["Base Color"])
    si(b, "Roughness", 0.42)
    nt.links.new(bump(nt, math_node(nt, "MULTIPLY", br.outputs["Fac"], -1.0), 0.3, 0.001), b.inputs["Normal"])
    MATS[name] = m
    return m


def mat_concrete(name, base="#9A958E", rough=0.88, stains=0.35):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    g = nt.nodes.new("ShaderNodeNewGeometry")
    n1 = noise(nt, g.outputs["Position"], scale=2.2, detail=9.0, rough=0.62)
    c1 = ramp(nt, [(0.3, scale_col(lin(base), 0.82)), (0.5, lin(base)), (0.72, scale_col(lin(base), 1.12))])
    nt.links.new(n1, c1.inputs["Fac"])
    n2 = noise(nt, g.outputs["Position"], scale=130.0, detail=2.0)
    spk = ramp(nt, [(0.0, (0.7, 0.7, 0.7, 1)), (0.25, (1, 1, 1, 1)), (1.0, (1, 1, 1, 1))])
    nt.links.new(n2, spk.inputs["Fac"])
    c = mix_rgb(nt, 1.0, c1.outputs["Color"], spk.outputs["Color"], "MULTIPLY")
    n3 = noise(nt, mapping(nt, g.outputs["Position"], scale=(0.6, 0.6, 0.6)), scale=1.0, detail=4.0)
    st = ramp(nt, [(0.45, (1, 1, 1, 1)), (0.7, (0.8, 0.78, 0.74, 1))])
    nt.links.new(n3, st.inputs["Fac"])
    c = mix_rgb(nt, stains, c, st.outputs["Color"], "MULTIPLY")
    nt.links.new(c, b.inputs["Base Color"])
    si(b, "Roughness", rough)
    nt.links.new(bump(nt, n2, 0.15, 0.001), b.inputs["Normal"])
    MATS[name] = m
    return m


def mat_plaster(name, base="#EDE9E2", rough=0.92, patchy=0.0, bump_s=0.05):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    g = nt.nodes.new("ShaderNodeNewGeometry")
    n = noise(nt, g.outputs["Position"], scale=6.0, detail=6.0)
    c = ramp(nt, [(0.35, scale_col(lin(base), 0.975)), (0.65, lin(base))])
    nt.links.new(n, c.inputs["Fac"])
    col = c.outputs["Color"]
    if patchy:
        n2 = noise(nt, g.outputs["Position"], scale=1.3, detail=5.0, rough=0.7)
        p = ramp(nt, [(0.0, lin("#B9B2A6")), (0.42, lin("#C9C2B6")), (0.5, lin(base)), (0.62, lin("#D9D4CB")),
                      (1.0, lin("#A9A398"))])
        nt.links.new(n2, p.inputs["Fac"])
        col = mix_rgb(nt, patchy, col, p.outputs["Color"], "MIX")
    nt.links.new(col, b.inputs["Base Color"])
    si(b, "Roughness", rough)
    n3 = noise(nt, g.outputs["Position"], scale=60.0, detail=3.0)
    nt.links.new(bump(nt, n3, bump_s, 0.001), b.inputs["Normal"])
    MATS[name] = m
    return m


def mat_metal(name, hexcol, rough=0.28, aniso=0.0, brushed=True):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    si(b, "Base Color", lin(hexcol))
    si(b, "Metallic", 1.0)
    if brushed:
        v = coords(nt, "object", True)
        n = noise(nt, mapping(nt, v, scale=(600, 4, 600)), scale=1.0, detail=2.0)
        r = math_node(nt, "ADD", math_node(nt, "MULTIPLY", n, 0.12), rough - 0.06)
        nt.links.new(r, b.inputs["Roughness"])
    else:
        si(b, "Roughness", rough)
    if aniso:
        si(b, "Anisotropic", aniso)
    MATS[name] = m
    return m


def mat_emit(name, hexcol, strength):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    si(b, "Base Color", lin(hexcol))
    si(b, "Emission Color", lin(hexcol))
    si(b, "Emission Strength", strength)
    si(b, "Roughness", 0.5)
    MATS[name] = m
    return m


def mat_glass(name, hexcol="#FFFFFF", rough=0.02):
    if name in MATS:
        return MATS[name]
    m, nt, b = new_mat(name)
    si(b, "Base Color", lin(hexcol))
    si(b, "Transmission Weight", 1.0)
    si(b, "Roughness", rough)
    si(b, "IOR", 1.45)
    MATS[name] = m
    return m


# --------------------------------------------------------------------------- geometry
CUBE_FACES = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]


def _link(ob, parent=None):
    if parent is not None:
        ob.parent = parent
    COLL.objects.link(ob)
    return ob


def box(name, x0, x1, y0, y1, z0, z1, mat, parent=None, bevel=0.0, segs=2):
    sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    verts = [(x * sx / 2, y * sy / 2, z * sz / 2) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], CUBE_FACES)
    me.update()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    ob.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    _link(ob, parent)
    if bevel > 0:
        md = ob.modifiers.new("bevel", "BEVEL")
        md.width = min(bevel, sx / 2.2, sy / 2.2, sz / 2.2)
        md.segments = segs
        md.limit_method = "NONE"
    return ob


def frustum(name, bx, by, tx, ty, z0, z1, mat, parent=None, cx=0.0, cy=0.0, top_dy=0.0):
    """Tapered box (canopy hood). bottom size (bx,by), top size (tx,ty)."""
    v = [(cx - bx / 2, cy - by / 2, z0), (cx + bx / 2, cy - by / 2, z0), (cx + bx / 2, cy + by / 2, z0),
         (cx - bx / 2, cy + by / 2, z0),
         (cx - tx / 2, cy + top_dy - ty / 2, z1), (cx + tx / 2, cy + top_dy - ty / 2, z1),
         (cx + tx / 2, cy + top_dy + ty / 2, z1), (cx - tx / 2, cy + top_dy + ty / 2, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.update()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    _link(ob, parent)
    md = ob.modifiers.new("bevel", "BEVEL")
    md.width = 0.004
    md.segments = 2
    return ob


def cyl(name, r, h, loc, rot=(0, 0, 0), mat=None, parent=None, verts=32, scale=(1, 1, 1), smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    ob.location = loc
    ob.rotation_euler = rot
    ob.scale = scale
    if mat:
        ob.data.materials.append(mat)
    if parent is not None:
        ob.parent = parent
    return ob


def sphere(name, r, loc, mat, parent=None, scale=(1, 1, 1), segs=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=r, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.location = loc
    ob.scale = scale
    ob.data.materials.append(mat)
    if parent is not None:
        ob.parent = parent
    return ob


def torus(name, R, r, loc, mat, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=48, minor_segments=8,
                                     location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(mat)
    if parent is not None:
        ob.parent = parent
    return ob


def empty(name, loc=(0, 0, 0), rot_z=0.0, parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.rotation_euler = (0, 0, rot_z)
    _link(e, parent)
    return e


def boolean_cut(target, cutter):
    bev = target.modifiers.get("bevel")
    width = segs = None
    if bev is not None:
        width, segs = bev.width, bev.segments
        target.modifiers.remove(bev)
    md = target.modifiers.new("cut", "BOOLEAN")
    md.operation = "DIFFERENCE"
    md.object = cutter
    try:
        md.solver = "EXACT"
    except Exception:
        pass
    cutter.hide_render = True
    cutter.hide_viewport = False
    cutter.display_type = "WIRE"
    if width:
        b2 = target.modifiers.new("bevel", "BEVEL")
        b2.width = width
        b2.segments = segs
        b2.limit_method = "ANGLE"


# --------------------------------------------------------------------------- dimensions (metres)
PLINTH = 0.13
BASE_TOP = 0.86          # carcass top
CT = 0.04                # countertop thickness
COUNTER = BASE_TOP + CT  # 0.90 working height
BASE_D = 0.56            # carcass depth
FRONT_T = 0.019
WALL_Z0, WALL_Z1 = 1.53, 2.33
WALL_D = 0.35
TALL_Z1 = 2.33
GAP = 0.0015             # half-gap between fronts (3 mm joints)


# --------------------------------------------------------------------------- styles
def style_defs(style):
    S = {}
    oak_v = lambda n="oak_v": mat_wood(n, "#CFA371", "#B98C5B", "#8C6239", grain="Z", distortion=5.0, rough=0.5)
    oak_h = lambda n="oak_h": mat_wood(n, "#CFA371", "#B98C5B", "#8C6239", grain="X", distortion=5.0, rough=0.5)
    pale_v = lambda: mat_wood("pale_oak_v", "#E0C39A", "#CFAF84", "#A8835A", grain="Z", distortion=4.0,
                              rough=0.5, figure=0.1)
    pale_h = lambda: mat_wood("pale_oak_h", "#E0C39A", "#CFAF84", "#A8835A", grain="X", distortion=4.0,
                              rough=0.5, figure=0.1)
    walnut_v = lambda: mat_wood("walnut_v", "#7C5436", "#62412A", "#38241A", grain="Z", distortion=7.0,
                                rough=0.42, coat=0.15, figure=0.25, spacing=0.007)
    walnut_h = lambda: mat_wood("walnut_h", "#7C5436", "#62412A", "#38241A", grain="X", distortion=7.0,
                                rough=0.42, coat=0.15, figure=0.25, spacing=0.007)
    carcass = mat_plain("carcass", "#E9E6E0", rough=0.6)
    S["carcass"] = carcass
    S["plinth"] = mat_plain("plinth", "#2B2A28", rough=0.7)
    S["inner_dark"] = mat_plain("inner_dark", "#1A1918", rough=0.8)
    S["steel"] = mat_metal("steel", "#C9CBCC", rough=0.3, aniso=0.5)
    S["black_glass"] = mat_plain("black_glass", "#0B0B0C", rough=0.04, spec=0.6)
    S["ceramic_white"] = mat_plain("ceramic_white", "#F1EFEA", rough=0.12, coat=0.4)
    S["cornice"] = False
    S["frame"] = False
    S["fluted"] = False
    S["open_shelf"] = False
    S["hood"] = "hidden"
    S["led"] = True
    S["pendant"] = "cylinder"
    S["splash"] = "slab"
    S["wall_units"] = True
    S["tall_mat"] = None

    if style == "modern":
        S["front"] = mat_plain("lacq_bone_grey", "#C8C1B5", rough=0.56, orange_peel=0.01)
        S["tall_mat"] = oak_v()
        S["wall_mat"] = S["front"]
        S["island_mat"] = oak_v()
        S["counter"] = mat_marble("stone_honed", "#D9D6D0", "#B4AFA7", "#C9C5BE", scale=0.6, distortion=6,
                                  rough=0.36, secondary=0.2, cloud=0.5)
        S["splash_mat"] = S["counter"]
        S["handle"] = "channel"
        S["handle_mat"] = mat_metal("bronze_dark", "#3B342C", rough=0.35)
        S["tap"] = mat_plain("tap_black", "#1B1B1B", rough=0.45, metallic=0.2)
        S["sink"] = S["steel"]
        S["walls"] = mat_plaster("wall_paint_modern", "#E4DFD6")
        S["pendant_mat"] = mat_plain("pendant_black", "#1C1C1C", rough=0.5)
        S["shelf_mat"] = oak_h()
        S["oak_h"] = oak_h()
    elif style == "classic":
        S["front"] = mat_plain("lacq_sage", "#C3C3AE", rough=0.42, orange_peel=0.012)
        S["wall_mat"] = S["front"]
        S["tall_mat"] = S["front"]
        S["island_mat"] = S["front"]
        S["counter"] = mat_marble("marble_white", "#F0EDE8", "#7F7B76", "#B9B4AD", scale=0.9, distortion=12,
                                  rough=0.1)
        S["splash"] = "tiles"
        S["splash_mat"] = mat_tiles("zellige_cream", "#EDE6D8", "#E3D9C6", "#CFC6B6", 0.15, 0.075,
                                    plane="XZ", offset=0.5, rough=0.08, mortar=0.0016, wobble=0.6, glaze=0.6)
        S["splash_mat_yz"] = mat_tiles("zellige_cream_yz", "#EDE6D8", "#E3D9C6", "#CFC6B6", 0.15, 0.075,
                                       plane="YZ", offset=0.5, rough=0.08, mortar=0.0016, wobble=0.6, glaze=0.6)
        S["handle"] = "knob"
        S["handle_mat"] = mat_metal("brass", "#B48A4F", rough=0.3)
        S["tap"] = S["handle_mat"]
        S["sink"] = S["ceramic_white"]
        S["walls"] = mat_plaster("wall_paint_classic", "#EDE7DC")
        S["cornice"] = True
        S["frame"] = True
        S["open_shelf"] = True
        S["hood"] = "canopy"
        S["pendant"] = "dome"
        S["pendant_mat"] = S["handle_mat"]
        S["shelf_mat"] = oak_h()
        S["oak_h"] = oak_h()
    elif style == "dark":
        S["front"] = mat_plain("lacq_graphite", "#252423", rough=0.5, orange_peel=0.01)
        S["tall_mat"] = walnut_v()
        S["wall_mat"] = S["front"]
        S["island_mat"] = walnut_v()
        S["counter"] = mat_marble("marble_nero", "#1C1B1A", "#A9A297", "#4A4642", scale=0.55, distortion=7,
                                  rough=0.14, secondary=0.25, cloud=0.3)
        S["splash_mat"] = S["counter"]
        S["handle"] = "edge"
        S["handle_mat"] = mat_metal("brass", "#B48A4F", rough=0.3)
        S["tap"] = S["handle_mat"]
        S["sink"] = mat_plain("granite_black", "#1D1D1D", rough=0.35)
        S["walls"] = mat_plaster("wall_paint_dark", "#8F877E")
        S["wall_units"] = False
        S["open_shelf"] = True
        S["pendant"] = "slim"
        S["pendant_mat"] = S["handle_mat"]
        S["shelf_mat"] = walnut_h()
        S["oak_h"] = walnut_h()
    elif style == "light":
        S["front"] = mat_plain("lacq_bone", "#F0ECE5", rough=0.45, orange_peel=0.01)
        S["tall_mat"] = S["front"]
        S["wall_mat"] = S["front"]
        S["island_mat"] = pale_v()
        S["counter"] = mat_marble("quartz_white", "#F3F1EC", "#C9C3B9", "#E0DBD2", scale=0.7, distortion=9,
                                  rough=0.16, secondary=0.25, cloud=0.3)
        S["splash"] = "tiles"
        S["splash_mat"] = mat_tiles("stack_white", "#F4F2ED", "#ECE9E2", "#DCD7CE", 0.075, 0.3, plane="XZ",
                                    offset=0.0, rough=0.1, mortar=0.0014, wobble=0.3, glaze=0.25)
        S["splash_mat_yz"] = mat_tiles("stack_white_yz", "#F4F2ED", "#ECE9E2", "#DCD7CE", 0.075, 0.3,
                                       plane="YZ", offset=0.0, rough=0.1, mortar=0.0014, wobble=0.3, glaze=0.25)
        S["handle"] = "bar"
        S["handle_mat"] = mat_metal("steel_pale", "#CFCBC3", rough=0.3)
        S["tap"] = S["handle_mat"]
        S["sink"] = S["steel"]
        S["walls"] = mat_plaster("wall_paint_light", "#F1EEE9")
        S["open_shelf"] = True
        S["pendant"] = "cylinder_white"
        S["pendant_mat"] = mat_plain("pendant_bone", "#EFEBE4", rough=0.6)
        S["shelf_mat"] = pale_h()
        S["oak_h"] = pale_h()
    elif style == "specials":
        S["front"] = oak_v()
        S["tall_mat"] = mat_plain("lacq_olive", "#4D5B3A", rough=0.5, orange_peel=0.01)
        S["wall_mat"] = S["tall_mat"]
        S["island_mat"] = oak_v()
        S["counter"] = mat_marble("travertine", "#D8C8AF", "#CDBB9F", "#DFD1BB", scale=0.9, distortion=1.6,
                                  rough=0.4, rot=(0.0, 0.0, 0.03), bands=True, cloud=0.45)
        S["splash_mat"] = S["counter"]
        S["handle"] = "knob"
        S["handle_mat"] = mat_metal("brass", "#B48A4F", rough=0.3)
        S["tap"] = S["handle_mat"]
        S["sink"] = S["steel"]
        S["walls"] = mat_plaster("wall_paint_special", "#ECE6DC")
        S["fluted"] = True
        S["pendant"] = "globe"
        S["pendant_mat"] = mat_plain("linen", "#F4EFE6", rough=0.9)
        S["shelf_mat"] = oak_h()
        S["oak_h"] = oak_h()
    return S


# --------------------------------------------------------------------------- fronts and handles
def handle_for(S, parent, kind, x0, x1, z0, z1, y_front, is_drawer, hinge_left=True, tall=False):
    """Place a handle on a front spanning x0..x1, z0..z1 whose face is at y_front (local, negative)."""
    h = S["handle"]
    m = S["handle_mat"]
    cx = (x0 + x1) / 2
    w = x1 - x0
    if h == "channel":
        return  # handled at run level
    if h == "edge":
        L = min(0.22, w * 0.5)
        if is_drawer:
            box("edgepull", cx - L / 2, cx + L / 2, y_front - 0.022, y_front + 0.004, z1 - 0.004, z1 + 0.0,
                m, parent, bevel=0.0015)
        else:
            xe = x1 - 0.004 if hinge_left else x0 + 0.004
            zc = z1 - 0.12 if not tall else 1.05
            box("edgepull_v", xe - 0.004, xe + 0.004, y_front - 0.022, y_front, zc - 0.12, zc + 0.12, m, parent,
                bevel=0.0015)
        return
    if h == "bar":
        L = min(0.32, w - 0.12)
        if is_drawer:
            zc = z1 - 0.05 if (z1 - z0) > 0.2 else (z0 + z1) / 2
            cyl("bar", 0.0055, L, (cx, y_front - 0.032, zc), rot=(0, math.pi / 2, 0), mat=m, parent=parent,
                verts=16)
            for sx in (-1, 1):
                cyl("bar_post", 0.004, 0.03, (cx + sx * (L / 2 - 0.02), y_front - 0.016, zc),
                    rot=(math.pi / 2, 0, 0), mat=m, parent=parent, verts=12)
        else:
            xe = x1 - 0.05 if hinge_left else x0 + 0.05
            zc = (z0 + 0.25) if not tall else 1.05
            if z1 < 1.0 and not tall:
                zc = z1 - 0.2
            if z0 > 1.4:
                zc = z0 + 0.18
            Lv = 0.24
            cyl("bar_v", 0.0055, Lv, (xe, y_front - 0.032, zc), rot=(0, 0, 0), mat=m, parent=parent, verts=16)
            for sz in (-1, 1):
                cyl("bar_post", 0.004, 0.03, (xe, y_front - 0.016, zc + sz * (Lv / 2 - 0.02)),
                    rot=(math.pi / 2, 0, 0), mat=m, parent=parent, verts=12)
        return
    if h == "knob":
        if is_drawer:
            # cup pull on drawers
            zc = z1 - 0.06 if (z1 - z0) > 0.2 else (z0 + z1) / 2
            ob = cyl("cup", 0.032, 0.09, (cx, y_front - 0.012, zc), rot=(0, math.pi / 2, 0), mat=m,
                     parent=parent, verts=24, scale=(0.55, 1.0, 1.0))
            box("cup_base", cx - 0.05, cx + 0.05, y_front - 0.006, y_front, zc - 0.006, zc + 0.022, m, parent,
                bevel=0.002)
            _ = ob
        else:
            xe = x1 - 0.045 if hinge_left else x0 + 0.045
            zc = z1 - 0.07 if z1 < 1.2 else z0 + 0.07
            if tall:
                zc = 1.05
            cyl("knob_stem", 0.006, 0.022, (xe, y_front - 0.011, zc), rot=(math.pi / 2, 0, 0), mat=m,
                parent=parent, verts=16)
            sphere("knob", 0.016, (xe, y_front - 0.028, zc), m, parent, scale=(1, 0.7, 1))
        return
    if h == "old":
        # 1980s: dark wooden grip rail along the top edge
        za, zb = (z0, z0 + 0.035) if z0 > 1.4 else (z1 - 0.035, z1)
        box("grip", x0, x1, y_front - 0.024, y_front, za, zb, S["old_wood"], parent, bevel=0.004)
        return
    if h == "alu":
        L = min(0.4, w - 0.1)
        if is_drawer or z1 < 1.0:
            zc = z1 - 0.045
            box("alu", cx - L / 2, cx + L / 2, y_front - 0.028, y_front - 0.018, zc - 0.006, zc + 0.006, m,
                parent, bevel=0.002)
            for sx in (-1, 1):
                box("alu_post", cx + sx * (L / 2 - 0.02) - 0.004, cx + sx * (L / 2 - 0.02) + 0.004,
                    y_front - 0.02, y_front, zc - 0.004, zc + 0.004, m, parent)
        else:
            xe = x1 - 0.045 if hinge_left else x0 + 0.045
            zc = z0 + 0.12
            box("alu_v", xe - 0.006, xe + 0.006, y_front - 0.028, y_front - 0.018, zc - 0.13, zc + 0.13, m,
                parent, bevel=0.002)
        return


def front(S, parent, x0, x1, z0, z1, mat, y_back, is_drawer=False, hinge_left=True, tall=False,
          frame=None, fluted=None, handle=True):
    """One front panel (door or drawer) with 3 mm joints, optional frame or flutes, and its handle."""
    frame = S["frame"] if frame is None else frame
    fluted = S["fluted"] if fluted is None else fluted
    fx0, fx1, fz0, fz1 = x0 + GAP, x1 - GAP, z0 + GAP, z1 - GAP
    yf = y_back - FRONT_T
    if frame and (fx1 - fx0) > 0.18 and (fz1 - fz0) > 0.12:
        box("panel", fx0, fx1, yf + 0.006, y_back, fz0, fz1, mat, parent, bevel=0.001)
        rw = 0.062 if (fz1 - fz0) > 0.25 else 0.045
        t0 = yf
        t1 = yf + 0.008
        box("rail_l", fx0, fx0 + rw, t0, t1, fz0, fz1, mat, parent, bevel=0.0015)
        box("rail_r", fx1 - rw, fx1, t0, t1, fz0, fz1, mat, parent, bevel=0.0015)
        box("rail_b", fx0 + rw, fx1 - rw, t0, t1, fz0, fz0 + rw, mat, parent, bevel=0.0015)
        box("rail_t", fx0 + rw, fx1 - rw, t0, t1, fz1 - rw, fz1, mat, parent, bevel=0.0015)
        y_face = yf
    elif fluted:
        box("panel", fx0, fx1, yf + 0.004, y_back, fz0, fz1, mat, parent, bevel=0.001)
        pitch = 0.022
        n = max(2, int((fx1 - fx0) / pitch))
        pitch = (fx1 - fx0) / n
        for i in range(n):
            cx = fx0 + pitch * (i + 0.5)
            cyl("flute", pitch * 0.5, fz1 - fz0 - 0.002, (cx, yf + 0.004, (fz0 + fz1) / 2), mat=mat,
                parent=parent, verts=20, scale=(1.0, 0.38, 1.0))
        y_face = yf - 0.002
    else:
        box("front", fx0, fx1, yf, y_back, fz0, fz1, mat, parent, bevel=0.0012)
        y_face = yf
    if handle:
        handle_for(S, parent, "front", fx0, fx1, fz0, fz1, y_face, is_drawer, hinge_left, tall)


def drawer_stack(S, parent, x0, x1, z0, z1, mat, y_back, splits):
    """splits: list of fractions bottom->top."""
    total = sum(splits)
    z = z0
    for f in splits:
        h = (z1 - z0) * f / total
        front(S, parent, x0, x1, z, z + h, mat, y_back, is_drawer=True)
        z += h


def doors(S, parent, x0, x1, z0, z1, mat, y_back, tall=False):
    w = x1 - x0
    if w > 0.62:
        xm = (x0 + x1) / 2
        front(S, parent, x0, xm, z0, z1, mat, y_back, hinge_left=False, tall=tall)
        front(S, parent, xm, x1, z0, z1, mat, y_back, hinge_left=True, tall=tall)
    else:
        front(S, parent, x0, x1, z0, z1, mat, y_back, hinge_left=True, tall=tall)


# --------------------------------------------------------------------------- modules
def base_module(S, run, kind, s, w, fronts_mat=None):
    """Base unit. Local frame: x along run, front faces -y, back at y=0."""
    p = run["empty"]
    x0, x1 = s, s + w
    mat = fronts_mat or S["front"]
    box("carcass", x0 + 0.001, x1 - 0.001, -BASE_D, -0.0, PLINTH, BASE_TOP, S["carcass"], p)
    box("plinth", x0, x1, -BASE_D + 0.06, -0.02, 0.0, PLINTH - 0.002, S["plinth"], p)
    top = BASE_TOP if S["handle"] != "channel" else BASE_TOP - 0.035
    yb = -BASE_D
    if kind in ("drawers", "hob"):
        drawer_stack(S, p, x0, x1, PLINTH, top, mat, yb, [0.38, 0.38, 0.24] if kind == "drawers" else [0.5, 0.5])
    elif kind in ("sink", "door", "blind"):
        doors(S, p, x0, x1, PLINTH, top, mat, yb)
    elif kind == "dishwasher":
        front(S, p, x0, x1, PLINTH, top, mat, yb, is_drawer=True)
    elif kind == "filler":
        front(S, p, x0, x1, PLINTH, top, mat, yb, is_drawer=False, frame=False, fluted=False, handle=False)
    elif kind == "oven":
        front(S, p, x0, x1, PLINTH, PLINTH + 0.14, mat, yb, is_drawer=True)
        box("oven", x0 + 0.004, x1 - 0.004, yb - 0.02, yb, PLINTH + 0.145, top - 0.004, S["black_glass"], p,
            bevel=0.002)
        box("oven_bar", x0 + 0.06, x1 - 0.06, yb - 0.045, yb - 0.03, top - 0.06, top - 0.045, S["steel"], p,
            bevel=0.003)


def tall_module(S, run, kind, s, w):
    p = run["empty"]
    x0, x1 = s, s + w
    mat = S["tall_mat"] or S["front"]
    box("tall_carcass", x0 + 0.001, x1 - 0.001, -0.58, 0.0, PLINTH, TALL_Z1, S["carcass"], p)
    box("plinth", x0, x1, -0.52, -0.02, 0.0, PLINTH - 0.002, S["plinth"], p)
    yb = -0.58
    S = dict(S)
    S["fluted"] = False
    if kind == "fridge":
        front(S, p, x0, x1, PLINTH, 1.72, mat, yb, tall=True, hinge_left=True)
        front(S, p, x0, x1, 1.72, TALL_Z1, mat, yb, hinge_left=True)
    elif kind == "oven":
        front(S, p, x0, x1, PLINTH, 0.52, mat, yb, is_drawer=True)
        box("oven", x0 + 0.004, x1 - 0.004, yb - 0.02, yb, 0.522, 1.115, S["black_glass"], p, bevel=0.002)
        box("oven_bar", x0 + 0.06, x1 - 0.06, yb - 0.045, yb - 0.03, 1.06, 1.075, S["steel"], p, bevel=0.003)
        box("oven2", x0 + 0.004, x1 - 0.004, yb - 0.02, yb, 1.12, 1.565, S["black_glass"], p, bevel=0.002)
        box("oven2_bar", x0 + 0.06, x1 - 0.06, yb - 0.045, yb - 0.03, 1.51, 1.525, S["steel"], p, bevel=0.003)
        front(S, p, x0, x1, 1.57, TALL_Z1, mat, yb)
    elif kind == "pantry":
        doors(S, p, x0, x1, PLINTH, TALL_Z1, mat, yb, tall=True)
    if S["cornice"]:
        cornice(S, p, x0 - 0.0, x1 + 0.0, TALL_Z1, -0.58)


def cornice(S, p, x0, x1, z, y_front):
    m = S["front"]
    box("cornice1", x0, x1, y_front - 0.02, 0.0, z, z + 0.03, m, p, bevel=0.004)
    box("cornice2", x0, x1, y_front - 0.045, 0.0, z + 0.03, z + 0.07, m, p, bevel=0.006)


def wall_module(S, run, kind, s, w):
    p = run["empty"]
    x0, x1 = s, s + w
    if kind == "open":
        m = S["shelf_mat"]
        for zz in (1.62, 1.98):
            box("shelf", x0, x1, -0.26, 0.0, zz, zz + 0.035, m, p, bevel=0.002)
        shelf_dressing(S, p, x0, x1)
        return
    box("wall_carcass", x0 + 0.001, x1 - 0.001, -0.33, 0.0, WALL_Z0, WALL_Z1, S["carcass"], p)
    S = dict(S)
    S["fluted"] = False
    m = S["wall_mat"]
    z0 = WALL_Z0 - (0.02 if S["handle"] == "channel" else 0.0)
    doors(S, p, x0, x1, z0, WALL_Z1, m, -0.33)
    if S["led"]:
        box("led", x0 + 0.01, x1 - 0.01, -0.3, -0.28, WALL_Z0 - 0.008, WALL_Z0 - 0.001, S["led_mat"], p)
    if S["cornice"]:
        cornice(S, p, x0, x1, WALL_Z1, -0.33)


def shelf_dressing(S, p, x0, x1):
    plate = S["ceramic_white"]
    jar = mat_plain("jar_clay", "#C7B39A", rough=0.7)
    rnd = random.Random(int(x0 * 1000) + 3)
    x = x0 + 0.08
    while x < x1 - 0.12:
        r = rnd.random()
        if r < 0.35:
            for i in range(5):
                cyl("plate", 0.12, 0.012, (x + 0.1, -0.13, 1.655 + i * 0.013), mat=plate, parent=p, verts=40)
            x += 0.28
        elif r < 0.65:
            cyl("jar", 0.045, 0.14 + rnd.random() * 0.06, (x + 0.05, -0.12, 1.655 + 0.08), mat=jar,
                parent=p, verts=24)
            x += 0.13
        else:
            for i in range(3):
                cyl("bowl", 0.075 - i * 0.008, 0.045, (x + 0.08, -0.13, 2.015 + 0.025 + i * 0.046),
                    mat=plate, parent=p, verts=32)
            x += 0.22
    # upper shelf: books / ceramics
    x = x0 + 0.1
    while x < x1 - 0.15:
        if rnd.random() < 0.5:
            cyl("vessel", 0.06, 0.2, (x + 0.06, -0.12, 2.015 + 0.1), mat=jar, parent=p, verts=32)
            x += 0.2
        else:
            for i in range(4):
                c = ["#B5A58F", "#6F6656", "#D9CFBF", "#8C5E3C"][i % 4]
                box("book", x + i * 0.03, x + i * 0.03 + 0.026, -0.22, -0.04, 2.015, 2.015 + 0.22 - i * 0.012,
                    mat_plain("book" + c, c, rough=0.8), p)
            x += 0.2


def run_counter(S, run, s0, s1, depth=0.62, splash=True, splash_h=None, z_top=COUNTER, overhang_back=0.0,
                splash_range=None):
    p = run["empty"]
    ct = box("counter", s0, s1, -depth, overhang_back, z_top - CT, z_top, S["counter"], p, bevel=0.002, segs=3)
    run.setdefault("counter_spans", []).append((s0, s1, ct))
    if splash:
        a0, a1 = splash_range if splash_range else (s0, s1)
        h = splash_h if splash_h else (WALL_Z0 - z_top)
        # split around window cut-outs: (c0, c1, z_limit)
        segs_ = [(a0, a1, z_top + h)]
        for (c0, c1, zl) in run.get("splash_cuts", []):
            nxt = []
            for (x0, x1, zt) in segs_:
                if c1 <= x0 or c0 >= x1:
                    nxt.append((x0, x1, zt))
                    continue
                if c0 > x0:
                    nxt.append((x0, c0, zt))
                nxt.append((max(c0, x0), min(c1, x1), min(zt, zl)))
                if c1 < x1:
                    nxt.append((c1, x1, zt))
            segs_ = nxt
        for (x0, x1, zt) in segs_:
            if S["splash"] == "slab":
                box("splash", x0, x1, -0.012, 0.0, z_top, zt, S["splash_mat"], p, bevel=0.0015)
            else:
                sm = S["splash_mat"] if abs(math.sin(run["theta"])) < 0.5 else S.get("splash_mat_yz", S["splash_mat"])
                box("splash", x0, x1, -0.008, 0.0, z_top, zt, sm, p)
    return ct


def channel_run(S, run, s0, s1):
    if S["handle"] != "channel":
        return
    p = run["empty"]
    box("channel", s0, s1, -BASE_D + 0.025, -BASE_D + 0.05, BASE_TOP - 0.035, BASE_TOP, S["handle_mat"], p)


def sink(S, run, s, w, under_window=False):
    p = run["empty"]
    cx = s + w / 2
    bw, bd = min(0.72, w - 0.1), 0.42
    cy_ = -0.32
    ct = None
    for (c0, c1, obj) in run.get("counter_spans", []):
        if c0 - 1e-6 <= s and s + w <= c1 + 1e-6:
            ct = obj
    if ct is None:
        ct = run["counter_spans"][-1][2]
    cutter = box("sink_cut", cx - bw / 2, cx + bw / 2, cy_ - bd / 2, cy_ + bd / 2, COUNTER - 0.2, COUNTER + 0.05,
                 S["inner_dark"], p)
    boolean_cut(ct, cutter)
    m = S["sink"]
    zb = COUNTER - CT - 0.2
    box("sink_bottom", cx - bw / 2, cx + bw / 2, cy_ - bd / 2, cy_ + bd / 2, zb, zb + 0.01, m, p)
    zt = COUNTER - CT
    box("sink_wl", cx - bw / 2, cx - bw / 2 + 0.008, cy_ - bd / 2, cy_ + bd / 2, zb, zt, m, p)
    box("sink_wr", cx + bw / 2 - 0.008, cx + bw / 2, cy_ - bd / 2, cy_ + bd / 2, zb, zt, m, p)
    box("sink_wf", cx - bw / 2, cx + bw / 2, cy_ - bd / 2, cy_ - bd / 2 + 0.008, zb, zt, m, p)
    box("sink_wb", cx - bw / 2, cx + bw / 2, cy_ + bd / 2 - 0.008, cy_ + bd / 2, zb, zt, m, p)
    cyl("drain", 0.035, 0.004, (cx, cy_, zb + 0.012), mat=S["steel"], parent=p, verts=32)
    # tap
    t = S["tap"]
    tx, ty = cx, -0.07
    cyl("tap_base", 0.024, 0.02, (tx, ty, COUNTER + 0.01), mat=t, parent=p)
    cyl("tap_post", 0.014, 0.32, (tx, ty, COUNTER + 0.17), mat=t, parent=p)
    sphere("tap_joint", 0.0145, (tx, ty, COUNTER + 0.33), t, p)
    cyl("tap_spout", 0.0125, 0.21, (tx, ty - 0.105, COUNTER + 0.33), rot=(math.pi / 2, 0, 0), mat=t, parent=p)
    cyl("tap_tip", 0.0125, 0.05, (tx, ty - 0.21, COUNTER + 0.305), mat=t, parent=p)
    cyl("tap_lever", 0.006, 0.07, (tx + 0.03, ty, COUNTER + 0.22), rot=(0, math.pi / 2.4, 0), mat=t, parent=p)


def hob(S, run, s, w, gas=False):
    p = run["empty"]
    cx = s + w / 2
    if gas:
        box("hob_plate", cx - 0.3, cx + 0.3, -0.56, -0.06, COUNTER, COUNTER + 0.012, S["steel"], p, bevel=0.003)
        for dx, dy in ((-0.15, -0.18), (0.15, -0.18), (-0.15, -0.42), (0.15, -0.42)):
            cyl("burner", 0.045, 0.02, (cx + dx, dy, COUNTER + 0.02), mat=S["plinth"], parent=p)
            torus("grate", 0.09, 0.004, (cx + dx, dy, COUNTER + 0.035), S["plinth"], p)
        return
    box("hob", cx - min(0.39, w / 2 - 0.04), cx + min(0.39, w / 2 - 0.04), -0.58, -0.07, COUNTER, COUNTER + 0.006,
        S["black_glass"], p, bevel=0.002)
    ring = mat_plain("hob_ring", "#3A3A3B", rough=0.3)
    for dx, dy, r in ((-0.2, -0.2, 0.09), (0.2, -0.2, 0.075), (-0.2, -0.44, 0.075), (0.2, -0.44, 0.1)):
        if abs(dx) < w / 2 - 0.1:
            torus("hob_ring", r, 0.0018, (cx + dx, dy, COUNTER + 0.0062), ring, p)


def make_run(theta_deg, origin):
    th = theta_deg * D2R
    e = empty("run", (origin[0], origin[1], 0.0), th)
    return {"empty": e, "theta": th, "origin": origin}


def build_run(S, run, modules, counter=True, splash=True, wall=None, counter_extent=None, splash_h=None,
              splash_to=None):
    """modules: list of (kind, width). kinds: drawers, sink, hob, dishwasher, door, blind, filler, oven,
       tall_fridge, tall_oven, tall_pantry, gap."""
    s = 0.0
    spans = []
    for kind, w in modules:
        spans.append((kind, s, w))
        s += w
    # counter over base modules
    base_spans = [(k, s0, w) for k, s0, w in spans if not k.startswith("tall") and k != "gap"]
    if counter and base_spans:
        # group contiguous base spans
        groups = []
        for k, s0, w in base_spans:
            if groups and abs(groups[-1][1] - s0) < 1e-6:
                groups[-1][1] = s0 + w
            else:
                groups.append([s0, s0 + w])
        for g in groups:
            g0, g1 = g
            if counter_extent:
                g0 = max(g0, counter_extent[0]) if counter_extent[0] is not None else g0
                g1 = min(g1, counter_extent[1]) if counter_extent[1] is not None else g1
            sr = (g0, splash_to) if splash_to else None
            run_counter(S, run, g0, g1, splash=splash, splash_h=splash_h, splash_range=sr)
            channel_run(S, run, g0, g1)
    for kind, s0, w in spans:
        if kind == "gap":
            continue
        if kind.startswith("tall_"):
            tall_module(S, run, kind[5:], s0, w)
        else:
            base_module(S, run, kind, s0, w)
            if kind == "sink":
                sink(S, run, s0, w)
            if kind == "hob":
                hob(S, run, s0, w)
    if wall and S["wall_units"]:
        for kind, s0, w in wall:
            wall_module(S, run, kind, s0, w)
    elif wall and S["open_shelf"]:
        for kind, s0, w in wall:
            if kind in ("unit", "open"):
                wall_module(S, run, "open", s0, w)
    return spans


def box_hood(S, run, s, w, H=2.72):
    """Architectural hood clad in the front material (styles without wall units)."""
    p = run["empty"]
    cx = s + w / 2
    box("hood_body", cx - w / 2 + 0.01, cx + w / 2 - 0.01, -0.5, -0.0, 1.62, 1.7, S["front"], p, bevel=0.003)
    box("hood_chimney", cx - 0.17, cx + 0.17, -0.26, 0.0, 1.7, H, S["front"], p, bevel=0.003)
    box("hood_led", cx - w / 2 + 0.06, cx + w / 2 - 0.06, -0.46, -0.44, 1.617, 1.621, S["led_mat"], p)


def canopy_hood(S, run, s, w):
    p = run["empty"]
    cx = s + w / 2
    frustum("hood", w - 0.02, 0.5, 0.42, 0.28, 1.58, 2.08, S["front"], p, cx=cx, cy=-0.25, top_dy=0.11)
    box("hood_chimney", cx - 0.21, cx + 0.21, -0.28, 0.0, 2.08, 2.72, S["front"], p, bevel=0.003)
    box("hood_mantel", cx - w / 2 - 0.02, cx + w / 2 + 0.02, -0.53, 0.0, 1.54, 1.6, S["front"], p, bevel=0.006)


# --------------------------------------------------------------------------- decor
def decor_counter(S, run, s, kind="board", z=COUNTER):
    p = run["empty"]
    if kind == "board":
        oak = mat_wood("board_oak", "#CC9F6C", "#B88B59", "#8E643C", grain="Z", distortion=6, rough=0.55,
                       space="object", cathedral=True, spacing=0.006)
        ob = box("board", s, s + 0.36, -0.06, -0.04, z, z + 0.46, oak, p, bevel=0.006, segs=3)
        ob.rotation_euler = (-0.18, 0, 0.0)
        ob.location.y -= 0.03
        ob2 = box("board2", s + 0.2, s + 0.48, -0.1, -0.08, z, z + 0.3, oak, p, bevel=0.006, segs=3)
        ob2.rotation_euler = (-0.12, 0, 0.0)
    elif kind == "bowl":
        bowl = mat_plain("bowl_ceramic", "#E8E1D6", rough=0.35, coat=0.2)
        cyl("bowl", 0.15, 0.06, (s, -0.3, z + 0.03), mat=bowl, parent=p, verts=48, scale=(1, 1, 1))
        fruit = mat_plain("lemon", "#D9B23A", rough=0.45)
        fruit2 = mat_plain("orange", "#D9792E", rough=0.5)
        for i, (dx, dy) in enumerate(((-0.05, 0.0), (0.05, 0.02), (0.0, -0.05), (0.02, 0.06))):
            sphere("fruit", 0.04, (s + dx, -0.3 + dy, z + 0.085 + (0.02 if i == 3 else 0)),
                   fruit if i % 2 == 0 else fruit2, p, scale=(1, 1, 0.92), segs=24, rings=12)
    elif kind == "vase":
        vase = mat_plain("vase_clay", "#B9A48A", rough=0.75)
        cyl("vase", 0.055, 0.26, (s, -0.22, z + 0.13), mat=vase, parent=p, verts=40)
        olive_branch(p, (s, -0.22, z + 0.25))
    elif kind == "books":
        for i in range(3):
            c = ["#D8CDBB", "#7D6B57", "#B4523B"][i]
            box("book", s - 0.12 + i * 0.01, s + 0.12 - i * 0.012, -0.36, -0.18, z + i * 0.03, z + i * 0.03 + 0.028,
                mat_plain("bk" + c, c, rough=0.8), p, bevel=0.002)
    elif kind == "kettle":
        k = mat_plain("kettle", "#E7E3DC", rough=0.3)
        cyl("kettle", 0.08, 0.2, (s, -0.3, z + 0.1), mat=k, parent=p, verts=32)
        cyl("kettle_lid", 0.05, 0.02, (s, -0.3, z + 0.21), mat=k, parent=p)


def olive_branch(parent, base):
    stem = mat_plain("olive_stem", "#5B4A36", rough=0.7)
    leaf = mat_plain("olive_leaf", "#6F7A55", rough=0.55)
    leaf2 = mat_plain("olive_leaf2", "#8E9873", rough=0.55)
    rnd = random.Random(11)
    for bi in range(3):
        ang = (bi - 1) * 0.35 + rnd.uniform(-0.1, 0.1)
        L = 0.5 + rnd.uniform(-0.08, 0.1)
        bx, by, bz = base
        tilt = (0.0, ang, rnd.uniform(-0.6, 0.6))
        e = empty("branch", (bx, by, bz), 0.0, parent)
        e.rotation_euler = tilt
        cyl("stem", 0.003, L, (0, 0, L / 2), mat=stem, parent=e, verts=8)
        for li in range(14):
            t = 0.12 + li / 14 * (L - 0.14)
            side = 1 if li % 2 == 0 else -1
            lf = sphere("leaf", 0.03, (side * 0.016, 0.0, t), leaf if li % 3 else leaf2, e,
                        scale=(1.0, 0.24, 0.07), segs=12, rings=6)
            lf.rotation_euler = (0.0, side * 0.9, rnd.uniform(-0.6, 0.6))


def stool(parent, loc, seat_mat, leg_mat, h=0.65):
    x, y = loc
    cyl("seat", 0.18, 0.045, (x, y, h), mat=seat_mat, parent=parent, verts=48)
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        lx, ly = x + math.cos(a) * 0.13, y + math.sin(a) * 0.13
        cyl("leg", 0.011, h, (lx, ly, h / 2), rot=(math.sin(a) * 0.06, -math.cos(a) * 0.06, 0), mat=leg_mat,
            parent=parent, verts=12)
    torus("foot", 0.14, 0.007, (x, y, 0.24), leg_mat, parent)


def pendant(S, parent, x, y, z_bottom, ceiling, on=False):
    kind = S["pendant"]
    pm = S["pendant_mat"]
    cord = S["plinth"]
    glow = S["pendant_glow"] if on else mat_plain("bulb_off", "#EEE8DD", rough=0.3)
    if kind == "cylinder" or kind == "cylinder_white":
        h = 0.26
        cyl("cord", 0.002, ceiling - (z_bottom + h), (x, y, (ceiling + z_bottom + h) / 2), mat=cord, parent=parent,
            verts=8)
        cyl("shade", 0.09, h, (x, y, z_bottom + h / 2), mat=pm, parent=parent, verts=48)
        cyl("diffuser", 0.085, 0.004, (x, y, z_bottom + 0.004), mat=glow, parent=parent, verts=48)
    elif kind == "dome":
        cyl("cord", 0.002, ceiling - (z_bottom + 0.16), (x, y, (ceiling + z_bottom + 0.16) / 2), mat=cord,
            parent=parent, verts=8)
        s = sphere("dome", 0.2, (x, y, z_bottom), pm, parent, scale=(1, 1, 0.75), segs=48, rings=24)
        # cut lower half
        cutter = box("dome_cut", x - 0.3, x + 0.3, y - 0.3, y + 0.3, z_bottom - 0.3, z_bottom, pm, parent)
        boolean_cut(s, cutter)
        sol = s.modifiers.new("solid", "SOLIDIFY")
        sol.thickness = 0.004
        cyl("bulb", 0.05, 0.004, (x, y, z_bottom + 0.06), mat=glow, parent=parent, verts=32)
    elif kind == "slim":
        h = 0.42
        cyl("cord", 0.002, ceiling - (z_bottom + h), (x, y, (ceiling + z_bottom + h) / 2), mat=cord, parent=parent,
            verts=8)
        cyl("tube", 0.035, h, (x, y, z_bottom + h / 2), mat=pm, parent=parent, verts=32)
        cyl("tube_glow", 0.03, 0.004, (x, y, z_bottom - 0.001), mat=glow, parent=parent, verts=32)
    elif kind == "globe":
        cyl("cord", 0.002, ceiling - (z_bottom + 0.4), (x, y, (ceiling + z_bottom + 0.4) / 2), mat=cord,
            parent=parent, verts=8)
        sphere("globe", 0.2, (x, y, z_bottom + 0.2), glow if on else pm, parent, segs=48, rings=24)


# --------------------------------------------------------------------------- room shell
def room_shell(W, D, H, walls_mat, floor_mat, ceiling_mat, openings, skirting=None):
    """Room x in [-W/2, W/2], y in [0, D], z in [0, H]. openings: list of
    (wall, a0, a1, z0, z1) where wall in back/left/right and a is the coordinate along the wall."""
    T = 0.2
    box("floor", -W / 2 - T, W / 2 + T, -2.5, D + T, -0.05, 0.0, floor_mat)
    box("ceiling", -W / 2 - T, W / 2 + T, -2.5, D + T, H, H + 0.05, ceiling_mat)

    def wall_with_holes(name, axis, fixed0, fixed1, a_min, a_max, holes):
        # build a wall as columns between holes
        cuts = sorted(holes, key=lambda h: h[0])
        a = a_min
        pieces = []
        for (h0, h1, z0, z1) in cuts:
            if h0 > a:
                pieces.append((a, h0, 0.0, H))
            pieces.append((h0, h1, 0.0, z0))
            pieces.append((h0, h1, z1, H))
            a = h1
        if a < a_max:
            pieces.append((a, a_max, 0.0, H))
        for (p0, p1, z0, z1) in pieces:
            if z1 - z0 < 1e-4 or p1 - p0 < 1e-4:
                continue
            if axis == "x":
                box(name, p0, p1, fixed0, fixed1, z0, z1, walls_mat)
            else:
                box(name, fixed0, fixed1, p0, p1, z0, z1, walls_mat)

    holes = {"back": [], "left": [], "right": []}
    for (wall, a0, a1, z0, z1) in openings:
        holes[wall].append((a0, a1, z0, z1))
    wall_with_holes("wall_back", "x", D, D + T, -W / 2 - T, W / 2 + T, holes["back"])
    wall_with_holes("wall_left", "y", -W / 2 - T, -W / 2, -2.5, D, holes["left"])
    wall_with_holes("wall_right", "y", W / 2, W / 2 + T, -2.5, D, holes["right"])
    box("wall_front", -W / 2 - T, W / 2 + T, -2.5 - T, -2.5, 0.0, H, walls_mat)
    if skirting:
        box("skirt_l", -W / 2, -W / 2 + 0.012, -2.5, D, 0.0, 0.08, skirting)
        box("skirt_r", W / 2 - 0.012, W / 2, -2.5, D, 0.0, 0.08, skirting)


def window_frame(wall, a0, a1, z0, z1, W, D, frame_mat, sill_mat, mullion=True):
    """Aluminium frame + sill inside the opening."""
    t = 0.05
    if wall == "back":
        y0, y1 = D + 0.06, D + 0.12
        box("wf_l", a0, a0 + t, y0, y1, z0, z1, frame_mat, bevel=0.003)
        box("wf_r", a1 - t, a1, y0, y1, z0, z1, frame_mat, bevel=0.003)
        box("wf_b", a0, a1, y0, y1, z0, z0 + t, frame_mat, bevel=0.003)
        box("wf_t", a0, a1, y0, y1, z1 - t, z1, frame_mat, bevel=0.003)
        if mullion:
            am = (a0 + a1) / 2
            box("wf_m", am - 0.025, am + 0.025, y0, y1, z0, z1, frame_mat, bevel=0.003)
        if sill_mat:
            box("sill", a0 - 0.03, a1 + 0.03, D - 0.02, D + 0.07, z0 - 0.03, z0, sill_mat, bevel=0.003)
    else:
        sx = 1 if wall == "right" else -1
        xw = W / 2 if wall == "right" else -W / 2
        x0, x1 = (xw + sx * 0.06, xw + sx * 0.12)
        x0, x1 = min(x0, x1), max(x0, x1)
        box("wf_l", x0, x1, a0, a0 + t, z0, z1, frame_mat, bevel=0.003)
        box("wf_r", x0, x1, a1 - t, a1, z0, z1, frame_mat, bevel=0.003)
        box("wf_b", x0, x1, a0, a1, z0, z0 + t, frame_mat, bevel=0.003)
        box("wf_t", x0, x1, a0, a1, z1 - t, z1, frame_mat, bevel=0.003)
        if mullion:
            am = (a0 + a1) / 2
            box("wf_m", x0, x1, am - 0.025, am + 0.025, z0, z1, frame_mat, bevel=0.003)
        if sill_mat:
            xa, xb = (xw - sx * 0.02, xw + sx * 0.07)
            box("sill", min(xa, xb), max(xa, xb), a0 - 0.03, a1 + 0.03, z0 - 0.03, z0, sill_mat, bevel=0.003)


def outside_backdrop(wall, a0, a1, z0, z1, W, D, evening):
    """A soft exterior seen through the window. Invisible to shadow rays so the sun still comes in."""
    col_sky = "#DCE6EE" if not evening else "#1B2433"
    sky = mat_emit("sky_" + ("e" if evening else "d"), col_sky, 1.6 if not evening else 0.25)
    if wall == "back":
        ob = box("sky", a0 - 3, a1 + 3, D + 6, D + 6.2, -2, 8, sky)
    elif wall == "right":
        ob = box("sky", W / 2 + 6, W / 2 + 6.2, a0 - 4, a1 + 4, -2, 8, sky)
    else:
        ob = box("sky", -W / 2 - 6.2, -W / 2 - 6, a0 - 4, a1 + 4, -2, 8, sky)
    try:
        ob.visible_shadow = False
    except Exception:
        pass


# --------------------------------------------------------------------------- lights
def world(evening):
    w = bpy.data.worlds.new("world")
    scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    bg = [n for n in nt.nodes if n.type == "BACKGROUND"]
    if not bg:
        b = nt.nodes.new("ShaderNodeBackground")
        out = [n for n in nt.nodes if n.type == "OUTPUT_WORLD"] or [nt.nodes.new("ShaderNodeOutputWorld")]
        nt.links.new(b.outputs[0], out[0].inputs[0])
        bg = [b]
    bg[0].inputs["Color"].default_value = lin("#C8D8E8") if not evening else lin("#141B26")
    bg[0].inputs["Strength"].default_value = 1.2 if not evening else 0.06


def sun(rot_x_deg, rot_z_deg, strength=4.0, angle_deg=2.5, color="#FFF1DE"):
    L = bpy.data.lights.new("sun", type="SUN")
    L.energy = strength
    L.angle = angle_deg * D2R
    L.color = lin(color)[:3]
    ob = bpy.data.objects.new("sun", L)
    ob.rotation_euler = (rot_x_deg * D2R, 0, rot_z_deg * D2R)
    COLL.objects.link(ob)
    return ob


def area(name, loc, rot, size, size_y=None, energy=100.0, color="#FFFFFF", portal=False, visible=False):
    L = bpy.data.lights.new(name, type="AREA")
    L.shape = "RECTANGLE"
    L.size = size
    L.size_y = size_y if size_y else size
    L.energy = energy
    L.color = lin(color)[:3]
    if portal:
        try:
            L.cycles.is_portal = True
        except Exception:
            try:
                L.is_portal = True
            except Exception:
                pass
    ob = bpy.data.objects.new(name, L)
    ob.location = loc
    ob.rotation_euler = rot
    try:
        ob.visible_camera = visible
        ob.visible_glossy = visible
    except Exception:
        pass
    COLL.objects.link(ob)
    return ob


def spot(loc, energy=40, color="#FFD9A8", size=0.05, angle=70):
    L = bpy.data.lights.new("spot", type="SPOT")
    L.energy = energy
    L.color = lin(color)[:3]
    L.shadow_soft_size = size
    L.spot_size = angle * D2R
    L.spot_blend = 0.6
    ob = bpy.data.objects.new("spot", L)
    ob.location = loc
    COLL.objects.link(ob)
    return ob


def camera(loc, yaw_deg, lens=24.0, shift_y=0.0, shift_x=0.0, pitch_deg=90.0, dof=None):
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.sensor_width = 36.0
    cam.shift_y = shift_y
    cam.shift_x = shift_x
    cam.clip_start = 0.02
    if dof:
        cam.dof.use_dof = True
        cam.dof.focus_distance = dof[0]
        cam.dof.aperture_fstop = dof[1]
    ob = bpy.data.objects.new("cam", cam)
    ob.location = loc
    ob.rotation_euler = (pitch_deg * D2R, 0, yaw_deg * D2R)
    COLL.objects.link(ob)
    scene.camera = ob
    return ob


# --------------------------------------------------------------------------- shared style bits
def prepare_style(style, evening):
    if style == "before":
        S = {}
    else:
        S = style_defs(style)
    led_strength = 12.0 if evening else 0.6
    S["led_mat"] = mat_emit("led", "#FFD7A0", led_strength)
    S["pendant_glow"] = mat_emit("pendant_glow", "#FFCF94", 30.0 if evening else 0.0)
    return S


def old_style():
    S = {}
    S["carcass"] = mat_plain("old_carcass", "#D8CDB4", rough=0.6)
    S["plinth"] = mat_plain("old_plinth", "#5A4632", rough=0.7)
    S["inner_dark"] = mat_plain("inner_dark", "#1A1918", rough=0.8)
    S["steel"] = mat_metal("old_steel", "#B5B7B8", rough=0.38, aniso=0.3)
    S["black_glass"] = mat_plain("black_glass", "#0B0B0C", rough=0.04)
    S["ceramic_white"] = mat_plain("ceramic_white", "#F1EFEA", rough=0.12)
    S["front"] = mat_plain("old_formica", "#E3D5AE", rough=0.35, coat=0.2)
    S["wall_mat"] = S["front"]
    S["tall_mat"] = None
    S["island_mat"] = S["front"]
    S["old_wood"] = mat_wood("old_wood", "#7A5233", "#5E3D25", "#3B2416", grain="X", distortion=6,
                             rough=0.4, coat=0.5, space="object")
    S["counter"] = mat_marble("old_laminate", "#CDBF9F", "#4A4036", "#9C8F78", scale=3.5, distortion=30,
                              rough=0.3, secondary=0.7, cloud=0.6)
    S["splash"] = "tiles"
    S["splash_mat"] = mat_tiles("old_tiles", "#EDEBE4", "#E5E2D9", "#A9A396", 0.15, 0.15, plane="XZ",
                                offset=0.0, rough=0.12, mortar=0.003, wobble=0.4)
    S["splash_mat_yz"] = mat_tiles("old_tiles_yz", "#EDEBE4", "#E5E2D9", "#A9A396", 0.15, 0.15, plane="YZ",
                                   offset=0.0, rough=0.12, mortar=0.003, wobble=0.4)
    S["handle"] = "old"
    S["handle_mat"] = S["old_wood"]
    S["tap"] = mat_metal("chrome", "#D7D9DB", rough=0.12, brushed=False)
    S["sink"] = S["steel"]
    S["walls"] = mat_plaster("old_paint", "#E4DED2", patchy=0.12)
    S["cornice"] = False
    S["frame"] = False
    S["fluted"] = False
    S["open_shelf"] = False
    S["wall_units"] = True
    S["led"] = False
    S["led_mat"] = mat_emit("fluo", "#F4FBFF", 4.0)
    return S


def developer_style():
    S = {}
    S["carcass"] = mat_plain("dev_carcass", "#F2F2F0", rough=0.5)
    S["plinth"] = mat_plain("dev_plinth", "#BFC0C0", rough=0.4, metallic=0.5)
    S["inner_dark"] = mat_plain("inner_dark", "#1A1918", rough=0.8)
    S["steel"] = mat_metal("steel", "#C9CBCC", rough=0.3, aniso=0.5)
    S["black_glass"] = mat_plain("black_glass", "#0B0B0C", rough=0.04)
    S["ceramic_white"] = mat_plain("ceramic_white", "#F1EFEA", rough=0.12)
    S["front"] = mat_plain("dev_melamine", "#F4F4F2", rough=0.3, coat=0.1)
    S["wall_mat"] = S["front"]
    S["tall_mat"] = None
    S["island_mat"] = S["front"]
    S["counter"] = mat_marble("dev_quartz", "#B9B7B3", "#9C9A96", "#AAA8A4", scale=6.0, distortion=40, rough=0.2,
                              secondary=0.2, cloud=0.6)
    S["splash"] = "tiles"
    S["splash_mat"] = mat_tiles("dev_tiles", "#F5F5F3", "#F1F1EE", "#D7D6D2", 0.6, 0.3, plane="XZ", offset=0.5,
                                rough=0.06, mortar=0.002)
    S["handle"] = "alu"
    S["handle_mat"] = mat_metal("alu", "#C4C6C8", rough=0.3)
    S["tap"] = mat_metal("chrome", "#D7D9DB", rough=0.12, brushed=False)
    S["sink"] = S["steel"]
    S["walls"] = mat_plaster("dev_paint", "#F3F2EF")
    S["cornice"] = False
    S["frame"] = False
    S["fluted"] = False
    S["open_shelf"] = False
    S["wall_units"] = True
    S["led"] = False
    return S


# =========================================================================== ROOM A
def room_a(style, evening):
    """1980s Tel Aviv apartment kitchen, L-shaped. Window over the sink, door to the service balcony."""
    W, D, H = 3.1, 3.6, 2.72
    win = ("back", -0.35, 0.85, 1.08, 2.28)
    door = ("right", 1.0, 1.85, 0.0, 2.12)
    if style == "before":
        S = old_style()
        floor = mat_terrazzo("terrazzo")
    else:
        S = prepare_style(style, evening)
        floor = mat_tiles("porcelain_warm", "#CFC7BB", "#C8BFB2", "#B3AA9E", 0.6, 0.6, plane="XY", offset=0.0,
                          rough=0.32, mortar=0.002, wobble=0.25)
    room_shell(W, D, H, S["walls"], floor, mat_plaster("ceiling", "#F2F0EC", rough=0.95), [win, door])
    frame_mat = mat_metal("window_alu", "#E4E2DE", rough=0.45, brushed=False) if style != "before" else \
        mat_metal("window_old", "#A8A9A6", rough=0.5, brushed=False)
    sill = mat_marble("sill", "#E0DCD3", "#A9A398", "#C7C1B6", scale=2.0, rough=0.3)
    window_frame("back", *win[1:], W, D, frame_mat, sill)
    outside_backdrop("back", win[1], win[2], win[3], win[4], W, D, evening)
    balcony = mat_emit("balcony", "#F2F4F5", 1.4 if not evening else 0.05)
    box("balcony_glow", W / 2 + 1.2, W / 2 + 1.3, 0.6, 2.4, 0.0, 2.6, balcony)
    box("balcony_floor", W / 2 + 0.2, W / 2 + 1.2, 0.6, 2.4, -0.05, 0.0,
        mat_tiles("balc_tiles", "#D9D3C8", "#D2CBBF", "#B3AA9E", 0.3, 0.3, plane="XY", rough=0.4))
    dfm = mat_plain("door_frame", "#EDEAE4", rough=0.5)
    box("door_frame_l", W / 2 - 0.01, W / 2 + 0.2, 0.96, 1.0, 0.0, 2.16, dfm)
    box("door_frame_r", W / 2 - 0.01, W / 2 + 0.2, 1.85, 1.89, 0.0, 2.16, dfm)
    box("door_frame_t", W / 2 - 0.01, W / 2 + 0.2, 0.96, 1.89, 2.12, 2.16, dfm)

    back = make_run(0, (-W / 2, D))
    back["splash_cuts"] = [(1.2 - 0.03, 2.4 + 0.03, 1.05)]  # window sill at 1.05 m
    left = make_run(90, (-W / 2, 1.5))
    if style == "before":
        build_run(S, back, [("door", 0.6), ("drawers", 0.5), ("sink", 1.0), ("door", 1.0)])
        for s0, w in ((0.0, 0.6), (0.6, 0.5), (2.45, 0.65)):
            wall_module(S, back, "unit", s0, w)
        box("fluo", 0.1, 1.05, -0.2, -0.17, WALL_Z0 - 0.04, WALL_Z0 - 0.01, S["led_mat"], back["empty"])
        fr = mat_plain("old_fridge", "#ECE8DE", rough=0.25, coat=0.3)
        box("fridge", 0.02, 0.62, -0.66, -0.02, 0.0, 1.62, fr, left["empty"], bevel=0.04, segs=6)
        box("fridge_handle", 0.5, 0.53, -0.7, -0.66, 0.9, 1.3, S["tap"], left["empty"], bevel=0.008)
        build_run(S, left, [("gap", 0.6), ("door", 0.9)], counter_extent=(None, 1.48), splash_to=2.088)
        hob(S, left, 0.75, 0.6, gas=True)
        wall_module(S, left, "unit", 0.6, 0.6)
        decor_counter(S, back, 2.6, "kettle")
        cyl("ceiling_lamp", 0.16, 0.06, (0.2, 1.8, H - 0.03), mat=mat_emit("old_lamp", "#FFF6E5", 1.0))
    else:
        wall = [("unit", 0.0, 0.6), ("unit", 0.6, 0.55), ("unit", 2.45, 0.65)]
        build_run(S, back, [("blind", 0.9), ("drawers", 0.6), ("sink", 0.8), ("dishwasher", 0.6), ("filler", 0.2)],
                  wall=wall)
        left_wall = None
        if S["hood"] != "canopy" and S["wall_units"]:
            left_wall = [("unit", 0.6, 1.15)]
        build_run(S, left, [("tall_fridge", 0.6), ("hob", 0.9)], wall=left_wall, counter_extent=(None, 1.48),
                  splash_to=2.088)
        if S["hood"] == "canopy":
            canopy_hood(S, left, 0.6, 0.9)
        elif not S["wall_units"]:
            box_hood(S, left, 0.6, 0.9, H)
        decor_counter(S, back, 1.0, "board")
        decor_counter(S, back, 2.78, "vase")
        decor_counter(S, left, 1.2, "bowl") if False else None
    world(evening)
    if not evening:
        sun(33, 206, strength=4.4)
        area("portal", (0.25, D + 0.06, 1.68), (-math.pi / 2, 0, 0), 1.2, 1.2, energy=0.0, portal=True)
        area("fill", (0.4, -1.6, 1.8), (math.pi / 2, 0, 0), 2.8, 1.6, energy=70, color="#FFF4E6")
        area("door_light", (W / 2 + 0.6, 1.42, 1.3), (0, math.pi / 2, 0), 0.8, 2.0, energy=60, color="#F3F6FA")
    else:
        area("fill", (0.4, -1.6, 1.8), (math.pi / 2, 0, 0), 2.8, 1.6, energy=12, color="#FFE2BC")
        for (x, y) in ((-0.8, 2.6), (0.4, 2.6), (-0.8, 1.4), (0.4, 1.4)):
            spot((x, y, H - 0.02), energy=30)
    camera((0.55, 0.05, 1.46), 12.5, lens=23.0, shift_y=-0.04)


# =========================================================================== ROOM B
def room_b(style, evening, shot):
    """New apartment, open plan. Kitchen along the back wall, room for an island, balcony slider on the right."""
    W, D, H = 5.4, 4.9, 2.66
    slider = ("right", 0.6, 3.6, 0.0, 2.45)
    if style == "before":
        S = developer_style()
        S["led_mat"] = mat_emit("led_off", "#FFFFFF", 0.0)
        S["pendant_glow"] = mat_emit("pg", "#FFFFFF", 0.0)
    else:
        S = prepare_style(style, evening)
    floor = mat_tiles("porcelain_b", "#D3CCC1", "#CCC4B8", "#B9B0A4", 0.8, 0.8, plane="XY", offset=0.0, rough=0.28,
                      mortar=0.002, wobble=0.25)
    room_shell(W, D, H, S["walls"], floor, mat_plaster("ceiling", "#F2F0EC", rough=0.95), [slider])
    frame_mat = mat_metal("slider_alu", "#3A3A3A", rough=0.45, brushed=False)
    window_frame("right", *slider[1:], W, D, frame_mat, None, mullion=True)
    outside_backdrop("right", slider[1], slider[2], 0, 2.45, W, D, evening)
    box("balcony_floor", W / 2 + 0.2, W / 2 + 2.0, 0.0, 4.2, -0.05, -0.02,
        mat_tiles("balc_b", "#C9C1B5", "#C2BAAD", "#A99F92", 0.6, 0.6, plane="XY", rough=0.45))
    box("balcony_rail", W / 2 + 1.9, W / 2 + 1.95, 0.0, 4.2, 0.0, 1.05, frame_mat)

    back = make_run(0, (-W / 2 + 0.5, D))  # starts 0.5 m from the left wall, runs to the right wall (4.9 m)
    p = back["empty"]
    if style == "before":
        build_run(S, back, [("gap", 0.75), ("drawers", 0.6), ("sink", 0.8), ("door", 0.6), ("hob", 0.6),
                            ("door", 0.6)])
        for s0, w in ((0.75, 0.6), (1.35, 0.8), (2.15, 0.6)):
            wall_module(S, back, "unit", s0, w)
        hx = 2.75 + 0.3
        box("hood", hx - 0.3, hx + 0.3, -0.5, 0.0, 1.6, 1.68, S["steel"], p, bevel=0.003)
        box("hood_chim", hx - 0.13, hx + 0.13, -0.26, 0.0, 1.68, H, S["steel"], p, bevel=0.003)
        fr = mat_metal("fridge_ss", "#BFC1C2", rough=0.32, aniso=0.4)
        box("fridge", 0.03, 0.73, -0.7, -0.02, 0.0, 1.85, fr, p, bevel=0.01, segs=3)
        box("fridge_split", 0.03, 0.73, -0.705, -0.69, 1.2, 1.205, mat_plain("gap", "#222222", rough=0.6), p)
        bulb = mat_emit("bare_bulb", "#FFF3DD", 0.0 if not evening else 20.0)
        cyl("socket", 0.02, 0.06, (-0.2, 2.6, H - 0.03), mat=mat_plain("sock", "#EDEDED", rough=0.5))
        sphere("bulb", 0.03, (-0.2, 2.6, H - 0.08), bulb)
    else:
        mods = [("tall_fridge", 0.6), ("tall_oven", 0.6), ("tall_pantry", 0.6), ("drawers", 0.6), ("sink", 0.8),
                ("dishwasher", 0.6), ("hob", 0.9), ("filler", 0.2)]
        wall = [("unit", 1.8, 0.6), ("unit", 2.4, 0.8), ("unit", 3.2, 0.6), ("unit", 3.8, 0.9)]
        if S["hood"] == "canopy":
            wall = wall[:3]
        build_run(S, back, mods, wall=wall)
        if S["hood"] == "canopy":
            canopy_hood(S, back, 3.8, 0.9)
        if not S["wall_units"]:
            box("splash_full", 1.8, 4.9, -0.014, 0.0, WALL_Z0, 2.33, S["splash_mat"], p, bevel=0.0015)
            box("long_shelf", 1.9, 3.7, -0.26, 0.0, 1.78, 1.82, S["shelf_mat"], p, bevel=0.002)
            box("led_shelf", 1.95, 3.65, -0.2, -0.18, 1.773, 1.779, S["led_mat"], p)
            shelf_dressing_simple(S, p, 1.95, 3.6, 1.82)
            box_hood(S, back, 3.8, 0.9, H)
        # ---- island: drawers face the back run (theta 180); seating side faces the camera
        isl_len = 2.6
        cx, cy = -0.15, 2.55
        isl = make_run(180, (cx + isl_len / 2, cy - 0.1))
        ip = isl["empty"]
        S_isl = dict(S)
        S_isl["front"] = S["island_mat"]
        build_run(S_isl, isl, [("drawers", 0.9), ("drawers", 0.8), ("drawers", 0.9)], counter=False, splash=False)
        channel_run(S_isl, isl, 0.0, isl_len)
        box("island_top", -0.02, isl_len + 0.02, -0.6, 0.4, COUNTER - CT, COUNTER, S["counter"], ip, bevel=0.002,
            segs=3)
        box("isl_core", 0.0, isl_len, 0.0, 0.1, PLINTH, BASE_TOP, S["carcass"], ip)
        mir = empty("isl_mirror", (isl_len, 0, 0), math.pi, ip)
        n_pan = 1 if S["fluted"] else 4
        for i in range(n_pan):
            x0 = i * isl_len / n_pan
            front(S_isl, mir, x0, x0 + isl_len / n_pan, PLINTH, BASE_TOP, S["island_mat"], -0.1, handle=False)
        box("isl_plinth_b", 0.0, isl_len, -0.5, 0.06, 0.0, PLINTH - 0.002, S["plinth"], ip)
        for xe in (-0.02, isl_len):
            box("isl_end", xe, xe + 0.02, -0.6, 0.4, 0.0, COUNTER - CT, S["island_mat"], ip, bevel=0.0015)
        seat = S["oak_h"] if style != "dark" else mat_plain("leather", "#3B2A20", rough=0.55)
        leg = mat_plain("stool_leg", "#1E1E1E", rough=0.4, metallic=0.6)
        for i in range(3):
            stool(None, (cx - 0.85 + i * 0.85, cy - 0.86), seat, leg)
        for i in range(3):
            pendant(S, None, cx - 0.8 + i * 0.8, cy, 1.62, H, on=evening)
        decor_counter(S, back, 1.95, "vase")
        decor_counter(S, back, 3.3, "board")
        bowl = mat_plain("bowl_ceramic", "#E8E1D6", rough=0.35, coat=0.2)
        cyl("bowl_i", 0.17, 0.065, (cx + 0.55, cy - 0.05, COUNTER + 0.032), mat=bowl, verts=48)
        lemon = mat_plain("lemon", "#D9B23A", rough=0.45)
        for i, (dx, dy) in enumerate(((-0.05, 0.0), (0.05, 0.03), (0.0, -0.05), (0.03, 0.06))):
            sphere("fruit", 0.042, (cx + 0.55 + dx, cy - 0.05 + dy, COUNTER + 0.09 + (0.02 if i == 3 else 0)), lemon,
                   None, scale=(1, 1, 0.92), segs=24, rings=12)
        vase = mat_plain("vase_clay", "#B9A48A", rough=0.75)
        cyl("vase_i", 0.06, 0.3, (cx - 0.6, cy + 0.05, COUNTER + 0.15), mat=vase, verts=40)
        olive_branch(None, (cx - 0.6, cy + 0.05, COUNTER + 0.29))
        for i in range(3):
            c = ["#D8CDBB", "#7D6B57", "#B4523B"][i]
            box("book", cx - 0.2 - 0.12 + i * 0.01, cx - 0.2 + 0.1, cy - 0.2, cy + 0.02, COUNTER + i * 0.028,
                COUNTER + 0.026 + i * 0.028, mat_plain("bk" + c, c, rough=0.8), None, bevel=0.002)
    world(evening)
    if not evening:
        sun(55, 105, strength=4.0)
        area("portal", (W / 2 + 0.06, 2.1, 1.25), (0, math.pi / 2, 0), 3.0, 2.45, energy=0.0, portal=True)
        area("fill", (0.6, -2.2, 1.9), (math.pi / 2, 0, 0), 4.0, 2.0, energy=220, color="#FFF4E6")
    else:
        area("fill", (0.6, -2.2, 1.9), (math.pi / 2, 0, 0), 4.0, 2.0, energy=40, color="#FFD9AE")
        for x in (-1.3, 0.0, 1.3):
            spot((x, 4.35, H - 0.02), energy=90, angle=70)
        for x in (-1.6, 1.4):
            spot((x, 1.0, H - 0.02), energy=60, angle=90)
        area("ceiling_bounce", (0.0, 2.6, H - 0.05), (0, 0, 0), 3.0, 2.0, energy=35, color="#FFCF9A")
    if shot == "detail":
        camera((0.62, 3.62, 1.22), 24.0, lens=50.0, pitch_deg=68.0, dof=(0.86, 2.8))
    else:
        camera((1.75, 0.75, 1.42), 29.0, lens=22.0, shift_y=-0.03)


def shelf_dressing_simple(S, p, x0, x1, z):
    plate = S["ceramic_white"]
    jar = mat_plain("jar_clay", "#C7B39A", rough=0.7)
    x = x0 + 0.1
    i = 0
    while x < x1 - 0.2:
        if i % 3 == 0:
            for k in range(4):
                cyl("plate", 0.11, 0.012, (x + 0.1, -0.13, z + 0.008 + k * 0.013), mat=plate, parent=p, verts=40)
            x += 0.32
        elif i % 3 == 1:
            cyl("jar", 0.05, 0.18, (x + 0.05, -0.13, z + 0.09), mat=jar, parent=p, verts=24)
            cyl("jar2", 0.035, 0.12, (x + 0.16, -0.13, z + 0.06), mat=plate, parent=p, verts=24)
            x += 0.32
        else:
            cyl("vessel", 0.07, 0.24, (x + 0.08, -0.13, z + 0.12), mat=jar, parent=p, verts=32)
            x += 0.3
        i += 1


# =========================================================================== ROOM C
def room_c(style, evening):
    """Empty room under renovation. U-shaped kitchen, window on the right wall."""
    W, D, H = 3.6, 3.2, 2.72
    win = ("right", 1.35, 2.65, 1.02, 2.3)
    if style == "before":
        walls = mat_plaster("raw_plaster", "#D9D3C9", rough=0.95, patchy=0.75, bump_s=0.12)
        floor = mat_concrete("screed", "#9C968D")
        S = {}
    else:
        S = prepare_style(style, evening)
        walls = S["walls"]
        floor = mat_tiles("porcelain_c", "#CBC3B7", "#C4BBAE", "#AEA599", 0.6, 1.2, plane="XY", offset=0.5,
                          rough=0.3, mortar=0.002, wobble=0.25)
    room_shell(W, D, H, walls, floor, mat_plaster("ceiling_c", "#EEEBE6", rough=0.95), [win])
    frame_mat = mat_metal("window_alu", "#E4E2DE", rough=0.45, brushed=False)
    sill = mat_marble("sill", "#E0DCD3", "#A9A398", "#C7C1B6", scale=2.0, rough=0.3)
    window_frame("right", *win[1:], W, D, frame_mat, sill if style != "before" else mat_concrete("sill_raw"))
    outside_backdrop("right", win[1], win[2], win[3], win[4], W, D, evening)
    if style == "before":
        pipe_cu = mat_metal("copper", "#B87346", rough=0.35, brushed=False)
        pex_r = mat_plain("pex_red", "#B33A2E", rough=0.5)
        pex_b = mat_plain("pex_blue", "#2F5D9A", rough=0.5)
        pvc = mat_plain("pvc", "#8E9092", rough=0.6)
        grey = mat_plain("box_grey", "#7E7F7D", rough=0.6)
        for (x, m) in ((0.12, pex_r), (0.28, pex_b)):
            cyl("pipe", 0.011, 0.08, (x, D - 0.04, 0.55), rot=(math.pi / 2, 0, 0), mat=m)
            cyl("valve", 0.016, 0.03, (x, D - 0.09, 0.55), rot=(math.pi / 2, 0, 0), mat=pipe_cu)
        cyl("drain", 0.025, 0.12, (0.2, D - 0.05, 0.42), rot=(math.pi / 2, 0, 0), mat=pvc)
        wire = mat_plain("wire", "#2C2C2C", rough=0.6)
        for (x, z) in ((-1.2, 1.12), (-0.6, 1.12), (0.9, 1.12), (1.2, 0.35), (-1.0, 0.35), (0.6, 2.2)):
            box("ebox", x - 0.035, x + 0.035, D - 0.012, D, z - 0.035, z + 0.035, grey)
            cyl("wire", 0.003, 0.08, (x + 0.01, D - 0.02, z - 0.06), rot=(0.3, 0, 0), mat=wire, verts=8)
        chase = mat_plaster("chase", "#C8C0B4", rough=0.95)
        box("chase1", -1.21, -1.19, D - 0.003, D, 1.15, H, chase)
        box("chase2", 0.89, 0.91, D - 0.003, D, 1.15, H, chase)
        box("chase3", -1.21, 0.91, D - 0.003, D, 2.42, 2.44, chase)
        alu = mat_metal("ladder_alu", "#BFC3C6", rough=0.4)
        lad = empty("ladder", (-1.0, 1.35, 0.0), 0.5)
        for sx in (-0.22, 0.22):
            r1 = box("rail", sx - 0.015, sx + 0.015, -0.02, 0.02, 0.0, 1.7, alu, lad)
            r1.rotation_euler = (0.18, 0, 0)
            r2 = box("rail_b", sx - 0.015, sx + 0.015, -0.02, 0.02, 0.0, 1.62, alu, lad)
            r2.rotation_euler = (-0.22, 0, 0)
            r2.location.y += 0.45
        for k in range(5):
            z = 0.28 + k * 0.3
            yk = 0.12 - k * 0.026
            box("step", -0.22, 0.22, yk - 0.06, yk + 0.06, z, z + 0.025, alu, lad)
        bucket = mat_plain("bucket", "#F0EFEA", rough=0.4)
        cyl("bucket", 0.15, 0.32, (1.15, 2.2, 0.16), mat=bucket, verts=40)
        cyl("bucket2", 0.12, 0.25, (0.85, 2.5, 0.125), mat=mat_plain("bucket2", "#E1E2DE", rough=0.4), verts=40)
        cyl("lamp_pole", 0.012, 1.3, (0.6, 1.6, 0.65), mat=grey)
        box("lamp_head", 0.48, 0.72, 1.55, 1.66, 1.28, 1.44, mat_plain("lamp_yellow", "#D9A21E", rough=0.4),
            bevel=0.01)
        sheet = mat_plain("dust_sheet", "#E7E3DA", rough=0.95)
        box("sheet", -1.6, -0.3, 0.2, 1.1, 0.0, 0.006, sheet, bevel=0.002)
        cyl("ceiling_wire", 0.004, 0.12, (0.0, 1.6, H - 0.06), mat=wire, verts=8)
        sphere("bulb", 0.03, (0.0, 1.6, H - 0.14), mat_emit("bare_bulb_c", "#FFF3DD", 0.0))
    else:
        back = make_run(0, (-W / 2, D))
        p = back["empty"]
        wall = [("unit", 0.0, 0.6), ("unit", 0.6, 0.75), ("unit", 2.25, 0.75), ("unit", 3.0, 0.6)]
        if S["hood"] != "canopy" and S["wall_units"]:
            wall.insert(2, ("unit", 1.35, 0.9))
        build_run(S, back, [("blind", 0.6), ("drawers", 0.75), ("hob", 0.9), ("drawers", 0.75), ("blind", 0.6)],
                  wall=wall)
        if S["hood"] == "canopy":
            canopy_hood(S, back, 1.35, 0.9)
        if not S["wall_units"]:
            box("splash_full", 0.0, W, -0.014, 0.0, WALL_Z0, 2.33, S["splash_mat"], p, bevel=0.0015)
            box("long_shelf", 0.15, 1.25, -0.26, 0.0, 1.8, 1.84, S["shelf_mat"], p, bevel=0.002)
            box("long_shelf2", 2.35, 3.45, -0.26, 0.0, 1.8, 1.84, S["shelf_mat"], p, bevel=0.002)
            shelf_dressing_simple(S, p, 0.2, 1.2, 1.84)
            shelf_dressing_simple(S, p, 2.4, 3.4, 1.84)
            box_hood(S, back, 1.35, 0.9, H)
        left = make_run(90, (-W / 2, D - 0.6 - 1.2))
        build_run(S, left, [("tall_oven", 0.6), ("tall_fridge", 0.6)], counter=False, splash=False)
        right = make_run(-90, (W / 2, D - 0.6))
        build_run(S, right, [("dishwasher", 0.6), ("sink", 0.8), ("drawers", 0.55)], splash_h=0.12,
                  counter_extent=(0.02, None))
        decor_counter(S, back, 0.75, "board")
        decor_counter(S, back, 2.7, "vase")
        decor_counter(S, right, 1.7, "bowl")
    world(evening)
    if not evening:
        sun(50, 82, strength=4.3)
        area("portal", (W / 2 + 0.06, 2.0, 1.66), (0, math.pi / 2, 0), 1.3, 1.28, energy=0.0, portal=True)
        area("fill", (0.0, -1.6, 1.8), (math.pi / 2, 0, 0), 3.2, 1.8, energy=150, color="#FFF4E6")
    else:
        area("fill", (0.0, -1.6, 1.8), (math.pi / 2, 0, 0), 3.2, 1.8, energy=12, color="#FFE2BC")
        for (x, y) in ((-0.9, 2.0), (0.9, 2.0), (0.0, 1.0)):
            spot((x, y, H - 0.02), energy=30)
    camera((0.0, 0.05, 1.46), 0.0, lens=21.0, shift_y=-0.05)


# =========================================================================== main
evening = args.light == "evening"
if args.room == "a":
    room_a(args.style, evening)
elif args.room == "b":
    room_b(args.style, evening, args.shot)
else:
    room_c(args.style, evening)

scene.view_settings.exposure = {"a": -0.45, "b": -0.55, "c": -0.4}[args.room] + (1.1 if evening else 0.0)
scene.render.filepath = args.out
bpy.ops.render.render(write_still=True)
print("rendered", args.out)
