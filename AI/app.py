# app.py
# Story -> AI-generated multi-branch flowchart with nodes shaped like:
# { "id": "...", "type": "process|decision|end", "text": "...", "narrative": "...", "scene": "..." }
# Exactly 3 endings (E1, E2, E3). Works with Responses API (+ fallback to Chat Completions).

import os, json, textwrap
from typing import Any, Dict, List, Set
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

app = Flask(__name__)

# --------------------------
# Helpers: fix/validate JSON
# --------------------------
def _ensure_three_endings(payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    end_nodes = [n for n in nodes if n.get("type") == "end"]
    target_ids = ["E1", "E2", "E3"]
    labels = ["Successful Resolution", "Partial Recovery", "Escalation"]

    rename_map = {}
    for i in range(3):
        if i < len(end_nodes):
            n = end_nodes[i]
            if n["id"] != target_ids[i]:
                rename_map[n["id"]] = target_ids[i]
                n["id"] = target_ids[i]
            # Make sure end nodes have text/narrative/scene
            n["text"] = f"{target_ids[i]} ({labels[i]})."
            n.setdefault("narrative", "Outcome summary and key consequences.")
            n.setdefault("scene", "Outcome debrief: email, meeting room, or public channel.")
        else:
            nodes.append({
                "id": target_ids[i],
                "type": "end",
                "text": f"{target_ids[i]} ({labels[i]}).",
                "narrative": "Outcome summary and key consequences.",
                "scene": "Outcome debrief: email, meeting room, or public channel."
            })

    extra_ids = [n["id"] for n in end_nodes[3:]]
    if extra_ids:
        nodes[:] = [n for n in nodes if not (n.get("type") == "end" and n["id"] in extra_ids)]

    for e in edges:
        if e.get("to") in rename_map:
            e["to"] = rename_map[e["to"]]

    for idx, e in enumerate(edges):
        if e.get("to") in extra_ids:
            e["to"] = target_ids[idx % 3]

    payload["nodes"] = nodes
    payload["edges"] = edges
    return payload

def _drop_bad_edges(payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    ids: Set[str] = {n["id"] for n in nodes}
    payload["edges"] = [e for e in edges if e.get("from") in ids and e.get("to") in ids]
    return payload

def _basic_validate(payload: Dict[str, Any]) -> None:
    if "nodes" not in payload or "edges" not in payload:
        raise ValueError("Missing 'nodes' or 'edges'.")
    if not isinstance(payload["nodes"], list) or not isinstance(payload["edges"], list):
        raise ValueError("'nodes' and 'edges' must be arrays.")
    node_ids = [n.get("id") for n in payload["nodes"] if isinstance(n, dict)]
    if len(node_ids) != len(set(node_ids)):
        raise ValueError("Node IDs must be unique.")

def _enforce_node_shape(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure every node has narrative & scene keys (even if model omitted them)."""
    for n in payload.get("nodes", []):
        n.setdefault("narrative", "")
        n.setdefault("scene", "")
    return payload

# --------------------------
# OpenAI call (Responses API + fallback)
# --------------------------
def call_openai(story: str, levels: List[int]) -> Dict[str, Any]:
    client = OpenAI(api_key=OPENAI_API_KEY)

    system_instructions = """You convert a user story into a branching flowchart JSON (nodes + edges).
Return ONLY JSON matching the schema. NO extra prose.

Graph shape and IDs:
- Create one 'scenario' node (id: "scenario", type: "process") with text "SCENARIO INTRODUCTION:\\n{story}".
- Create EXACTLY 3 decision nodes: D1, D2, D3 (type: "decision").
- EACH decision has EXACTLY 3 options: D1_A..D1_C, D2_A..D2_C, D3_A..D3_C (type: "process").
- EACH option has EXACTLY 3 sub-options: e.g., D1_A_1..D1_A_3 (type: "process").
- EACH sub-option has EXACTLY 3 sub-sub options: e.g., D1_A_1_a..D1_A_1_c (type: "process").
- Create EXACTLY 3 end nodes: E1, E2, E3 (type: "end").
- Edges: scenario -> D* -> D*_A/B/C -> ..._1/2/3 -> ..._a/b/c -> E*.
- Every leaf (sub-sub option) MUST connect to one of E1/E2/E3.
- All edges must reference existing node ids.
- Keep 'text' <= 120 chars.

Node content FORMAT (for ALL nodes):
- Include 'text' (short label), 'narrative' (1–2 sentence micro-story/intent), and 'scene' (brief setting/visual).
- Use 'type' in {"process","decision","end"}.
"""

    user_input = textwrap.dedent(f"""
    STORY: {story.strip()}
    BRANCHING SHAPE: {levels} (expected [3,3,3,3])
    ENDINGS: exactly 3 (E1, E2, E3).
    """)

    json_schema = {
        "name": "flowchart",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["nodes", "edges"],
            "properties": {
                "nodes": {
                    "type": "array",
                    "minItems": 10,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["id", "type", "text"],
                        "properties": {
                            "id": {"type": "string"},
                            "type": {"type": "string", "enum": ["process", "decision", "end"]},
                            "text": {"type": "string", "maxLength": 200},
                            "narrative": {"type": "string"},
                            "scene": {"type": "string"},
                            "image": {"type": "string"},
                            "b64": {"type": "string"}
                        }
                    }
                },
                "edges": {
                    "type": "array",
                    "minItems": 10,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["from", "to"],
                        "properties": {
                            "from": {"type": "string"},
                            "to": {"type": "string"},
                            "label": {"type": "string"}
                        }
                    }
                }
            }
        }
    }

    # Try Responses API (new SDKs)
    try:
        resp = client.responses.create(
            model=MODEL_NAME,
            instructions=system_instructions,
            input=user_input,
            response_format={"type": "json_schema", "json_schema": json_schema},
            temperature=0.6,
            max_output_tokens=4000
        )
        text_out = getattr(resp, "output_text", None) or resp.output[0].content[0].text
        data = json.loads(text_out)

    # Fallback: Chat Completions for older SDKs
    except TypeError:
        cc = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_input}
            ],
            # Older SDKs: guarantee JSON object (we'll enforce shape after)
            response_format={"type": "json_object"},
            temperature=0.6
        )
        data = json.loads(cc.choices[0].message.content)

    # Normalize
    data = _ensure_three_endings(data)
    data = _drop_bad_edges(data)
    data = _enforce_node_shape(data)  # make sure narrative + scene always exist
    _basic_validate(data)
    return data

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
      "story": "user-provided scenario text",   // REQUIRED (>=10 chars)
      "levels": [3,3,3,3]                       // OPTIONAL (for prompt context)
    }
    """
    body = request.get_json(silent=True) or {}
    story = (body.get("story") or "").strip()
    levels = body.get("levels") or [3, 3, 3, 3]

    if len(story) < 10:
        return jsonify({"error": "Provide a 'story' with at least 10 characters."}), 400
    if not OPENAI_API_KEY:
        return jsonify({"error": "OPENAI_API_KEY not set."}), 500

    try:
        data = call_openai(story, levels)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
