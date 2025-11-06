import os, json, textwrap, time, re, random, base64
from pathlib import Path
from typing import Any, Dict, List, Optional
from io import BytesIO

from flask_cors import CORS 
from flask import Flask, request, jsonify, make_response
from dotenv import load_dotenv
from openai import OpenAI
import google.generativeai as genai
from PIL import Image
from scenarios import scenarios_bp as scenarios_router
from signup import signup_router
from login import login_bp
from users import users_bp
from admins import admin_bp
# =========================
# Load environment
# =========================
ENV_PATH = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

# --- OpenAI (for text generation / branching content) ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

# --- Gemini (for image generation) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image-preview")

print("[env] OPENAI_API_KEY set:", bool(OPENAI_API_KEY))
print("[env] GEMINI_API_KEY set:", bool(GEMINI_API_KEY))
print("[env] MODEL_NAME:", MODEL_NAME)
print("[env] GEMINI_IMAGE_MODEL:", GEMINI_IMAGE_MODEL)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# =========================
# Config
# =========================
USE_UNDERSCORE = False   # "101A" vs "101_A"
TEMPERATURE = 0.2
BATCH_SIZE = 40  # OpenAI fill batch size

# tmp dir for generated PNGs
TMP_DIR = Path(__file__).with_name("tmp")

# Psychological dimensions list
def _load_aspects_from_env_or_default() -> List[str]:
    env_val = os.getenv("PSYCH_ASPECTS", "")
    if env_val.strip():
        arr = [s.strip() for s in env_val.split(",") if s.strip()]
        if len(arr) >= 3:
            return arr
    return ["Confidence Bias", "Risk Seeking", "Time Orientation", "Critical Thinking"]

PSYCH_ASPECTS = _load_aspects_from_env_or_default()
PSYCH_SEED = os.getenv("PSYCH_SEED")

# =========================
# Flask app
# =========================
app = Flask(__name__)
CORS(app) 
app.register_blueprint(scenarios_router)
app.register_blueprint(signup_router)
app.register_blueprint(login_bp)
app.register_blueprint(users_bp)
app.register_blueprint(admin_bp)


# =========================
# Small helpers
# =========================
def _as_str(x) -> str:
    if isinstance(x, str): return x
    if x is None: return ""
    return str(x)

def _extract_json_block(text: str) -> str:
    if not text: return ""
    s = text.strip()

    # strip ``` fences if present
    if s.startswith("```"):
        lines = s.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()

    # could already be pure JSON
    if (s.startswith("{") and s.endswith("}")) or (s.startswith("[") and s.endswith("]")):
        return s

    # fallback: try to match first {...} blob
    m = re.search(r"\{(?:[^{}]|(?R))*\}", s)
    return m.group(0) if m else ""

# =========================
# Graph construction
# =========================
def build_full_skeleton(story: str) -> Dict[str, Any]:
    """
    Build branching skeleton of scenario -> D1/D2/D3 -> subbranches -> endings.
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # Root scenario node
    nodes.append({
        "id": "scenario",
        "type": "scenario",
        "text": f"SCENARIO:\n{story}",
        "narrative": ""
    })

    # First layer decisions
    decisions = ["D1", "D2", "D3"]
    for d in decisions:
        nodes.append({
            "id": d,
            "type": "option",
            "text": f"{d}: decision",
            "narrative": ""
        })
        edges.append({"from": "scenario", "to": d})

    letters = ["A", "B", "C"]
    nums = ["1", "2", "3"]
    subletters = ["a", "b", "c"]

    # Second layer (D1_A, D1_B, ...)
    option_nodes = []
    for d in decisions:
        for L in letters:
            oid = f"{d}_{L}"
            nodes.append({
                "id": oid,
                "type": "option",
                "text": f"{oid}: option",
                "narrative": ""
            })
            edges.append({"from": d, "to": oid})
            option_nodes.append(oid)

    # Third layer (D1_A_1, etc.)
    suboption_nodes = []
    for oid in option_nodes:
        for n in nums:
            sid = f"{oid}_{n}"
            nodes.append({
                "id": sid,
                "type": "option",
                "text": f"{sid}: sub-option",
                "narrative": ""
            })
            edges.append({"from": oid, "to": sid})
            suboption_nodes.append(sid)

    # Fourth layer (D1_A_1_a, etc.)
    leaf_nodes = []
    for sid in suboption_nodes:
        for sl in subletters:
            lid = f"{sid}_{sl}"
            nodes.append({
                "id": lid,
                "type": "option",
                "text": f"{lid}: sub-sub",
                "narrative": ""
            })
            edges.append({"from": sid, "to": lid})
            leaf_nodes.append(lid)

    # Endings
    nodes.append({
        "id": "E1",
        "type": "ending",
        "text": "E1: Successful Resolution",
        "narrative": "Crisis resolved positively. Trust rebuilt and objectives achieved."
    })
    nodes.append({
        "id": "E2",
        "type": "ending",
        "text": "E2: Partial Recovery",
        "narrative": "Partial success achieved. Some issues remain unresolved or reputational impact persists."
    })
    nodes.append({
        "id": "E3",
        "type": "ending",
        "text": "E3: Escalation",
        "narrative": "Situation worsens or spreads. Further action and accountability required."
    })

    # Connect leaves round-robin to endings
    for i, lid in enumerate(leaf_nodes):
        edges.append({"from": lid, "to": f"E{(i % 3) + 1}"})

    return {"nodes": nodes, "edges": edges}

def _build_maps(nodes, edges):
    by_id = {n["id"]: n for n in nodes}
    children: Dict[str, List[str]] = {}
    parents: Dict[str, List[str]] = {}
    for e in edges:
        a, b = e.get("from"), e.get("to")
        if not a or not b:
            continue
        children.setdefault(a, []).append(b)
        parents.setdefault(b, []).append(a)
    for k in children:
        children[k] = sorted(children[k])
    return by_id, children, parents

# =========================
# Psychological assignment
# =========================
def assign_aspects_unique_per_sibling(model, aspects, seed=None):
    if seed:
        try:
            random.seed(int(seed))
        except:
            random.seed(str(seed))

    _, children, _ = _build_maps(model["nodes"], model["edges"])
    assignment: Dict[str, str] = {}

    for parent, kids in children.items():
        pool = aspects[:]
        random.shuffle(pool)
        if len(pool) < len(kids):
            # repeat pool if needed
            pool = (pool * ((len(kids) // len(pool)) + 2))[:len(kids)]
        for kid, asp in zip(kids, pool):
            assignment[kid] = asp

    # defaults
    assignment.setdefault("scenario", "Critical Thinking")
    for e in ["E1", "E2", "E3"]:
        assignment.setdefault(e, "Critical Thinking")

    return assignment

# =========================
# OpenAI content fill
# =========================
def fill_content_for_nodes(story, node_ids, aspect_map):
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set.")
    client = OpenAI(api_key=OPENAI_API_KEY)
    result = {}

    def one_batch(batch_ids):
        per_aspect = {nid: aspect_map.get(nid, "") for nid in batch_ids}

        sys_msg = (
            "You generate branching decision options for a scenario-based training simulation.\n"
            "- 'text' = short clickable choice.\n"
            "- 'narrative' = short stakes / consequence.\n"
            "- Each field <=120 chars.\n"
            "- Tailor wording to THIS scenario.\n"
            "- Return ONLY valid JSON.\n"
            "- Do NOT explicitly mention psychological bias/aspect names in the output.\n"
        )

        usr = textwrap.dedent(f"""
        SCENARIO / BACKGROUND:
        {story}

        Internal psych design hints (do NOT reveal in answers):
        {json.dumps(per_aspect, indent=2)}

        Node IDs to fill:
        {', '.join(batch_ids)}

        Return JSON ONLY in this shape:
        {{
          "NODE_ID": {{
            "text": "Decision / option wording",
            "narrative": "Short consequence / risk / reflection"
          }},
          ...
        }}

        Rules:
        - 'text' should read like something the learner might choose.
        - 'narrative' should highlight stakes/impact.
        - <=120 chars each.
        """)

        cc = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": usr}
            ],
            temperature=TEMPERATURE,
        )

        raw = cc.choices[0].message.content or ""
        js = _extract_json_block(raw)
        data = json.loads(js)

        out_local = {}
        for k in batch_ids:
            v = data.get(k, {})
            out_local[k] = {
                "text": _as_str(v.get("text", ""))[:120],
                "narrative": _as_str(v.get("narrative", ""))[:120],
            }
        return out_local

    for i in range(0, len(node_ids), BATCH_SIZE):
        chunk = node_ids[i:i+BATCH_SIZE]
        result.update(one_batch(chunk))

    return result

def apply_content(model, content_map):
    id2node = {n["id"]: n for n in model["nodes"]}
    for nid, c in content_map.items():
        n = id2node.get(nid)
        if not n:
            continue
        n["text"] = _as_str(c.get("text", n.get("text", "")))
        n["narrative"] = _as_str(c.get("narrative", n.get("narrative", "")))
    return model

# =========================
# Flatten for frontend
# =========================
def build_flat_with_hubs(model, aspect_map):
    nodes = model["nodes"]
    edges = model["edges"]
    by_id, children, parents = _build_maps(nodes, edges)

    letters = ["A", "B", "C"]
    ENDING_IDS = ["E1", "E2", "E3"]
    ending_cycle_index = 0

    def pick_ending_id():
        nonlocal ending_cycle_index
        eid = ENDING_IDS[ending_cycle_index % 3]
        ending_cycle_index += 1
        return eid

    def fmt_opt_id(hub_id: str, letter: str) -> str:
        return f"{hub_id}_{letter}" if USE_UNDERSCORE else f"{hub_id}{letter}"

    def hub_bucket(hub_id: str) -> int:
        return int(hub_id) // 100

    def next_hub_id(hub_id: str, idx: int) -> str:
        return f"{hub_bucket(hub_id)+1}0{idx+1}"

    def get_text(n):
        return _as_str(n.get("text", "")).strip()

    def get_narr(n):
        return _as_str(n.get("narrative", "")).strip()

    def merge_fields(a, b):
        if a and b:
            return f"{a}\n\n{b}"
        return a or b

    def clean_psych(val):
        v = _as_str(val).strip()
        v = v.strip("[]\"' ")
        return v

    def fallback_description(is_leaf: bool, chosen_ending: Optional[str]):
        if is_leaf and chosen_ending in ("E1","E2","E3"):
            if chosen_ending == "E1":
                return "Your choice aims for a successful resolution."
            if chosen_ending == "E2":
                return "Your choice stabilizes things, but recovery is incomplete."
            if chosen_ending == "E3":
                return "Your choice risks escalation of the situation."
        if not is_leaf:
            return "Choose how you want to proceed."
        return "Continue."

    result: Dict[str, Any] = {}

    # Root hub
    root_orig = "scenario" if "scenario" in by_id else nodes[0]["id"]
    ROOT_HUB_ID = "101"

    def build(hub_id: str, hub_origin_id: str):
        origin_node = by_id.get(hub_origin_id, {})
        kids = children.get(hub_origin_id, [])[:3]
        hub_option_ids = [fmt_opt_id(hub_id, letters[i]) for i in range(len(kids))]

        merged_text = merge_fields(get_text(origin_node), get_narr(origin_node)).strip()
        if not merged_text:
            merged_text = "Choose your next step."

        result[hub_id] = {
            "id": hub_id,
            "type": "scenario" if hub_id == ROOT_HUB_ID else "option",
            "position": "",
            "data_description": merged_text,
            "options": hub_option_ids,
            "psych_dimensions": clean_psych(aspect_map.get(hub_origin_id, "")),
        }

        for i, child_orig_id in enumerate(kids):
            child_node = by_id.get(child_orig_id, {})
            this_opt_id = fmt_opt_id(hub_id, letters[i])

            grandkids = children.get(child_orig_id, [])
            non_ending_grandkids = [
                g for g in grandkids
                if by_id.get(g, {}).get("type") != "ending"
            ]

            # Leaf -> ending OR branch -> next hub
            if not non_ending_grandkids:
                chosen_ending = pick_ending_id()
                child_merged = merge_fields(get_text(child_node), get_narr(child_node)).strip()
                if not child_merged:
                    child_merged = fallback_description(
                        is_leaf=True,
                        chosen_ending=chosen_ending
                    )

                result[this_opt_id] = {
                    "id": this_opt_id,
                    "type": "option",
                    "position": "",
                    "data_description": child_merged,
                    "options": [chosen_ending],
                    "psych_dimensions": clean_psych(aspect_map.get(child_orig_id, "")),
                }

            else:
                nxt_hub = next_hub_id(hub_id, i)
                next_opt_ids = [
                    fmt_opt_id(nxt_hub, letters[j])
                    for j in range(min(3, len(non_ending_grandkids)))
                ]

                child_merged = merge_fields(get_text(child_node), get_narr(child_node)).strip()
                if not child_merged:
                    child_merged = fallback_description(
                        is_leaf=False,
                        chosen_ending=None
                    )

                result[this_opt_id] = {
                    "id": this_opt_id,
                    "type": "option",
                    "position": "",
                    "data_description": child_merged,
                    "options": next_opt_ids,
                    "psych_dimensions": clean_psych(aspect_map.get(child_orig_id, "")),
                }

                build(nxt_hub, child_orig_id)

    build(ROOT_HUB_ID, root_orig)

    # Endings
    ending_map = {
        "E1": (
            "✅ Successful Resolution",
            "The crisis is fully resolved, and relationships or goals are restored."
        ),
        "E2": (
            "⚖️ Partial Recovery",
            "Some improvement achieved, but challenges or reputational impacts remain."
        ),
        "E3": (
            "⚠️ Escalation",
            "The situation worsens and requires further intervention or external involvement."
        ),
    }

    for e in ["E1", "E2", "E3"]:
        title, desc = ending_map[e]
        result[e] = {
            "id": e,
            "type": "ending",
            "position": "",
            "data_description": f"{title}\n\n{desc}",
            "options": [],
            "psych_dimensions": clean_psych(aspect_map.get(e, "")),
        }

    return result

# =========================
# IMAGE GENERATION CORE
# =========================

def _fallback_png_real_bytes() -> bytes:
    """
    Make a valid transparent 1x1 PNG so we always return *some* image.
    """
    img = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    buff = BytesIO()
    img.save(buff, format="PNG")
    return buff.getvalue()

def _looks_like_base64(b: bytes) -> bool:
    """
    Heuristic: if it's all base64-ish chars, assume it's base64 text.
    Otherwise assume it's already raw bytes.
    """
    try:
        txt = b.decode("ascii")
    except UnicodeDecodeError:
        return False
    allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\r\n"
    return all((ch in allowed) for ch in txt.strip())

def _extract_first_image_bytes_from_gemini_response(response) -> Optional[bytes]:
    """
    Extract the first inline image payload from Gemini response.
    Handles both:
    - already-raw PNG/JPEG bytes
    - base64 text blob that needs decoding
    """
    if not hasattr(response, "candidates") or not response.candidates:
        return None

    cand = response.candidates[0]
    if not hasattr(cand, "content") or not hasattr(cand.content, "parts"):
        return None

    for p in cand.content.parts:
        if hasattr(p, "inline_data") and p.inline_data:
            blob = p.inline_data.data
            # blob can be str or bytes
            if isinstance(blob, str):
                # str => assume it's base64 text
                try:
                    return base64.b64decode(blob)
                except Exception:
                    return None
            elif isinstance(blob, bytes):
                if _looks_like_base64(blob):
                    try:
                        return base64.b64decode(blob)
                    except Exception:
                        return None
                else:
                    # already looks like real binary
                    return blob
    return None

def _generate_single_image_file(prompt: str, file_path: Path) -> bool:
    """
    1. Ask Gemini to generate an image for `prompt`.
    2. Pull inline image data.
    3. Normalize to PNG.
    4. Save to file_path.
    Returns:
      True  = model gave a real image
      False = we fell back to 1x1 transparent PNG
    """
    if not GEMINI_API_KEY:
        # no key -> fallback
        png_bytes = _fallback_png_real_bytes()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(png_bytes)
        print(f"[image-gen] Saved fallback (no Gemini API key) {file_path}")
        return False

    try:
        model = genai.GenerativeModel(GEMINI_IMAGE_MODEL)
        response = model.generate_content(prompt)

        raw_bytes = _extract_first_image_bytes_from_gemini_response(response)
        if raw_bytes is None:
            # no valid image from model -> fallback
            png_bytes = _fallback_png_real_bytes()
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(png_bytes)
            print(f"[image-gen] Saved fallback (no inline image) {file_path}")
            return False

        # attempt to open + re-save as PNG to normalize
        img = Image.open(BytesIO(raw_bytes))
        img.load()
        buff = BytesIO()
        img.save(buff, format="PNG")
        png_bytes = buff.getvalue()

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(png_bytes)

        print(f"[image-gen] Saved {file_path}")
        return True

    except Exception as e:
        # on any decode failure -> fallback
        print(f"[image-gen] Error generating image: {e}")
        png_bytes = _fallback_png_real_bytes()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(png_bytes)
        print(f"[image-gen] Saved fallback {file_path}")
        return False

def _file_to_b64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

# =========================
# Flask routes
# =========================

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/generate")
def generate():
    """
    Build the branching scenario JSON and return it (or let you download it).
    Body:
    {
      "story": "...",        // required
      "download": false,
      "filename": "flow.json",
      "psych_seed": 42
    }
    """
    body = request.get_json(silent=True) or {}
    story = (body.get("story") or "").strip()
    if len(story) < 10:
        return jsonify({"error": "Provide a 'story' >=10 chars"}), 400

    seed = body.get("psych_seed", PSYCH_SEED)
    download_flag = (
        bool(body.get("download")) or
        str(request.args.get("download", "")).lower() in {"1","true"}
    )
    filename = body.get("filename") or f"flow_{int(time.time())}.json"

    try:
        # 1. build raw skeleton
        model = build_full_skeleton(story)

        # 2. assign psych aspects
        aspect_map = assign_aspects_unique_per_sibling(model, PSYCH_ASPECTS, seed)

        # 3. generate text/narrative for non-ending nodes
        non_ending_ids = [n["id"] for n in model["nodes"] if n.get("type") != "ending"]
        node_content_map = fill_content_for_nodes(story, non_ending_ids, aspect_map)

        # 4. merge AI output into nodes
        model = apply_content(model, node_content_map)

        # 5. flatten to front-end hub map
        flat = build_flat_with_hubs(model, aspect_map)

        # 6. handle download
        if download_flag:
            payload = json.dumps(flat, indent=2, ensure_ascii=False)
            resp = make_response(payload)
            resp.headers["Content-Type"] = "application/json"
            resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
            return resp

        return jsonify(flat)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.post("/generate_images")
def generate_images_route():
    """
    Body:
    {
      "tmp": true,
      "nodes": [
        {
          "id": "101",
          "data_description": "Investigate the claims thoroughly. What evidence will you gather to support your findings?"
        },
        {
          "id": "101A",
          "data_description": "Hold a meeting with club members. How will you ensure everyone feels heard and valued?"
        }
      ]
    }

    Behavior:
    - For each node:
        1. prompt Gemini using ONLY data_description
        2. write PNG to tmp/<id>.png
        3. read file and base64-encode it
    - If tmp == false:
        delete the file after encoding
    - If tmp == true:
        leave the file on disk (for inspection)

    Response:
    {
      "images": [
        {
          "id": "101",
          "data_description": "...",
          "image_b64": "...."
        },
        ...
      ]
    }
    """
    body = request.get_json(silent=True) or {}
    keep_tmp_files = bool(body.get("tmp", False))
    nodes = body.get("nodes", [])

    if not nodes:
        return jsonify({"error": "No nodes provided"}), 400

    results = []

    for node in nodes:
        nid = _as_str(node.get("id", "")).strip()
        desc = _as_str(node.get("data_description", "")).strip()
        if not nid or not desc:
            continue

        print(f"[image-gen] generating for {nid}")

        # 1. generate PNG file in tmp/<nid>.png
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        out_path = TMP_DIR / f"{nid}.png"
        _generate_single_image_file(desc, out_path)  # we don't actually need the True/False here for API

        # 2. read file as base64
        img_b64 = _file_to_b64(out_path)

        # 3. delete file if user doesn't want to keep it
        if not keep_tmp_files:
            try:
                out_path.unlink()
                print(f"[image-gen] Deleted {out_path} after encoding (tmp=false)")
            except Exception as e:
                print(f"[image-gen] WARN could not delete {out_path}: {e}")

        # 4. add to response
        results.append({
            "id": nid,
            "data_description": desc,
            "image_b64": img_b64
        })

    return jsonify({"images": results})

@app.delete("/tmp")
def clear_tmp():
    """
    Delete all saved PNGs in tmp/.
    """
    if TMP_DIR.exists():
        count = 0
        for f in TMP_DIR.glob("*.png"):
            try:
                f.unlink()
                count += 1
            except Exception as e:
                print("[WARN] couldn't delete", f, e)
        return jsonify({"deleted": count})
    return jsonify({"deleted": 0})

if __name__ == "__main__":
    # You can switch to "0.0.0.0" if you want LAN access
    app.run(host="127.0.0.1", port=5000, debug=True)
