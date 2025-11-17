import os, json, textwrap, time, re, random, base64, concurrent.futures, time
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
from analytics import analytics_bp
from login import login_bp
from concurrent.futures import ThreadPoolExecutor
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
GENERATION_RETRIES = {}

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

app.register_blueprint(analytics_bp)


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

def generate_story_endings(story: str) -> Dict[str, Dict[str, str]]:
    """
    Use OpenAI to create 3 story-specific endings:
    - E1 = best-case outcome
    - E2 = mixed / partial recovery
    - E3 = worst-case / escalation

    Returns:
    {
      "E1": {"title": "...", "description": "..."},
      "E2": {...},
      "E3": {...}
    }
    """
    if not OPENAI_API_KEY:
        return {}

    client = OpenAI(api_key=OPENAI_API_KEY)

    sys_msg = (
        "You design final outcomes for a branching training simulation.\n"
        "- E1: clearly the best-case resolution.\n"
        "- E2: mixed / partial recovery.\n"
        "- E3: worst-case escalation.\n"
        "- Titles <= 60 chars, descriptions <= 200 chars.\n"
        "- Do NOT use bullet points. No line breaks inside each field.\n"
        "- Keep it consistent with the scenario's storyline.\n"
    )

    usr = textwrap.dedent(f"""
    Scenario background:

    {story}

    Create 3 distinct final outcomes (best, mixed, worst) that make
    sense for this scenario and could plausibly follow from different
    decision paths.

    Return ONLY valid JSON in this exact format:

    {{
      "E1": {{
        "title": "Best-case outcome title",
        "description": "Best-case outcome summary."
      }},
      "E2": {{
        "title": "Mixed outcome title",
        "description": "Mixed outcome summary."
      }},
      "E3": {{
        "title": "Worst-case outcome title",
        "description": "Worst-case outcome summary."
      }}
    }}
    """)

    try:
        resp = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user",  "content": usr},
            ],
            temperature=0.5,
        )
        raw = resp.choices[0].message.content or ""
        js = _extract_json_block(raw)
        data = json.loads(js)

        out = {}
        for eid in ["E1", "E2", "E3"]:
            v = data.get(eid, {}) or {}
            out[eid] = {
                "title": _as_str(v.get("title", "")).strip()[:60] or eid,
                "description": _as_str(v.get("description", "")).strip()[:200],
            }
        return out
    except Exception as e:
        print("[ending-gen] Error generating endings:", e)
        return {}

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
def build_flat_with_hubs(model, aspect_map, ending_overrides=None):
    """
    Flattens hierarchical AI skeleton into a clean branching structure:
      SCENARIO (101) -> OPTION (101A/B/C) -> SCENARIO (201/202/203) -> ... -> ENDING (E1/E2/E3)

    Behavior:
      - Root scenario (101): shows a clean intro paragraph (no question).
      - Other scenarios: show a short description derived from the *previous option*,
        then a reflective question on the next line.
      - Options: action-only text.
      - Endings: use story-specific overrides if provided, else defaults.
    """
    nodes = model["nodes"]
    edges = model["edges"]

    # --- Graph maps ---
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

    by_id, children, parents = _build_maps(nodes, edges)

    # --- Helpers ---
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
        num_part = "".join(ch for ch in str(hub_id) if ch.isdigit())
        return int(num_part) // 100 if num_part else 0

    def next_hub_id(hub_id: str, idx: int) -> str:
        return f"{hub_bucket(hub_id)+1}0{idx+1}"

    def _s(x): return _as_str(x).strip()

    def get_text(n): return _s((n or {}).get("text", ""))
    def get_narr(n): return _s((n or {}).get("narrative", ""))

    def make_question(base_text: str) -> str:
        """Turn a sentence into a short reflective question."""
        if not base_text:
            return "What will you do next?"
        base = base_text.strip().rstrip(".!?")
        lower = base.lower()
        if lower.startswith(("you ", "the team", "leadership", "staff")):
            return f"How will you respond now that {base[0].lower() + base[1:]}?"
        if "situation" in lower:
            return f"What should be your next move, given that {base}?"
        if len(base.split()) < 6:
            return f"What happens next regarding {base.lower()}?"
        return f"How should you handle the fact that {base.lower()}?"

    def root_intro_from_node(n):
        """For 101: show only a clean intro (no question)."""
        raw = get_text(n) or get_narr(n)
        if not raw:
            return "You are about to enter a scenario."
        tmp = raw.lstrip()
        if tmp.lower().startswith("introduction:"):
            tmp = tmp[len("Introduction:"):].lstrip()
        if "\n" in tmp:
            _, rest = tmp.split("\n", 1)
            tmp = rest.strip() or tmp.strip()
        return tmp or raw

    def clean_psych(val):
        return _s(val).strip("[]\"' ")

    def merged_desc(n, node_type: str, is_root: bool = False, prev_opt: Optional[Dict[str, Any]] = None):
        """
        - Root scenario: intro paragraph.
        - Other scenarios: description from previous *option* + reflective question.
        - Options: action-only text.
        """
        t = get_text(n)
        r = get_narr(n)

        if node_type == "scenario":
            if is_root:
                return root_intro_from_node(n)

            # Prefer description from the *previous option* that led here
            prev_t = get_text(prev_opt)
            prev_r = get_narr(prev_opt)
            description = (prev_r or prev_t or r or t or "The situation evolves further.").strip()

            # Seed the question from current scenario; if missing, fall back to previous option phrasing
            question_seed = (r or t or prev_r or prev_t)
            question = make_question(question_seed)

            return f"{description}\n\n{question}"

        if node_type == "option":
            return t or "Choose an action."

        # endings, fallback
        return r or t or "Outcome."

    result: Dict[str, Any] = {}

    ROOT_ORIG = "scenario" if "scenario" in by_id else nodes[0]["id"]
    ROOT_HUB_ID = "101"

    # --- Recursive builder ---
    def build(hub_id: str, hub_origin_id: str):
        origin_node = by_id.get(hub_origin_id, {})
        child_ids = children.get(hub_origin_id, [])[:3]
        if not child_ids:
            # safety: synthesize 3 children if none (keeps shape stable)
            child_ids = [f"{hub_origin_id}_child_{i}" for i in range(3)]
        option_ids = [fmt_opt_id(hub_id, letters[i]) for i in range(len(child_ids))]

        # Identify the *option* that led to this scenario (if any)
        prev_opt_node = None
        if hub_origin_id != "scenario":
            for pid in parents.get(hub_origin_id, []):
                if by_id.get(pid, {}).get("type") == "option":
                    prev_opt_node = by_id.get(pid)
                    break

        # --- SCENARIO hub node ---
        is_root = (hub_id == ROOT_HUB_ID and hub_origin_id == "scenario")
        result[hub_id] = {
            "id": hub_id,
            "type": "scenario",
            "position": "",
            "data_description": merged_desc(origin_node, "scenario", is_root=is_root, prev_opt=prev_opt_node),
            "options": option_ids,
            "psych_dimensions": clean_psych(aspect_map.get(hub_origin_id, "")),
        }

        # --- OPTION nodes under this hub ---
        for i, child_orig_id in enumerate(child_ids):
            opt_id = fmt_opt_id(hub_id, letters[i])
            child_node = by_id.get(child_orig_id, {})
            grandkids = children.get(child_orig_id, [])
            non_ending_grandkids = [g for g in grandkids if by_id.get(g, {}).get("type") != "ending"]

            if not non_ending_grandkids:
                next_target = pick_ending_id()
            else:
                next_target = next_hub_id(hub_id, i)
                build(next_target, child_orig_id)

            desc = merged_desc(child_node, "option")
            if not desc:
                desc = "Your decision guides the next phase." if non_ending_grandkids else "This choice concludes the scenario."

            result[opt_id] = {
                "id": opt_id,
                "type": "option",
                "position": "",
                "data_description": desc,
                "options": [],
                "next": next_target,
                "psych_dimensions": clean_psych(aspect_map.get(child_orig_id, "")),
            }

    # Build from root
    build(ROOT_HUB_ID, ROOT_ORIG)

    # --- Endings (defaults + optional overrides) ---
    default_ending_map = {
        "E1": ("✅ Successful Resolution", "The crisis is fully resolved, and relationships or goals are restored."),
        "E2": ("⚖️ Partial Recovery",     "Some improvement achieved, but challenges or reputational impacts remain."),
        "E3": ("⚠️ Escalation",           "The situation worsens and requires further intervention or external involvement."),
    }

    merged_ending_map: Dict[str, Dict[str, str]] = {}
    for eid, (fallback_title, fallback_desc) in default_ending_map.items():
        if ending_overrides and eid in ending_overrides:
            custom = ending_overrides[eid] or {}
            title = _s(custom.get("title", fallback_title)) or fallback_title
            desc  = _s(custom.get("description", fallback_desc)) or fallback_desc
        else:
            title, desc = fallback_title, fallback_desc
        merged_ending_map[eid] = {"title": title, "description": desc}

    for e in ENDING_IDS:
        em = merged_ending_map[e]
        result[e] = {
            "id": e,
            "type": "ending",
            "position": "",
            "data_description": em["description"],  # full outcome sentence
            "data_explanation": em["title"],        # short label
            "options": [],
            "psych_dimensions": clean_psych(aspect_map.get(e, "")),
        }

    # Safety net: ensure every option leads somewhere
    for node in list(result.values()):
        if node["type"] == "option" and not node.get("next"):
            node["next"] = pick_ending_id()

    # Starting node for the frontend
    result["startNodeId"] = "101"
    return result

# =========================
# IMAGE GENERATION CORE
# =========================
def _fallback_png_real_bytes() -> bytes:
    """
    Fallback: generate a visible placeholder PNG (not 1x1).
    This makes it obvious when Gemini didn't return a real image.
    """
    img = Image.new("RGB", (512, 320), (30, 30, 30))  # dark gray card
    buff = BytesIO()
    img.save(buff, format="PNG")
    return buff.getvalue()

def _extract_first_image_bytes_from_gemini_response(response) -> Optional[bytes]:
    """
    Extract the first inline image payload from a Gemini response.
    Works for typical google-generativeai response structures.
    """
    try:
        candidates = getattr(response, "candidates", []) or []
        for cand in candidates:
            content = getattr(cand, "content", None)
            parts = getattr(content, "parts", None) if content else None
            if not parts:
                continue
            for part in parts:
                inline = getattr(part, "inline_data", None)
                if not inline:
                    continue
                data = getattr(inline, "data", None)
                if isinstance(data, str):
                    # base64 string from Gemini
                    return base64.b64decode(data)
                if isinstance(data, (bytes, bytearray)):
                    return bytes(data)
        return None
    except Exception as e:
        print(f"[extract] ERROR parsing Gemini response: {e}")
        return None

def _generate_single_image_file(prompt: str, file_path: Path, max_retries: int = 4, delay: float = 2.0) -> bool:
    """
    Generate a PNG with Gemini for `prompt` and save to file_path.
    Retries up to `max_retries` times only for that specific node.

    Returns:
        True  -> real image successfully generated
        False -> fallback placeholder used
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)

    if not GEMINI_API_KEY:
        png_bytes = _fallback_png_real_bytes()
        with open(file_path, "wb") as f:
            f.write(png_bytes)
        print(f"[image-gen] ❌ No GEMINI_API_KEY set, using fallback for {file_path.name}")
        return False

    # 🔑 Force a consistent, non-animated style for ALL nodes
    style_prefix = (
        "Cinematic, photorealistic photo, realistic lighting, high detail, "
        "Match the environment to the scenario context. No text, not illustration,"
        # "professional corporate / hospital environment, no text, not illustration, "
        "not cartoon, not flat art. Scene description: "
    )
    styled_prompt = style_prefix + prompt

    for attempt in range(1, max_retries + 1):
        # Track failures globally per file (helps frontend avoid infinite loops)
        GENERATION_RETRIES.setdefault(file_path.name, 0)
        GENERATION_RETRIES[file_path.name] += 1

        try:
            print(f"[image-gen] 🔁 Attempt {attempt}/{max_retries} for {file_path.name}")

            model = genai.GenerativeModel(GEMINI_IMAGE_MODEL)
            # Back to your original working call style
            response = model.generate_content(styled_prompt)

            raw_bytes = _extract_first_image_bytes_from_gemini_response(response)
            if not raw_bytes:
                raise RuntimeError("No inline image returned from Gemini")

            img = Image.open(BytesIO(raw_bytes))
            img.load()

            buff = BytesIO()
            img.save(buff, format="PNG")
            png_bytes = buff.getvalue()

            with open(file_path, "wb") as f:
                f.write(png_bytes)

            print(f"[image-gen] ✅ Success after {attempt} tries for {file_path.name}")
            return True

        except Exception as e:
            print(f"[image-gen] ⚠️ Attempt {attempt} failed for {file_path.name}: {e}")
            if attempt < max_retries:
                time.sleep(delay)
    
    # All retries failed → fallback
    print(f"[image-gen] ❌ All {max_retries} attempts failed for {file_path.name}. Using fallback.")
    png_bytes = _fallback_png_real_bytes()
    with open(file_path, "wb") as f:
        f.write(png_bytes)
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
        # 1. Build raw branching structure (depth controlled by tier_level)
        model = build_full_skeleton(story, tier_level=tier_level)

        # 2. Assign psychological dimensions
        aspect_map = assign_aspects_unique_per_sibling(model, PSYCH_ASPECTS, seed)

        # 3. Identify *option* vs *scenario-state* nodes
        option_node_ids = [n["id"] for n in model["nodes"] if n.get("type") == "option"]
        scenario_node_ids = [
            n["id"] for n in model["nodes"]
            if n.get("type") == "scenario" and n["id"] != "scenario"
        ]

        # 4. Generate content separately for clarity
        #    - actions for OPTION nodes
        #    - state descriptions for SCENARIO nodes
        option_content = fill_content_for_nodes(
            story, option_node_ids, aspect_map, mode="action"
        )
        scenario_content = fill_content_for_nodes(
            story, scenario_node_ids, aspect_map, mode="state"
        )

        # 5. Merge AI content back into the model
        model = apply_content(model, {**option_content, **scenario_content})

        # 6. Generate story-specific endings (E1/E2/E3)
        ending_overrides = generate_story_endings(story)

        # 7. Convert to flattened hub form (with custom endings)
        flat = build_flat_with_hubs(model, aspect_map, ending_overrides=ending_overrides)
        flat["startNodeId"] = "101"

        # 8. Optional download response
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
    Generate images ONLY for nodes where type == 'scenario' or 'ending'.
    Skip all other types completely — no Gemini call, no PNG, no entry in output.
    """
    body = request.get_json(silent=True) or {}
    keep_tmp_files = bool(body.get("tmp", False))
    nodes = body.get("nodes", [])
    if not nodes:
        return jsonify({"error": "No nodes provided"}), 400

    TMP_DIR.mkdir(parents=True, exist_ok=True)

    allowed_types = {"scenario", "ending"}  # ✅ only these types generate images

    # Clean out existing tmp directory before generating
    for f in TMP_DIR.glob("*.png"):
        try:
            f.unlink()
        except Exception:
            pass

    def gen_one(node):
        nid = _as_str(node.get("id", "")).strip()
        node_type = _as_str(node.get("type", "")).lower().strip()
        desc = _as_str(node.get("data_description", "")).strip()

        # 🚫 Hard skip anything not in allowed types
        if node_type not in allowed_types:
            print(f"[image-gen] ❌ Skipping {nid} (type={node_type}) — no file will be generated.")
            return None

        if not nid or not desc:
            print(f"[image-gen] ❌ Skipping node with missing id/description: {node}")
            return None

        try:
            out_path = TMP_DIR / f"{nid}.png"
            _generate_single_image_file(desc, out_path)
            img_b64 = _file_to_b64(out_path)

            # if not keep_tmp_files:
            #     out_path.unlink(missing_ok=True)
            # Do NOT delete the file – allow frontend to reuse cached PNGs
            pass

            print(f"[image-gen] ✅ Generated image for {nid} ({node_type})")
            return {
                "id": nid,
                "type": node_type,
                "data_description": desc,
                "image_b64": img_b64,
            }

        except Exception as e:
            print(f"[image-gen] ⚠️ Error generating image for {nid}: {e}")
            return None

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(filter(None, executor.map(gen_one, nodes)))

    print(f"[image-gen] ✅ Done. Generated {len(results)} valid images.")
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
    print("🚀 Backend server starting with threaded mode...")
    from datetime import datetime
    print(f"✅ Flask backend running properly at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🌐 Visit: http://127.0.0.1:5000/")
    app.run(host="127.0.0.1", port=5000, debug=True, threaded=True)
