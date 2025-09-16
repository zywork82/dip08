import os, json, textwrap
from typing import Any, Dict, List, Set
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# OpenAI SDK (v1+)
from openai import OpenAI

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

app = Flask(__name__)

# --------------------------
# Helpers: fix/validate JSON
# --------------------------
def _ensure_three_endings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Force exactly E1,E2,E3; remap edges accordingly."""
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    # Gather end nodes
    end_nodes = [n for n in nodes if n.get("type") == "end"]
    target = ["E1", "E2", "E3"]

    rename_map = {}
    # Ensure at least 3 ends and rename first 3 to E1..E3
    labels = ["Successful Resolution", "Partial Recovery", "Escalation"]
    for i in range(3):
        if i < len(end_nodes):
            n = end_nodes[i]
            if n["id"] != target[i]:
                rename_map[n["id"]] = target[i]
                n["id"] = target[i]
            n["text"] = f"{target[i]} ({labels[i]}): Auto-labeled ending."
        else:
            nodes.append({
                "id": target[i],
                "type": "end",
                "text": f"{target[i]} ({labels[i]}): Auto-labeled ending."
            })

    # Remove extra ends beyond 3
    extra_ids = [n["id"] for n in end_nodes[3:]]
    if extra_ids:
        nodes[:] = [n for n in nodes if not (n.get("type") == "end" and n["id"] in extra_ids)]

    # Apply renames in edges
    for e in edges:
        if e.get("to") in rename_map:
            e["to"] = rename_map[e["to"]]

    # Redirect any edges that still point to removed ends
    for idx, e in enumerate(edges):
        if e.get("to") in extra_ids:
            e["to"] = target[idx % 3]

    payload["nodes"] = nodes
    payload["edges"] = edges
    return payload

def _drop_bad_edges(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Drop edges that reference unknown node ids."""
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

# --------------------------
# OpenAI call (supports new & old SDKs)
# --------------------------
def call_openai(story: str, levels: List[int]) -> Dict[str, Any]:
    """
    Tries the Responses API (new SDKs). If it raises a TypeError for 'response_format',
    falls back to Chat Completions (older SDKs).
    """
    client = OpenAI(api_key=OPENAI_API_KEY)

    system_instructions = """You turn a user story into a branching flowchart JSON (nodes + edges).
Return ONLY JSON (no prose) that matches the provided schema.

Create:
- scenario node (id: "scenario", type: "process") with text "SCENARIO INTRODUCTION:\\n{story}"
- exactly 3 decisions: D1, D2, D3 (type: "decision")
- each decision has exactly 3 options: D1_A..D1_C, D2_A..D2_C, D3_A..D3_C (type: "process")
- each option has exactly 3 sub-options: e.g., D1_A_1..D1_A_3 (type: "process")
- each sub-option has exactly 3 sub-sub options: e.g., D1_A_1_a..D1_A_1_c (type: "process")
- create exactly 3 end nodes: E1, E2, E3 (type: "end")
Connect edges like:
scenario -> D* -> D*_A/B/C -> ..._1/2/3 -> ..._a/b/c -> E*
Every leaf (sub-sub option) must connect to one of E1/E2/E3.
IDs must follow those patterns. All edges must reference existing node ids.
Keep 'text' short (<= 120 chars). You may add 'narrative' to process nodes.
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

    # --- Prefer Responses API (new SDKs) ---
    try:
        resp = client.responses.create(
            model=MODEL_NAME,
            # The new API prefers 'instructions' + 'input' (not 'messages')
            instructions=system_instructions,
            input=user_input,
            response_format={"type": "json_schema", "json_schema": json_schema},
            temperature=0.6,
            max_output_tokens=4000
        )
        text_out = getattr(resp, "output_text", None)
        if not text_out:
            # Older sub-variants of the SDK need this access
            text_out = resp.output[0].content[0].text
        data = json.loads(text_out)

    # --- If your SDK is older it may raise TypeError about response_format ---
    except TypeError:
        cc = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_input}
            ],
            # Older SDKs generally support at least json_object mode:
            response_format={"type": "json_object"},
            temperature=0.6
        )
        data = json.loads(cc.choices[0].message.content)

    # normalize to exactly E1..E3 and clean any stray edges
    data = _ensure_three_endings(data)
    data = _drop_bad_edges(data)
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
      "levels": [3,3,3,3]                       // OPTIONAL (kept for prompting context)
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
    print("Using OpenAI SDK version:", OpenAI.__module__.split('.')[0])  # quick sanity print
    app.run(host="127.0.0.1", port=5000, debug=True)
