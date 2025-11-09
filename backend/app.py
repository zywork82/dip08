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
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
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
# Graph construction (with tier control)
# =========================
def build_full_skeleton(story: str, tier_level: int = 4) -> Dict[str, Any]:
    """
    Build branching skeleton of scenario -> D1/D2/D3 -> further tiers -> endings.

    tier_level:
      1 => scenario -> D1/D2/D3 -> endings
      2 => + D1_A / D1_B / D1_C
      3 => + D1_A_1 / ...
      4 => + D1_A_1_a / ... (full depth, default)
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # Clamp tier_level between 1 and 4
    tier_level = max(1, min(4, int(tier_level)))

    # Root scenario node
    nodes.append({
        "id": "scenario",
        "type": "scenario",
        "text": f"Introduction:\n{story.strip()}",
        "narrative": "",
        "data_explanation": "This sets the stage for the following decisions and outcomes."
    })

    # Tier 1: First layer decisions
    decisions = ["D1", "D2", "D3"]
    for d in decisions:
        nodes.append({
            "id": d,
            "type": "option",
            "text": f"{d}: decision",
            "narrative": "",
            "data_explanation": ""
        })
        edges.append({"from": "scenario", "to": d})
    current_leaves = decisions[:]

    # We'll progressively deepen from these leaves
    letters = ["A", "B", "C"]
    nums = ["1", "2", "3"]
    subletters = ["a", "b", "c"]

    leaf_nodes: List[str] = []

    # Tier 2: D1_A, D1_B, ...
    if tier_level >= 2:
        option_nodes = []
        for d in current_leaves:
            for L in letters:
                oid = f"{d}_{L}"
                nodes.append({
                    "id": oid,
                    # ✅ These nodes are *new scenario states*, not actions
                    "type": "scenario",
                    "text": f"{oid}: scenario state",
                    "narrative": "",
                    "data_explanation": "This represents the situation *after* the previous decision."
                })

                edges.append({"from": d, "to": oid})
                option_nodes.append(oid)
        current_leaves = option_nodes[:]
        if tier_level == 2:
            leaf_nodes = current_leaves[:]

    # Tier 3: D1_A_1, ...
    if tier_level >= 3:
        suboption_nodes = []
        for oid in current_leaves:
            for n in nums:
                sid = f"{oid}_{n}"
                nodes.append({
                    "id": sid,
                    "type": "option",
                    "text": f"{sid}: sub-option",
                    "narrative": "",
                    "data_explanation": ""
                })
                edges.append({"from": oid, "to": sid})
                suboption_nodes.append(sid)
        current_leaves = suboption_nodes[:]
        if tier_level == 3:
            leaf_nodes = current_leaves[:]

    # Tier 4: D1_A_1_a, ...
    if tier_level >= 4:
        deep_leaf_nodes = []
        for sid in current_leaves:
            for sl in subletters:
                lid = f"{sid}_{sl}"
                nodes.append({
                    "id": lid,
                    "type": "option",
                    "text": f"{lid}: sub-sub",
                    "narrative": "",
                    "data_explanation": ""
                })
                edges.append({"from": sid, "to": lid})
                deep_leaf_nodes.append(lid)
        leaf_nodes = deep_leaf_nodes[:]

    # Endings
    nodes.append({
        "id": "E1",
        "type": "ending",
        "text": "E1: Successful Resolution",
        "narrative": "Crisis resolved positively. Trust rebuilt and objectives achieved.",
        "data_explanation": ""
    })
    nodes.append({
        "id": "E2",
        "type": "ending",
        "text": "E2: Partial Recovery",
        "narrative": "Partial success achieved. Some issues remain unresolved or reputational impact persists.",
        "data_explanation": ""
    })
    nodes.append({
        "id": "E3",
        "type": "ending",
        "text": "E3: Escalation",
        "narrative": "Situation worsens or spreads. Further action and accountability required.",
        "data_explanation": ""
    })

    # Connect deepest tier nodes to endings
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

def fill_content_for_nodes(story, node_ids, aspect_map, mode="action"):

    """
    mode = "action" → Generate choice/action text (verbs, decisions).
    mode = "state"  → Generate scenario state descriptions after a choice.
    """
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set.")
    client = OpenAI(api_key=OPENAI_API_KEY)

    # ---------------- PROMPT DIFFERENCES ----------------
    if mode == "action":
        sys_msg = """
        You are generating *decision actions* for an interactive scenario.

        TEXT (required):
        - Write a clear decision/action the user takes.
        - Must start with a verb.
        - Example: "Hold an emergency meeting with leadership."

        NARRATIVE (required):
        - Describe what happens immediately *after* this choice.
        - Do NOT describe long-term outcomes.

        Keep each part under 220 characters.
        """

    elif mode == "state":
        sys_msg = """
        You are generating *scenario states* (situational descriptions after a choice).

        TEXT (required):
        - Describe the new situation now.
        - Do NOT include any decision or instruction.
        - Do NOT start with a verb.
        - Example: "Leadership has gathered, but internal confusion remains."

        NARRATIVE (required):
        - Provide immediate emotional or operational impact.
        - Example: "Staff are unsure how to respond, and tension is rising."

        Keep each part under 220 characters.
        """

    result = {}

    def batch(ids):
        per_aspect = {nid: aspect_map.get(nid, "") for nid in ids}

        usr = f"""
        SCENARIO BACKGROUND:
        {story}

        Internal design hints (not shown to user, only to help style tone):
        {json.dumps(per_aspect, indent=2)}

        Fill the following node IDs:
        {ids}

        Return ONLY valid JSON in this shape:
        {{
          "NODE_ID": {{
            "text": "string",
            "narrative": "string"
          }},
          ...
        }}
        """

        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": usr},
            ],
            temperature=TEMPERATURE,
        )

        raw = resp.choices[0].message.content or ""
        js = _extract_json_block(raw)
        parsed = json.loads(js)

        out = {}
        for nid in ids:
            v = parsed.get(nid, {})
            out[nid] = {
                "text": _as_str(v.get("text", ""))[:250],
                "narrative": _as_str(v.get("narrative", ""))[:250],
            }
        return out

    for i in range(0, len(node_ids), BATCH_SIZE):
        chunk = node_ids[i:i+BATCH_SIZE]
        result.update(batch(chunk))

    return result

# =========================
# OpenAI content fill
# =========================
# def fill_content_for_nodes(story, node_ids, aspect_map):
#     if not OPENAI_API_KEY:
#         raise RuntimeError("OPENAI_API_KEY not set.")
#     client = OpenAI(api_key=OPENAI_API_KEY)
#     result = {}

#     def one_batch(batch_ids):
#         per_aspect = {nid: aspect_map.get(nid, "") for nid in batch_ids}

#         sys_msg = (
#             "You are generating branching decision options for an interactive training scenario.\n"
#             "- 'text' = an imperative or action-based sentence describing what the learner chooses to do.\n"
#             "  (e.g., 'Hold an emergency meeting with all members' or 'Issue a public apology through social media.')\n"
#             "- 'narrative' = a short continuation describing what happens immediately after that choice.\n"
#             "  (e.g., 'Members express relief, though tensions remain over unresolved details.')\n"
#             "- Always write in imperative / action form, not first or third person (no 'I', 'you', or 'The president...').\n"
#             "- Avoid modal or predictive phrasing like 'This may...' or 'This could...'. Focus on what actually happens next.\n"
#             "- Keep both fields clear and natural (about 100–200 characters each, max 250).\n"
#             "- Tailor the content closely to THIS specific scenario.\n"
#             "- Return ONLY valid JSON in the shape provided.\n"
#         )

#         usr = textwrap.dedent(f"""
#         SCENARIO / BACKGROUND:
#         {story}

#         Internal design hints (do NOT reveal in answers):
#         {json.dumps(per_aspect, indent=2)}

#         Node IDs to fill:
#         {', '.join(batch_ids)}

#         Return JSON ONLY in this shape:
#         {{
#           "NODE_ID": {{
#             "text": "Action choice (imperative form)",
#             "narrative": "Short descriptive continuation"
#           }},
#           ...
#         }}

#         Rules:
#         - Write the 'text' field like a clear action the user might choose.
#         - Start with a verb (e.g., 'Hold', 'Issue', 'Suspend', 'Invite').
#         - 'narrative' continues the scene in a neutral, descriptive tone.
#         - Do NOT use first-person or third-person narration.
#         """)

#         cc = client.chat.completions.create(
#             model=MODEL_NAME,
#             messages=[
#                 {"role": "system", "content": sys_msg},
#                 {"role": "user", "content": usr}
#             ],
#             temperature=TEMPERATURE,
#         )

#         raw = cc.choices[0].message.content or ""
#         js = _extract_json_block(raw)
#         data = json.loads(js)

#         out_local = {}
#         for k in batch_ids:
#             v = data.get(k, {})
#             out_local[k] = {
#                 "text": _as_str(v.get("text", ""))[:250],
#                 "narrative": _as_str(v.get("narrative", ""))[:250],
#             }
#         return out_local

#     for i in range(0, len(node_ids), BATCH_SIZE):
#         chunk = node_ids[i:i+BATCH_SIZE]
#         result.update(one_batch(chunk))

#     return result

def apply_content(model, content_map):
    id2node = {n["id"]: n for n in model["nodes"]}
    for nid, c in content_map.items():
        n = id2node.get(nid)
        if not n:
            continue
        n["text"] = _as_str(c.get("text", n.get("text", "")))
        n["narrative"] = _as_str(c.get("narrative", n.get("narrative", "")))
        # data_explanation stays separate
    return model

# =========================
# Flatten for frontend
# =========================
def build_flat_with_hubs(model, aspect_map):
    """
    PROTOTYPE VERSION (2-tier)
    - 101 (root) → 101A/101B/101C → 201/202/203
    - 201/202/203 each → 3 options (A/B/C) → endings (E1/E2/E3)
    """

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
        # Safely extract numeric part
        num_part = "".join(ch for ch in str(hub_id) if ch.isdigit())
        return int(num_part) // 100 if num_part else 0

    def next_hub_id(hub_id: str, idx: int) -> str:
        # 101 -> 201/202/203 depending on index
        return f"{hub_bucket(hub_id) + 1}0{idx + 1}"

    def _s(x): return _as_str(x).strip()

    # def merged_desc(n):
    #     t = _s(n.get("text", ""))
    #     r = _s(n.get("narrative", ""))
    #     return f"{t}\n\n{r}" if t and r else (t or r or "Choose your next step.")

    def merged_desc(n, node_type):
        t = _s(n.get("text", ""))
        r = _s(n.get("narrative", ""))

        if node_type == "scenario":
            # Scenario nodes should show only the resulting situation (narrative)
            return r or t or "The situation progresses."

        if node_type == "option":
            # Option nodes show only the action
            return t or "Choose an action."

        # Endings & fallback
        return r or t or "Outcome."

    def expl_field(n, default_msg="Reflect on the implications of this decision."):
        e = _s(n.get("data_explanation", ""))
        return e or default_msg

    def clean_psych(v):
        return _as_str(v).strip().strip("[]\"' ")

    result = {}

    ROOT_ORIG = "scenario" if "scenario" in by_id else nodes[0]["id"]
    ROOT_HUB_ID = "101"

    # =========================================================
    # 🧩 Recursive builder
    # =========================================================
    def build(hub_id: str, origin_id: str, depth: int = 1):
        origin = by_id.get(origin_id, {})
        kid_ids = children.get(origin_id, [])[:3]  # up to 3 children
        option_ids = [fmt_opt_id(hub_id, letters[i]) for i in range(len(kid_ids))]

        # --- Hub node (Scenario) ---
        result[hub_id] = {
            "id": hub_id,
            "type": "scenario",
            "position": "",
            "data_description": merged_desc(origin,"scanario"),
            "data_explanation": expl_field(origin),
            "options": option_ids,
            "psych_dimensions": clean_psych(aspect_map.get(origin_id, "")),
        }

        # --- Option nodes ---
        for i, child_orig_id in enumerate(kid_ids):
            child = by_id.get(child_orig_id, {})
            opt_id = option_ids[i]

            # If this is the first hub (101 → 201/202/203)
            if depth == 1:
                next_hub = next_hub_id(hub_id, i)  # e.g. 201/202/203
                result[opt_id] = {
                    "id": opt_id,
                    "type": "option",
                    "position": "",
                    "data_description": merged_desc(child, "option"),
                    "data_explanation": "Proceed to the next scenario phase.",
                    "options": [],
                    "next": next_hub,
                    "psych_dimensions": clean_psych(aspect_map.get(child_orig_id, "")),
                }

                # recursively create the next hub (second tier)
                build(next_hub, child_orig_id, depth + 1)

            # If this is the second hub (201/202/203 → endings)
            else:
                eid = pick_ending_id()
                result[opt_id] = {
                    "id": opt_id,
                    "type": "option",
                    "position": "",
                    "data_description": merged_desc(child,"option"),
                    "data_explanation": "Your decision leads to this outcome.",
                    "options": [],
                    "next": eid,
                    "psych_dimensions": clean_psych(aspect_map.get(child_orig_id, "")),
                }

    # Build root
    build(ROOT_HUB_ID, ROOT_ORIG, depth=1)

    # --- Endings (same as before) ---
    ending_map = {
        "E1": ("✅ Successful Resolution", "The crisis is fully resolved, and relationships or goals are restored."),
        "E2": ("⚖️ Partial Recovery", "Some improvement achieved, but challenges or reputational impacts remain."),
        "E3": ("⚠️ Escalation", "The situation worsens and requires further intervention or external involvement."),
    }
    for e, (title, desc) in ending_map.items():
        result[e] = {
            "id": e,
            "type": "ending",
            "position": "",
            "data_description": title,
            "data_explanation": desc,
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

def _extract_first_image_bytes_from_gemini_response(response) -> Optional[bytes]:
    """
    Extract the first inline image payload from Gemini response.
    """
    if not hasattr(response, "candidates") or not response.candidates:
        return None

    cand = response.candidates[0]
    if not hasattr(cand, "content") or not hasattr(cand.content, "parts"):
        return None

    for p in cand.content.parts:
        if hasattr(p, "inline_data") and p.inline_data:
            blob = p.inline_data.data
            if isinstance(blob, str):
                try:
                    return base64.b64decode(blob)
                except Exception:
                    return None
            elif isinstance(blob, bytes):
                return blob
    return None

def _generate_single_image_file(prompt: str, file_path: Path) -> bool:
    """
    Generate a PNG with Gemini for `prompt` and save to file_path.
    """
    if not GEMINI_API_KEY:
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
            png_bytes = _fallback_png_real_bytes()
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(png_bytes)
            print(f"[image-gen] Saved fallback (no inline image) {file_path}")
            return False

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
    body = request.get_json(silent=True) or {}

    story = (body.get("story") or "").strip()
    if len(story) < 10:
        return jsonify({"error": "Provide a 'story' >=10 chars"}), 400

    tier_level = body.get("tier_level", 4)
    seed = body.get("psych_seed", PSYCH_SEED)

    download_flag = (
        bool(body.get("download")) or
        str(request.args.get("download", "")).lower() in {"1", "true"}
    )
    filename = body.get("filename") or f"flow_{int(time.time())}.json"

    try:
        # 1. Build raw branching structure
        model = build_full_skeleton(story, tier_level=tier_level)

        # 2. Assign psychological dimensions
        aspect_map = assign_aspects_unique_per_sibling(model, PSYCH_ASPECTS, seed)

        # 3. Identify *option* vs *scenario-state* nodes
        option_node_ids = [n["id"] for n in model["nodes"] if n.get("type") == "option"]
        scenario_state_ids = [
            n["id"] for n in model["nodes"]
            if n.get("type") == "scenario" and n["id"] != "scenario"
        ]

        # # 4. Generate content separately for clarity
        # opt_map = fill_content_for_nodes(story, option_node_ids, aspect_map, mode="action")
        # state_map = fill_content_for_nodes(story, scenario_state_ids, aspect_map, mode="state")

        # node_content_map = {**opt_map, **state_map}

        # # 5. Merge content back in
        # model = apply_content(model, node_content_map)
        option_node_ids = [n["id"] for n in model["nodes"] if n.get("type") == "option"]
        scenario_node_ids = [n["id"] for n in model["nodes"] if n.get("type") == "scenario" and n["id"] != "scenario"]

        # Generate action text for OPTION nodes
        option_content = fill_content_for_nodes(story, option_node_ids, aspect_map, mode="action")

        # Generate state descriptions for SCENARIO nodes
        scenario_content = fill_content_for_nodes(story, scenario_node_ids, aspect_map, mode="state")

        # Combine
        model = apply_content(model, {**option_content, **scenario_content})


        # 6. Convert to flattened hub form
        flat = build_flat_with_hubs(model, aspect_map)
        flat["startNodeId"] = "101"

        # 7. Optional download response
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

# @app.post("/generate")
# def generate():
#     """
#     Build the branching scenario JSON and return it.
#     Body:
#     {
#       "story": "...",         // required
#       "tier_level": 4,        // optional
#       "download": false,
#       "filename": "flow.json",
#       "psych_seed": 42
#     }
#     """
#     body = request.get_json(silent=True) or {}

#     story = (body.get("story") or "").strip()
#     if len(story) < 10:
#         return jsonify({"error": "Provide a 'story' >=10 chars"}), 400

#     print("\n=== 🧠 NEW GENERATION REQUEST ===")
#     print("Story input:", story[:200], "..." if len(story) > 200 else "")
#     tier_level = body.get("tier_level", 4)
#     seed = body.get("psych_seed", PSYCH_SEED)
#     download_flag = (
#         bool(body.get("download")) or
#         str(request.args.get("download", "")).lower() in {"1", "true"}
#     )
#     filename = body.get("filename") or f"flow_{int(time.time())}.json"

#     try:
#         # 1. Build raw skeleton
#         model = build_full_skeleton(story, tier_level=tier_level)

#         # 2. Assign psych aspects
#         aspect_map = assign_aspects_unique_per_sibling(model, PSYCH_ASPECTS, seed)

#         # 3. Generate text/narrative
#         non_ending_ids = [
#             n["id"] for n in model["nodes"]
#             if n.get("type") == "option"
#         ]

#         non_ending_ids = [
#             n["id"] for n in model["nodes"]
#             if n.get("type") != "ending" and n["id"] != "scenario" ]
#         node_content_map = fill_content_for_nodes(story, non_ending_ids, aspect_map)

#         # 4. Merge AI output into nodes
#         model = apply_content(model, node_content_map)

#         # 5. Flatten for frontend
#         flat = build_flat_with_hubs(model, aspect_map)
#         # ✅ Identify and include the root starting node for frontend focus
#         flat["startNodeId"] = "101"

#         # 6. Handle download
#         if download_flag:
#             payload = json.dumps(flat, indent=2, ensure_ascii=False)
#             resp = make_response(payload)
#             resp.headers["Content-Type"] = "application/json"
#             resp.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
#             return resp

#         return jsonify(flat)

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return jsonify({"error": str(e)}), 500


@app.post("/generate_images")
def generate_images_route():
    """
    Body:
    {
      "tmp": true,
      "nodes": [
        { "id": "101", "data_description": "..." },
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

        TMP_DIR.mkdir(parents=True, exist_ok=True)
        out_path = TMP_DIR / f"{nid}.png"
        _generate_single_image_file(desc, out_path)

        img_b64 = _file_to_b64(out_path)

        if not keep_tmp_files:
            try:
                out_path.unlink()
                print(f"[image-gen] Deleted {out_path} after encoding (tmp=false)")
            except Exception as e:
                print(f"[image-gen] WARN could not delete {out_path}: {e}")

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
#added /suggestions 
@app.post("/suggestions")
def suggestions():
    """
    Generate 3 short AI branching ideas for scenario design.
    Body:
    {
      "context": "Current scenario title or description"
    }
    """
    body = request.get_json(silent=True) or {}
    context = (body.get("context") or "").strip()

    if not OPENAI_API_KEY:
        return jsonify({"error": "OpenAI API key missing"}), 500
    if not context:
        return jsonify({"error": "Please provide 'context'"}), 400

    client = OpenAI(api_key=OPENAI_API_KEY)

    prompt = f"""
    You are a scenario design assistant. Suggest 3 concise, realistic
    branching decision points for a training simulation based on this context:

    "{context}"

    Return JSON only in this format:
    [
      {{ "nodeType": "option", "label": "..." }},
      {{ "nodeType": "option", "label": "..." }},
      {{ "nodeType": "option", "label": "..." }}
    ]
    """

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "You are a helpful scenario AI assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
    )

    raw = response.choices[0].message.content or ""
    json_text = _extract_json_block(raw)
    try:
        suggestions = json.loads(json_text)
    except Exception:
        suggestions = []

    return jsonify({"suggestions": suggestions})



if __name__ == "__main__":
    # You can switch to "0.0.0.0" if you want LAN access
    print("🚀 Backend server starting...")
    from datetime import datetime
    print(f"✅ Flask backend running properly at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🌐 Visit: http://127.0.0.1:5000/")
    app.run(host="127.0.0.1", port=5000, debug=True)
