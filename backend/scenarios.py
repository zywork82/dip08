# scenarios.py
from flask import Blueprint, request, jsonify
from db import db  # pymongo client
from datetime import datetime
from bson import ObjectId

scenarios_bp = Blueprint("scenarios", __name__, url_prefix="/scenarios")

@scenarios_bp.route("/saveFlow", methods=["POST"])
def save_flow():
    try:
        flow = request.json
        now = datetime.utcnow()

        # 1️⃣ Upsert scenario metadata
        scenario_doc = {
            "title": flow.get("title"),
            "lastEdited": now.isoformat(),
            "status": flow.get("status", "Edit"),
            "image": flow.get("image"),
            "startNodeId": flow.get("startNodeId")
        }

        # Upsert by title
        db.scenarios.update_one(
            {"title": flow.get("title")},
            {"$set": scenario_doc},
            upsert=True
        )

        # Get the scenario _id
        scenario = db.scenarios.find_one({"title": flow.get("title")})
        scenario_id = scenario["_id"]

        # 2️⃣ Remove old nodes for this scenario
        db.scenarioNodes.delete_many({"scenarioId": scenario_id})

        # 3️⃣ Insert new nodes with scenarioId
        nodes_to_insert = []
        for node in flow.get("nodes", []):
            node_copy = node.copy()
            node_copy["scenarioId"] = scenario_id
            nodes_to_insert.append(node_copy)

        if nodes_to_insert:
            db.scenarioNodes.insert_many(nodes_to_insert)

        return jsonify({
            "success": True,
            "message": f"Scenario '{flow.get('title')}' saved successfully.",
            "nodesSaved": len(nodes_to_insert),
            "edgesSaved": len(flow.get("edges", [])),
            "scenarioId": str(scenario_id)
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# --- List all scenarios ---
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


# --- Get flow data for one scenario ---
@scenarios_bp.route("/getFlow/<scenario_id>", methods=["GET"])
def get_flow(scenario_id):
    try:
        scenario = db.scenarios.find_one({"_id": ObjectId(scenario_id)})
        if not scenario:
            return jsonify({"error": "Scenario not found"}), 404

        # Fetch all nodes for this scenario
        nodes = list(db.scenarioNodes.find({"scenarioId": ObjectId(scenario_id)}))

        # Convert ObjectIds to strings for JSON serialization
        for n in nodes:
            n["_id"] = str(n["_id"])
            n["scenarioId"] = str(n["scenarioId"])

        flow_data = {
            "title": scenario.get("title"),
            "status": scenario.get("status"),
            "image": scenario.get("image"),
            "startNodeId": scenario.get("startNodeId"),
            "nodes": nodes,
            "edges": [],  # Optional: add edge collection later
        }

        return jsonify(flow_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@scenarios_bp.route("/", methods=["GET"])
def get_all_scenarios():
    if request.method == "OPTIONS":
        return '', 200  # preflight OK
    try:
        scenarios = list(db.scenarios.find({}))
        for s in scenarios:
            s["_id"] = str(s["_id"])
            if "lastEdited" in s:
                s["lastEdited"] = s["lastEdited"][:10]
        return jsonify(scenarios)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
