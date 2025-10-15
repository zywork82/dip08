import os, json, textwrap, time, re, base64, random
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Set, Optional

from flask import Flask, request, jsonify, make_response, send_from_directory
from dotenv import load_dotenv
from openai import OpenAI

# Image generation deps
from PIL import Image
import google.generativeai as genai

# =========================
# .env loading
# =========================
ENV_PATH = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

# --- OpenAI ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

# --- Google (Imagen / Gemini) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Prefer Imagen 3 (returns real PNG bytes); will fall back to Gemini inline if needed
GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "imagen-3.0-generate-002")

# --- Temp image dir for `tmp: true` ---
TMP_IMAGE_DIR = os.getenv("TMP_IMAGE_DIR", "tmp_images")

print("[env] OPENAI_API_KEY set:", bool(OPENAI_API_KEY))
print("[env] MODEL_NAME:", MODEL_NAME)
print("[env] GEMINI_API_KEY set:", bool(GEMINI_API_KEY))
print("[env] GEMINI_IMAGE_MODEL:", GEMINI_IMAGE_MODEL)
print("[env] TMP_IMAGE_DIR:", TMP_IMAGE_DIR)

# === Config ===
USE_UNDERSCORE = False
TEMPERATURE = 0.2
MAX_OUTPUT_TOKENS = 6000
BATCH_SIZE = 40  # OpenAI fill batch size

# === Psych aspects
def _load_aspects_from_env_or_default() -> List[str]:
    env_val = os.getenv("PSYCH_ASPECTS", "")
    if env_val.strip():
        arr = [s.strip() for s in env_val.split(",") if s.strip()]
        if len(arr) >= 3:
            return arr
    return ["Confidence Bias", "Risk Seeking", "Time Orientation", "Critical Thinking"]

PSYCH_ASPECTS = _load_aspects_from_env_or_default()
PSYCH_SEED = os.getenv("PSYCH_SEED")  # optional int/str for deterministic assignment

app = Flask(__name__)

# --------------------------
# Utilities
# --------------------------
def _as_str(x) -> str:
    if isinstance(x, str): return x
    if x is None: return ""
    return str(x)

def _extract_json_block(text: str) -> str:
    if not text: return ""
    s = text.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines and lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
        s = "\n".join(lines).strip()
    if (s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")):
        return s
    import re as _re
    m = _re.search(r"\{(?:[^{}]|(?R))*\}", s)
    return m.group(0) if m else ""

# --------------------------
# Graph builders & validators
# --------------------------
def build_full_skeleton(story: str, levels: List[int] = [3,3,3,3]) -> Dict[str, Any]:
    """Deterministically build the 3x3x3x3 graph using types: scenario | option | ending."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # scenario root
    nodes.append({
        "id": "scenario",
        "type": "scenario",
        "text": f"SCENARIO INTRODUCTION:\n{story}",
        "narrative": "",
        "scene": ""
    })

    # top “decisions” as options
    decisions = ["D1", "D2", "D3"]
    for d in decisions:
        nodes.append({"id": d, "type": "option", "text": f"{d}: decision", "narrative": "", "scene": ""})
        edges.append({"from": "scenario", "to": d})

    letters = ["A", "B", "C"]
    nums = ["1", "2", "3"]
    subletters = ["a", "b", "c"]

    option_nodes = []
    for d in decisions:
        for L in letters:
            oid = f"{d}_{L}"
            nodes.append({"id": oid, "type": "option", "text": f"{oid}: option", "narrative": "", "scene": ""})
            edges.append({"from": d, "to": oid})
            option_nodes.append(oid)

    suboption_nodes = []
    for oid in option_nodes:
        for n in nums:
            sid = f"{oid}_{n}"
            nodes.append({"id": sid, "type": "option", "text": f"{sid}: sub-option", "narrative": "", "scene": ""})
            edges.append({"from": oid, "to": sid})
            suboption_nodes.append(sid)

    leaf_nodes = []
    for sid in suboption_nodes:
        for sl in subletters:
            lid = f"{sid}_{sl}"
            nodes.append({"id": lid, "type": "option", "text": f"{lid}: sub-sub option", "narrative": "", "scene": ""})
            edges.append({"from": sid, "to": lid})
            leaf_nodes.append(lid)

    # endings
    ends = ["E1", "E2", "E3"]
    for e in ends:
        nodes.append({
            "id": e,
            "type": "ending",
            "text": f"{e}: Ending",
            "narrative": "Outcome summary and key consequences.",
            "scene": "Outcome debrief."
        })

    # connect leaves to endings (round-robin)
    for idx, lid in enumerate(leaf_nodes):
        edges.append({"from": lid, "to": ends[idx % 3]})

    return {"nodes": nodes, "edges": edges}

def _ensure_three_endings(payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    end_nodes = [n for n in nodes if n.get("type") == "ending" or str(n.get("id","")).startswith("E")]
    target_ids = ["E1", "E2", "E3"]
    labels = ["Successful Resolution", "Partial Recovery", "Escalation"]

    rename_map = {}
    if len(end_nodes) < 3:
        for i in range(len(end_nodes), 3):
            nodes.append({
                "id": target_ids[i],
                "type": "ending",
                "text": f"{target_ids[i]} ({labels[i]}).",
                "narrative": "Outcome summary and key consequences.",
                "scene": "Outcome debrief: email, meeting room, or public channel."
            })
        end_nodes = [n for n in nodes if n.get("type") == "ending" or str(n.get("id","")).startswith("E")]

    for i in range(3):
        n = end_nodes[i]
        if n["id"] != target_ids[i]:
            rename_map[n["id"]] = target_ids[i]
            n["id"] = target_ids[i]
        n["type"] = "ending"
        n["text"] = f"{target_ids[i]} ({labels[i]})."
        n.setdefault("narrative", "Outcome summary and key consequences.")
        n.setdefault("scene", "Outcome debrief: email, meeting room, or public channel.")

    for e in edges:
        if e.get("to") in rename_map:
            e["to"] = rename_map[e["to"]]

    payload["nodes"] = nodes
    payload["edges"] = edges
    return payload

def _drop_bad_edges(payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    ids: Set[str] = {n["id"] for n in nodes if isinstance(n, dict) and "id" in n}
    payload["edges"] = [e for e in edges if e.get("from") in ids and e.get("to") in ids]
    return payload

def _enforce_node_shape(payload: Dict[str, Any]) -> Dict[str, Any]:
    for n in payload.get("nodes", []):
        n.setdefault("narrative", "")
        n.setdefault("scene", "")
        n.setdefault("text", "")
        n["narrative"] = _as_str(n.get("narrative"))
        n["scene"]     = _as_str(n.get("scene"))
        n["text"]      = _as_str(n.get("text"))
    return payload

def _coerce_node_types(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Force types into: scenario | option | ending."""
    for n in payload.get("nodes", []):
        nid = str(n.get("id",""))
        if nid == "scenario":
            n["type"] = "scenario"
        elif nid.startswith("E"):
            n["type"] = "ending"
        else:
            n["type"] = "option"
    return payload

def _basic_validate(payload: Dict[str, Any]) -> None:
    if "nodes" not in payload or "edges" not in payload:
        raise ValueError("Missing 'nodes' or 'edges'.")
    node_ids = [n.get("id") for n in payload["nodes"] if isinstance(n, dict)]
    if len(node_ids) != len(set(node_ids)):
        raise ValueError("Node IDs must be unique.")

# --------------------------
# Programmatic flat build helpers
# --------------------------
def _build_maps(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
    by_id = {n["id"]: n for n in nodes if isinstance(n, dict) and "id" in n}
    children: Dict[str, List[str]] = {}
    parents: Dict[str, List[str]] = {}
    for e in edges:
        a, b = e.get("from"), e.get("to")
        if not a or not b: continue
        children.setdefault(a, []).append(b)
        parents.setdefault(b, []).append(a)
    for k in children:
        children[k] = sorted(children[k])
    return by_id, children, parents

def _clean_label(text_val: str) -> str:
    if not isinstance(text_val, str): return ""
    t = text_val.strip()
    t = re.sub(r'^[A-Z0-9_]+:\s*', '', t)
    return t.strip()

# --------------------------
# Aspect assignment (unique per sibling set)
# --------------------------
def assign_aspects_unique_per_sibling(model: Dict[str, Any],
                                      aspects: List[str],
                                      seed: Optional[str] = None) -> Dict[str, str]:
    """For every parent -> [child1, child2, child3] group, assign distinct aspects to children."""
    if seed is not None and str(seed).strip() != "":
        try:
            random.seed(int(str(seed).strip()))
        except Exception:
            random.seed(str(seed).strip())

    nodes = model.get("nodes", [])
    edges = model.get("edges", [])
    by_id, children, _parents = _build_maps(nodes, edges)

    assignment: Dict[str, str] = {}

    for parent, kids in children.items():
        if not kids:
            continue
        pool = aspects[:]
        random.shuffle(pool)
        if len(pool) < len(kids):
            extended = []
            while len(extended) < len(kids):
                random.shuffle(pool)
                extended.extend(pool)
            pool = extended
        chosen = pool[:len(kids)]
        for kid, asp in zip(kids, chosen):
            assignment[kid] = asp

    assignment.setdefault("scenario", "Critical Thinking")
    for e in ["E1", "E2", "E3"]:
        assignment.setdefault(e, "Critical Thinking")
    return assignment

# --------------------------
# Visual Bible (cohesive scene & images)
# --------------------------
def build_visual_bible(story: str) -> Dict[str, Any]:
    """Ask OpenAI for a compact, consistent visual style guide to use across scenes/images."""
    if not OPENAI_API_KEY:
        return {}
    client = OpenAI(api_key=OPENAI_API_KEY)

    sys = (
        "You create a concise visual style guide ('visual bible') for a story so that "
        "all generated scenes/images look cohesive. Return ONLY JSON."
    )
    usr = textwrap.dedent(f"""
    STORY:
    {story}

    Return STRICT JSON with keys (short phrases <= 80 chars each value):
    {{
      "setting": "primary locations & time of day/timeframe",
      "main_characters": ["name + 1-2 identifiers", "..."],
      "wardrobe": "recurring wardrobe themes",
      "props_motifs": ["recurring prop/motif 1", "…"],
      "visual_style": "cinematic style (e.g., naturalistic documentary, 85mm portraits)",
      "lighting": "lighting scheme (e.g., soft golden hour / cool office fluorescents)",
      "color_palette": "2-4 color anchors (hex or words)",
      "camera": "framing/lens/aspect ratio conventions",
      "text_overlay_rules": "if any, else ''"
    }}
    Keep it concise and practical for image prompting.
    """)

    cc = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": sys},
            {"role": "user", "content": usr},
        ],
        temperature=0.2
    )
    raw = cc.choices[0].message.content or "{}"
    js = _extract_json_block(raw) or "{}"
    try:
        data = json.loads(js)
        if not isinstance(data.get("main_characters", []), list):
            data["main_characters"] = [str(data.get("main_characters", "")).strip() or "Protagonist"]
        if not isinstance(data.get("props_motifs", []), list):
            data["props_motifs"] = [str(data.get("props_motifs", "")).strip() or "Notebook"]
        return data
    except Exception:
        return {}

def _visual_bible_to_prefix(bible: Dict[str, Any]) -> str:
    if not bible:
        return ""
    mc = ", ".join(bible.get("main_characters", []))
    motifs = ", ".join(bible.get("props_motifs", []))
    parts = [
        f"Setting: {bible.get('setting','').strip()}",
        f"Visual style: {bible.get('visual_style','').strip()}",
        f"Lighting: {bible.get('lighting','').strip()}",
        f"Color palette: {bible.get('color_palette','').strip()}",
        f"Camera: {bible.get('camera','').strip()}",
        f"Main characters: {mc}",
        f"Recurring props/motifs: {motifs}",
        f"Wardrobe: {bible.get('wardrobe','').strip()}",
    ]
    txt = ". ".join([p for p in parts if p and not p.endswith(": ")])
    return txt.strip()

def _compose_image_prompt(nid: str, scene_text: str, bible: Dict[str, Any]) -> str:
    prefix = _visual_bible_to_prefix(bible)
    node_tag = f"Shot tag: {nid}. Maintain continuity with prior shots."
    elements = [prefix, node_tag, f"Scene: {scene_text.strip()}"]
    return "\n".join([e for e in elements if e])

# --------------------------
# Flat hubs builder (ensures non-empty scenes; terminal options use type=ending)
# --------------------------
def build_flat_with_hubs(model: Dict[str, Any], aspect_map: Dict[str, str]) -> Dict[str, Any]:
    nodes = model.get("nodes", [])
    edges = model.get("edges", [])
    by_id, children, parents = _build_maps(nodes, edges)
    letters = ["A", "B", "C"]

    def fmt_opt_id(hub_id: str, letter: str) -> str:
        return f"{hub_id}_{letter}" if USE_UNDERSCORE else f"{hub_id}{letter}"

    def hub_bucket(hub_id: str) -> int:
        return int(hub_id) // 100

    def next_hub_id(hub_id: str, idx: int) -> str:
        base = hub_bucket(hub_id)
        return f"{base+1}0{idx+1}"

    def pref_children(node_id: str) -> List[str]:
        return children.get(node_id, [])

    def node_desc(n: Dict[str, Any]) -> str:
        return _as_str(n.get("narrative") or n.get("text")).strip()

    def node_label(n: Dict[str, Any]) -> str:
        return _clean_label(_as_str(n.get("text")))

    result: Dict[str, Any] = {}

    root_orig = "scenario" if "scenario" in by_id else next(
        (n["id"] for n in nodes if n["id"] not in parents),
        nodes[0]["id"] if nodes else "scenario"
    )
    ROOT_HUB_ID = "101"

    def non_empty_scene_from(n: Dict[str, Any]) -> str:
        return _as_str(n.get("scene") or n.get("narrative") or n.get("text")).strip()

    def build_hub(hub_id: str, hub_origin_id: str):
        origin = by_id.get(hub_origin_id, {})
        kids = pref_children(hub_origin_id)[:3]
        hub_option_ids = [fmt_opt_id(hub_id, letters[i]) for i in range(len(kids))]

        result[hub_id] = {
            "id": hub_id,
            "type": "scenario" if hub_id == "101" else "option",
            "position": "",
            "data": node_desc(origin),
            "description": node_label(origin),
            "scene": non_empty_scene_from(origin),
            "options": hub_option_ids,
            "psych_dimensions": aspect_map.get(hub_origin_id, ""),
            "b64 image": origin.get("b64", "")
        }

        for i, child_orig_id in enumerate(kids):
            opt_node = by_id.get(child_orig_id, {})
            this_opt_id = fmt_opt_id(hub_id, letters[i])
            child_kids = pref_children(child_orig_id)
            ending_children = [cid for cid in child_kids if by_id.get(cid, {}).get("type") == "ending"]
            nonending_children = [cid for cid in child_kids if by_id.get(cid, {}).get("type") != "ending"]

            if ending_children and not nonending_children:
                result[this_opt_id] = {
                    "id": this_opt_id,
                    "type": "ending",
                    "position": "",
                    "data": node_desc(opt_node),
                    "description": node_label(opt_node),
                    "scene": non_empty_scene_from(opt_node),
                    "options": [],
                    "psych_dimensions": aspect_map.get(child_orig_id, ""),
                    "b64 image": opt_node.get("b64", "")
                }
                continue

            if nonending_children:
                nxt_hub = next_hub_id(hub_id, i)
                next_opt_ids = [fmt_opt_id(nxt_hub, letters[j]) for j in range(min(3, len(nonending_children)))]
            else:
                nxt_hub = None
                next_opt_ids = []

            result[this_opt_id] = {
                "id": this_opt_id,
                "type": "option",
                "position": "",
                "data": node_desc(opt_node),
                "description": node_label(opt_node),
                "scene": non_empty_scene_from(opt_node),
                "options": next_opt_ids,
                "psych_dimensions": aspect_map.get(child_orig_id, ""),
                "b64 image": opt_node.get("b64", "")
            }

            if nxt_hub:
                build_hub(nxt_hub, child_orig_id)

    build_hub(ROOT_HUB_ID, root_orig)

    if "101" not in result:
        origin = by_id.get(root_orig, {})
        result["101"] = {
            "id": "101",
            "type": "scenario",
            "position": "",
            "data": _as_str(origin.get("narrative") or origin.get("text")),
            "description": _clean_label(_as_str(origin.get("text"))),
            "scene": _as_str(origin.get("scene") or origin.get("narrative") or origin.get("text")),
            "options": [],
            "psych_dimensions": aspect_map.get(root_orig, ""),
            "b64 image": origin.get("b64", "")
        }

    return result

# --------------------------
# OpenAI fill (chunked) — uses aspect_map + visual bible
# --------------------------
def fill_content_for_nodes(story: str,
                           node_ids: List[str],
                           aspect_map: Dict[str, str],
                           visual_bible: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    """Write text/narrative/scene reflecting psych aspect and visual bible continuity."""
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set.")
    client = OpenAI(api_key=OPENAI_API_KEY)
    result: Dict[str, Dict[str, str]] = {}

    vb_short = json.dumps(visual_bible or {}, ensure_ascii=False)

    def one_batch(batch_ids: List[str]) -> Dict[str, Dict[str, str]]:
        per_batch_aspects = {nid: aspect_map.get(nid, "") for nid in batch_ids}

        sys = (
            "You fill content for nodes in a branching learning scenario.\n"
            "- For each NODE_ID, write fields that REFLECT its psychological aspect.\n"
            "- SCENE MUST follow the global visual bible for continuity (style, lighting, camera, props).\n"
            "- Return ONLY pure JSON, exactly this shape:\n"
            "{\n"
            '  \"NODE_ID\": {\"text\": \"...\", \"narrative\": \"...\", \"scene\": \"...\"},\n'
            '  \"...\": {...}\n'
            "}\n"
            "- Keep each field <=120 chars. All values must be strings."
        )
        ids_serial = ", ".join(batch_ids)
        usr = textwrap.dedent(f"""
        STORY:
        {story}

        GLOBAL VISUAL BIBLE (use for every scene):
        {vb_short}

        Psychological aspects per node id (align content with these):
        {json.dumps(per_batch_aspects, ensure_ascii=False, indent=2)}

        Provide concise content for these node ids (<=120 chars each field):
        {ids_serial}
        """)

        cc = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "system", "content": sys},
                      {"role": "user", "content": usr}],
            temperature=TEMPERATURE
        )
        raw = cc.choices[0].message.content or ""
        js = _extract_json_block(raw)
        if not js:
            raise ValueError("Model did not return JSON for a content batch.")
        data = json.loads(js)
        out = {}
        for k in batch_ids:
            v = data.get(k, {})
            out[k] = {
                "text": _as_str(v.get("text", "")).strip()[:120],
                "narrative": _as_str(v.get("narrative", "")).strip()[:120],
                "scene": _as_str(v.get("scene", "")).strip()[:120],
            }
        return out

    for i in range(0, len(node_ids), BATCH_SIZE):
        chunk = node_ids[i:i+BATCH_SIZE]
        filled = one_batch(chunk)
        result.update(filled)

    return result

def apply_content(model: Dict[str, Any], content_map: Dict[str, Dict[str, str]]) -> Dict[str, Any]:
    id2node = {n["id"]: n for n in model["nodes"]}
    for nid, c in content_map.items():
        n = id2node.get(nid)
        if not n: continue
        if n.get("type") != "ending":
            n["text"] = _as_str(c.get("text", n.get("text", "")))
            n["narrative"] = _as_str(c.get("narrative", n.get("narrative", "")))
            n["scene"] = _as_str(c.get("scene", n.get("scene", "")))
    return model

# --------------------------
# Image helpers (Imagen/Gemini) + PNG normalize + save-to-temp
# --------------------------
def _init_gemini():
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set.")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(GEMINI_IMAGE_MODEL)

def _gemini_image_bytes_for_scene(prompt_text: str) -> bytes:
    """Try Imagen 3 first (if set), else fall back to Gemini inline image."""
    if not prompt_text or not prompt_text.strip():
        return b""
    try:
        if GEMINI_IMAGE_MODEL.startswith("imagen-3"):
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(GEMINI_IMAGE_MODEL)
            try:
                res = model.generate_images(prompt=prompt_text, number_of_images=1, size="1024x1024")
                if getattr(res, "images", None):
                    img0 = res.images[0]
                    if hasattr(img0, "bytes"):
                        return img0.bytes
                    if hasattr(img0, "as_base64_string"):
                        return base64.b64decode(img0.as_base64_string())
            except Exception:
                pass
        model = _init_gemini()
        resp = model.generate_content(prompt_text)
        parts = getattr(resp.candidates[0].content, "parts", []) if resp and resp.candidates else []
        for p in parts:
            if getattr(p, "inline_data", None) and getattr(p.inline_data, "data", None):
                raw = p.inline_data.data
                if isinstance(raw, (bytes, bytearray)):
                    return bytes(raw)
                try:
                    return base64.b64decode(raw)
                except Exception:
                    pass
        return b""
    except Exception:
        return b""

def _png_b64(png_bytes: bytes) -> str:
    """Normalize image, flatten alpha on white, return base64 PNG."""
    if not png_bytes: return ""
    try:
        img = Image.open(BytesIO(png_bytes))
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")
        buf = BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        try:
            return base64.b64encode(png_bytes).decode("utf-8")
        except Exception:
            return ""

def _shrink_png(png_bytes: bytes, max_px: int = 512) -> bytes:
    if not png_bytes: return b""
    try:
        img = Image.open(BytesIO(png_bytes)).convert("RGB")
        w, h = img.size
        if max(w, h) > max_px:
            if w >= h:
                new_w = max_px; new_h = int(h * (max_px / w))
            else:
                new_h = max_px; new_w = int(w * (max_px / h))
            img = img.resize((new_w, new_h), Image.LANCZOS)
        buf = BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception:
        return png_bytes

def fill_images_from_scenes(flat: Dict[str, Any],
                            visual_bible: Dict[str, Any],
                            shrink_to: int = 512) -> Dict[str, Any]:
    """
    Generate images for ALL items. If scene is empty, fall back to narrative/text/data+description.
    Adds `image_error` when a node fails so you can see why.
    """
    keys = [k for k, v in flat.items() if isinstance(v, dict)]
    print(f"[images] attempting {len(keys)} nodes using model={GEMINI_IMAGE_MODEL}")

    for k in keys:
        try:
            v = flat[k]
            scene = _as_str(v.get("scene", "")).strip()
            if not scene:
                fallback = " ".join([
                    _as_str(v.get("narrative", "")),
                    _as_str(v.get("data", "")),
                    _as_str(v.get("description", "")),
                ]).strip()
                scene = fallback[:300]

            if not scene:
                v["image_error"] = "no scene/narrative/text to prompt"
                continue

            prompt = _compose_image_prompt(k, scene, visual_bible)
            png = _gemini_image_bytes_for_scene(prompt)
            if not png or len(png) < 10:
                v["image_error"] = "model returned no image bytes"
                continue

            if shrink_to:
                png = _shrink_png(png, max_px=shrink_to)

            v["b64 image"] = _png_b64(png)
            v.pop("image_error", None)
            print(f"[images] ok -> {k} (b64 {len(v['b64 image'])} chars)")
        except Exception as ex:
            flat[k]["image_error"] = f"exception: {ex.__class__.__name__}"

    return flat

def save_images_to_folder(flat: dict, folder: str, clear_inline_b64: bool = True) -> dict:
    os.makedirs(folder, exist_ok=True)
    wrote = 0
    for k, v in flat.items():
        b64s = v.get("b64 image")
        if not b64s: continue
        try:
            raw = base64.b64decode(b64s)
            img = Image.open(BytesIO(raw))
            img_path = os.path.join(folder, f"{k}.png")
            img.save(img_path, format="PNG", optimize=True)
            v["image_path"] = img_path
            wrote += 1
            if clear_inline_b64:
                v["b64 image"] = ""
        except Exception as ex:
            v["image_error"] = f"save_exception: {ex.__class__.__name__}"
    print(f"[images] wrote {wrote} PNGs to {folder}; cleared_b64={clear_inline_b64}")
    return flat

# --------------------------
# Routes
# --------------------------
@app.get("/health")
def health():
    return {"ok": True}

# Serve temp images written when tmp=true
@app.get("/tmp_images/<path:filename>")
def serve_tmp_image(filename):
    return send_from_directory(TMP_IMAGE_DIR, filename)

@app.post("/generate")
def generate():
    """
    Body:
    {
      "story": "...",     // REQUIRED (>=10 chars)
      "download": true,   // OPTIONAL (or ?download=1)
      "filename": "flow.json", // OPTIONAL
      "images": true,     // OPTIONAL (or ?images=1) -> cohesive images
      "tmp": true,        // OPTIONAL -> save PNGs in TMP_IMAGE_DIR and clear base64
      "psych_seed": 42    // OPTIONAL -> deterministic aspect assignment
    }
    """
    body = request.get_json(silent=True) or {}
    story = (body.get("story") or "").strip()
    download_flag = str(request.args.get("download", "")).lower() in {"1","true","yes"} or bool(body.get("download"))
    filename = (body.get("filename") or f"flowchart_{int(time.time())}.json").strip() or f"flowchart_{int(time.time())}.json"

    images_flag = bool(body.get("images")) or str(request.args.get("images", "")).lower() in {"1","true","yes"}
    tmp_flag = bool(body.get("tmp")) or str(request.args.get("tmp", "")).lower() in {"1","true","yes"}

    seed = body.get("psych_seed", None)
    if seed is None and PSYCH_SEED:
        seed = PSYCH_SEED

    if len(story) < 10:
        return jsonify({"error":"Provide a 'story' with at least 10 characters."}), 400
    if not OPENAI_API_KEY:
        return jsonify({"error":"OPENAI_API_KEY not set."}), 500

    try:
        # 1) Skeleton
        model = build_full_skeleton(story, [3,3,3,3])

        # 2) Unique aspects per sibling
        aspect_map = assign_aspects_unique_per_sibling(model, PSYCH_ASPECTS, seed=seed)

        # 3) Visual bible for cohesive scenes/images
        visual_bible = build_visual_bible(story)

        # 4) Fill content with aspects + visual bible
        node_ids = [n["id"] for n in model["nodes"] if n.get("type") != "ending"]
        content_map = fill_content_for_nodes(story, node_ids, aspect_map, visual_bible)

        # 5) Merge + sanitize + validate
        model = apply_content(model, content_map)
        model = _ensure_three_endings(model)
        model = _drop_bad_edges(model)
        model = _enforce_node_shape(model)
        model = _coerce_node_types(model)
        _basic_validate(model)

        # 6) Flat with terminal options as endings
        flat = build_flat_with_hubs(model, aspect_map)

        # 7) Images (cohesive; never skip due to empty scene)
        if images_flag:
            flat = fill_images_from_scenes(flat, visual_bible=visual_bible, shrink_to=512)
            if tmp_flag:
                flat = save_images_to_folder(flat, folder=TMP_IMAGE_DIR, clear_inline_b64=True)

        if download_flag:
            payload = json.dumps(flat, ensure_ascii=False, indent=2)
            resp = make_response(payload)
            resp.headers["Content-Type"] = "application/json; charset=utf-8"
            resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
            return resp
        return jsonify(flat)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.post("/images/fill")
def images_fill():
    """
    Accepts:
      - {"flat": {...}, "tmp": true, "story": "...optional for fresh bible..."}
      - {"filename": "path/to/flat.json", "tmp": true, "story": "..."}
      - or the flat dict directly.
    Generates cohesive images for ALL items using a visual bible and scene fallbacks.
    """
    body = request.get_json(silent=True) or {}
    tmp_flag = bool(body.get("tmp"))

    flat = None
    if "flat" in body and isinstance(body["flat"], dict):
        flat = body["flat"]
    elif "filename" in body:
        path = body["filename"]
        if not os.path.exists(path):
            return jsonify({"error": f"File not found: {path}"}), 400
        with open(path, "r", encoding="utf-8") as f:
            flat = json.load(f)
    else:
        if isinstance(body, dict) and body and any(isinstance(v, dict) for v in body.values()):
            flat = body

    if not isinstance(flat, dict):
        return jsonify({"error": "Provide a flat dict (or {\"flat\": dict} or {\"filename\": path})."}), 400

    story = _as_str(body.get("story", "")).strip()
    visual_bible = build_visual_bible(story) if story else {
        "setting": "consistent environment across shots",
        "main_characters": ["Main lead", "Supporting member"],
        "visual_style": "consistent lens & framing",
        "lighting": "consistent lighting look",
        "color_palette": "cohesive palette",
        "props_motifs": ["recurring notebook", "club banner"],
        "camera": "repeat framing conventions",
        "wardrobe": "repeat wardrobe cues",
        "text_overlay_rules": ""
    }

    try:
        flat = fill_images_from_scenes(flat, visual_bible=visual_bible, shrink_to=512)
        if tmp_flag:
            flat = save_images_to_folder(flat, folder=TMP_IMAGE_DIR, clear_inline_b64=True)
        return jsonify(flat)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/suggest")
def suggest():
    """
    Generate AI suggestions about a story.

    Body:
    {
      "story": "....",            // REQUIRED (>=10 chars)
      "max_items": 8,             // OPTIONAL
      "style": "bullets",         // OPTIONAL: "bullets" | "paragraphs"
      "include_aspects": true     // OPTIONAL: weave PSYCH_ASPECTS into critique
    }
    Returns: {"suggestions":[{"category":"...","text":"..."}]}
    """
    body = request.get_json(silent=True) or {}
    story = (body.get("story") or "").strip()
    max_items = int(body.get("max_items") or 8)
    style = (body.get("style") or "bullets").lower()
    include_aspects = bool(body.get("include_aspects", True))

    if len(story) < 10:
        return jsonify({"error": "Provide a 'story' with at least 10 characters."}), 400
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY not set."}), 500

    categories = [
        "Clarity & Assumptions",
        "Stakeholders & Perspectives",
        "Ethical/Legal Considerations",
        "Risks & Unintended Consequences",
        "Alternatives & Trade-offs",
        "Data/Evidence Needed",
        "Decision Criteria & Metrics",
        "Next Steps / Experiments"
    ]

    aspects_note = ""
    if include_aspects and PSYCH_ASPECTS:
        aspects_note = (
            "Also, explicitly surface how these psychological aspects might influence the scenario: "
            + ", ".join(PSYCH_ASPECTS) + "."
        )

    style_instr = (
        "- Output style: short bullet points (one sentence each)." if style == "bullets"
        else "- Output style: compact, numbered mini-paragraphs (1–2 sentences each)."
    )

    sys = (
        "You are an expert scenario reviewer for branching decision simulations. "
        "Provide concise, practical suggestions that improve decision quality and learning value. "
        "Always return ONLY valid JSON per the requested schema."
    )

    usr = textwrap.dedent(f"""
    STORY:
    {story}

    Produce up to {max_items} high-impact suggestions across these categories (as applicable):
    {json.dumps(categories, ensure_ascii=False)}

    {style_instr}
    - Be specific and actionable; avoid generic platitudes.
    - Prioritize measurability (what success/failure would look like).
    - If the story misses stakeholders, evidence, or concrete outcomes, say exactly what to add.
    - If framing is biased or one-sided, note the bias and a counter-balance.
    {aspects_note}

    JSON schema to return EXACTLY:
    {{
      "suggestions": [
        {{"category": "Risks & Unintended Consequences", "text": "…"}},
        {{"category": "Decision Criteria & Metrics", "text": "…"}}
      ]
    }}
    Keep texts <= 240 characters each.
    """)

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        cc = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "system", "content": sys},
                      {"role": "user", "content": usr}],
            temperature=0.3
        )
        raw = cc.choices[0].message.content or ""
        js = _extract_json_block(raw)
        data = json.loads(js) if js else {}

        out = {"suggestions": []}
        for s in data.get("suggestions", [])[:max_items]:
            cat = _as_str(s.get("category", "")).strip()
            txt = _as_str(s.get("text", "")).strip()
            if not cat or not txt:
                continue
            if len(txt) > 240:
                txt = txt[:237] + "…"
            out["suggestions"].append({"category": cat, "text": txt})

        if not out["suggestions"]:
            fallback = [line.strip("-• ").strip() for line in raw.splitlines() if line.strip()]
            out["suggestions"] = [{"category": "General", "text": t[:240]} for t in fallback[:max_items]]

        return jsonify(out)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# --------------------------
# Run
# --------------------------
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
