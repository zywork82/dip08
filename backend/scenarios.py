from flask import Blueprint, request, jsonify
from db import db
from datetime import datetime
from bson import ObjectId

scenarios_bp = Blueprint("scenarios", __name__, url_prefix="/scenarios")

# =========================================================
# ✅ Create scenario (POST) & List all (GET)
# =========================================================
@scenarios_bp.route("/", methods=["GET", "POST", "OPTIONS"])
def scenarios_root():
    if request.method == "OPTIONS":
        return '', 200

    # --- Create new scenario ---
    if request.method == "POST":
        try:
            data = request.get_json() or {}
            title = data.get("title", "Untitled Scenario")
            description = data.get("description", "")
            created_at = datetime.utcnow()

            doc = {
                "title": title,
                "description": description,
                "status": "Draft",
                "createdAt": created_at.isoformat(),
                "lastEdited": created_at.isoformat(),
            }

            result = db.scenarios.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
            return jsonify({"success": True, "scenario": doc}), 201

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # --- Get all scenarios ---
    if request.method == "GET":
        try:
            scenarios = list(db.scenarios.find({}))
            for s in scenarios:
                s["_id"] = str(s["_id"])
                if "lastEdited" in s:
                    s["lastEdited"] = s["lastEdited"][:10]
            return jsonify(scenarios)
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500


# =========================================================
# ✅ Save Flow (upsert nodes with consistent data format)
# =========================================================
@scenarios_bp.route("/saveFlow", methods=["POST"])
def save_flow():
    try:
        flow = request.get_json() or {}
        now = datetime.utcnow()
        scenario_id = flow.get("id")

        # --- Create or update main scenario document ---
        scenario_doc = {
            "title": flow.get("title", "Untitled Scenario"),
            "status": flow.get("status", "Edit"),
            "image": flow.get("image"),
            "lastEdited": now.isoformat(),
            "startNodeId": flow.get("startNodeId"),
        }

        if scenario_id:
            db.scenarios.update_one(
                {"_id": ObjectId(scenario_id)},
                {"$set": scenario_doc},
                upsert=False
            )
            scenario_oid = ObjectId(scenario_id)
        else:
            scenario_oid = db.scenarios.insert_one(scenario_doc).inserted_id

        # --- Upsert nodes ---
        for node in flow.get("nodes", []):
            raw_data = node.get("data", {})
            # 🧠 Normalize node.data into consistent object form
            if isinstance(raw_data, str):
                formatted_data = {
                    "data_description": raw_data,
                    "options": node.get("options", []),
                    "next": node.get("next", None),
                    "scene": "",
                    "b64image": ""
                }
            else:
                formatted_data = {
                    "data_description": raw_data.get("data_description", node.get("description", "")),
                    "options": raw_data.get("options", node.get("options", [])),
                    "next": raw_data.get("next", node.get("next", None)),
                    "scene": raw_data.get("scene", ""),
                    "b64image": raw_data.get("b64image", "")
                }

            node_doc = {
                "id": node.get("id"),
                "type": node.get("type"),
                "data": formatted_data,
                "psych_dimensions": node.get("psych_dimensions", ""),
                "position": node.get("position", {}),
                "scenarioId": scenario_oid
            }

            db.scenarioNodes.update_one(
                {"id": node_doc["id"], "scenarioId": scenario_oid},
                {"$set": node_doc},
                upsert=True
            )

        return jsonify({
            "success": True,
            "message": f"Scenario '{flow.get('title', 'Untitled Scenario')}' saved successfully.",
            "nodesSaved": len(flow.get("nodes", [])),
            "edgesSaved": len(flow.get("edges", [])),
            "scenarioId": str(scenario_oid),
        }), 200

    except Exception as e:
        print("Error saving flow:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================
# ✅ List scenarios (summary)
# =========================================================
@scenarios_bp.route("/list", methods=["GET"])
def list_scenarios():
    try:
        scenarios = []
        for s in db.scenarios.find():
            scenarios.append({
                "id": str(s["_id"]),
                "title": s.get("title", "Untitled Scenario"),
                "status": s.get("status", "Draft"),
                "lastEdited": s.get("lastEdited"),
                "image": s.get("image"),
            })
        return jsonify(scenarios)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# ✅ Get full flow (ReactFlow-ready, builds edges)
# =========================================================
@scenarios_bp.route("/getFlow/<scenario_id>", methods=["GET"])
def get_flow(scenario_id):
    try:
        scenario = db.scenarios.find_one({"_id": ObjectId(scenario_id)})
        if not scenario:
            return jsonify({"error": "Scenario not found"}), 404

        nodes = list(db.scenarioNodes.find({"scenarioId": ObjectId(scenario_id)}))
        edges = []

        for n in nodes:
            # --- Backward compatibility for old flat nodes ---
            data_field = n.get("data", {})
            if isinstance(data_field, str):
                n["data"] = {
                    "data_description": data_field,
                    "options": n.get("options", []),
                    "next": n.get("next", None),
                    "scene": "",
                    "b64image": ""
                }
            else:
                n["data"] = {
                    "data_description": data_field.get("data_description", n.get("description", "")),
                    "options": data_field.get("options", n.get("options", [])),
                    "next": data_field.get("next", n.get("next", None)),
                    "scene": data_field.get("scene", ""),
                    "b64image": data_field.get("b64image", "")
                }

            # --- Build edges ---
            for opt_id in n["data"].get("options", []):
                edges.append({
                    "id": f"e-{n['id']}-{opt_id}",
                    "source": n["id"],
                    "target": opt_id,
                    "type": "smoothstep",
                    "animated": True
                })
            if n["data"].get("next"):
                edges.append({
                    "id": f"e-{n['id']}-{n['data']['next']}",
                    "source": n["id"],
                    "target": n["data"]["next"],
                    "type": "smoothstep",
                    "animated": True
                })

            n["_id"] = str(n["_id"])
            n["scenarioId"] = str(n["scenarioId"])

        flow_data = {
            "id": str(scenario["_id"]),
            "title": scenario.get("title"),
            "description": scenario.get("description"),
            "status": scenario.get("status"),
            "image": scenario.get("image"),
            "startNodeId": scenario.get("startNodeId"),
            "nodes": nodes,
            "edges": edges,
        }
        return jsonify(flow_data), 200

    except Exception as e:
        print("Error in get_flow:", e)
        return jsonify({"error": str(e)}), 500
