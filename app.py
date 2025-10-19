import os, json, textwrap, time, re, random
from pathlib import Path
from typing import Any, Dict, List, Set, Optional
from flask_cors import CORS 
from flask import Flask, request, jsonify, make_response, send_from_directory
from dotenv import load_dotenv
from openai import OpenAI

# =========================
# .env loading
# =========================
ENV_PATH = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

# --- OpenAI ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

print("[env] OPENAI_API_KEY set:", bool(OPENAI_API_KEY))
print("[env] MODEL_NAME:", MODEL_NAME)

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
CORS(app) 
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
        "narrative": ""
    })

    # top “decisions” as options
    decisions = ["D1", "D2", "D3"]
    for d in decisions:
        nodes.append({"id": d, "type": "option", "text": f"{d}: decision", "narrative": ""})
        edges.append({"from": "scenario", "to": d})

    letters = ["A", "B", "C"]
    nums = ["1", "2", "3"]
    subletters = ["a", "b", "c"]

    option_nodes = []
    for d in decisions:
        for L in letters:
            oid = f"{d}_{L}"
            nodes.append({"id": oid, "type": "option", "text": f"{oid}: option", "narrative": ""})
            edges.append({"from": d, "to": oid})
            option_nodes.append(oid)

    suboption_nodes = []
    for oid in option_nodes:
        for n in nums:
            sid = f"{oid}_{n}"
            nodes.append({"id": sid, "type": "option", "text": f"{sid}: sub-option", "narrative": ""})
            edges.append({"from": oid, "to": sid})
            suboption_nodes.append(sid)

    leaf_nodes = []
    for sid in suboption_nodes:
        for sl in subletters:
            lid = f"{sid}_{sl}"
            nodes.append({"id": lid, "type": "option", "text": f"{lid}: sub-sub option", "narrative": ""})
            edges.append({"from": sid, "to": lid})
            leaf_nodes.append(lid)

    # endings
    ends = ["E1", "E2", "E3"]
    for e in ends:
        nodes.append({
            "id": e,
            "type": "ending",
            "text": f"{e}: Ending",
            "narrative": "Outcome summary and key consequences."
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
                "narrative": "Outcome summary and key consequences."
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
        n.setdefault("text", "")
        n["narrative"] = _as_str(n.get("narrative"))
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
# Flat hubs builder (no scene, no images)
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
            "options": hub_option_ids,
            "psych_dimensions": aspect_map.get(hub_origin_id, "")
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
                    "options": [],
                    "psych_dimensions": aspect_map.get(child_orig_id, "")
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
                "options": next_opt_ids,
                "psych_dimensions": aspect_map.get(child_orig_id, "")
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
            "options": [],
            "psych_dimensions": aspect_map.get(root_orig, "")
        }

    return result

# --------------------------
# OpenAI fill (chunked) — uses aspect_map only (no scenes)
# --------------------------
def fill_content_for_nodes(story: str,
                           node_ids: List[str],
                           aspect_map: Dict[str, str]) -> Dict[str, Dict[str, str]]:
    """Write text/narrative reflecting psychological aspects. No scene field."""
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set.")
    client = OpenAI(api_key=OPENAI_API_KEY)
    result: Dict[str, Dict[str, str]] = {}

    def one_batch(batch_ids: List[str]) -> Dict[str, Dict[str, str]]:
        per_batch_aspects = {nid: aspect_map.get(nid, "") for nid in batch_ids}

        sys = (
            "You fill content for nodes in a branching learning scenario.\n"
            "- For each NODE_ID, write fields that REFLECT its psychological aspect.\n"
            "- Return ONLY pure JSON, exactly this shape:\n"
            "{\n"
            '  \"NODE_ID\": {\"text\": \"...\", \"narrative\": \"...\"},\n'
            '  \"...\": {...}\n'
            "}\n"
            "- Keep each field <=120 chars. All values must be strings."
        )
        ids_serial = ", ".join(batch_ids)
        usr = textwrap.dedent(f"""
        STORY:
        {story}

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
    return model

# --------------------------
# Routes
# --------------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/generate")
def generate():
    """
    Body:
    {
      "story": "...",     // REQUIRED (>=10 chars)
      "download": true,   // OPTIONAL (or ?download=1)
      "filename": "flow.json", // OPTIONAL
      "psych_seed": 42    // OPTIONAL -> deterministic aspect assignment
    }
    """
    body = request.get_json(silent=True) or {}
    story = (body.get("story") or "").strip()
    download_flag = str(request.args.get("download", "")).lower() in {"1","true","yes"} or bool(body.get("download"))
    filename = (body.get("filename") or f"flowchart_{int(time.time())}.json").strip() or f"flowchart_{int(time.time())}.json"

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

        # 3) Fill content with aspects (no scenes)
        node_ids = [n["id"] for n in model["nodes"] if n.get("type") != "ending"]
        content_map = fill_content_for_nodes(story, node_ids, aspect_map)

        # 4) Merge + sanitize + validate
        model = apply_content(model, content_map)
        model = _ensure_three_endings(model)
        model = _drop_bad_edges(model)
        model = _enforce_node_shape(model)
        model = _coerce_node_types(model)
        _basic_validate(model)

        # 5) Flat with terminal options as endings (no scenes/b64)
        flat = build_flat_with_hubs(model, aspect_map)

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
