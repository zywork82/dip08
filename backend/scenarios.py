# scenarios.py
from flask import Blueprint, request, jsonify
from db import db  # pymongo client
from datetime import datetime
from bson import ObjectId

router = Blueprint("scenarios", __name__)

@router.route("/saveFlow", methods=["POST"])
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
