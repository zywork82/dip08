from flask import Blueprint, request, jsonify
from db import db
from datetime import datetime
from bson import ObjectId


scenarios_bp = Blueprint("scenarios", __name__, url_prefix="/scenarios")

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
# ✅ Save Flow (upsert nodes with full image support)
# =========================================================
@scenarios_bp.route("/saveFlow", methods=["POST"])
def save_flow():
    try:
        flow = request.get_json() or {}
        now = datetime.utcnow()
        scenario_id = flow.get("id")

        # --- Validate ObjectId ---
        def is_valid_objectid(val):
            from bson.errors import InvalidId
            try:
                ObjectId(val)
                return True
            except (InvalidId, TypeError):
                return False

        # --- Prepare main scenario document ---
        scenario_doc = {
            "title": flow.get("title", "Untitled Scenario").strip(),  # ✅ always update title
            "status": flow.get("status", "Edit"),
            "image": flow.get("image"),
            "lastEdited": now.isoformat(),
            "startNodeId": flow.get("startNodeId"),
        }

        # --- Determine if we are updating or creating ---
        if scenario_id and is_valid_objectid(scenario_id):
            result = db.scenarios.update_one(
                {"_id": ObjectId(scenario_id)},
                {"$set": scenario_doc},
                upsert=True
            )
            if result.matched_count == 0:
                print(f"⚠️ No scenario found for ID {scenario_id}, creating new instead.")
                scenario_oid = db.scenarios.insert_one(scenario_doc).inserted_id
            else:
                scenario_oid = ObjectId(scenario_id)
        else:
            existing = db.scenarios.find_one({"title": scenario_doc["title"]})
            if existing:
                db.scenarios.update_one({"_id": existing["_id"]}, {"$set": scenario_doc})
                scenario_oid = existing["_id"]
            else:
                scenario_oid = db.scenarios.insert_one(scenario_doc).inserted_id

        # =========================================================
        # 🧩 FIX 1: Convert node dict → list (frontend sends object)
        # =========================================================
        nodes = flow.get("nodes", [])
        if isinstance(nodes, dict):
            nodes = list(nodes.values())

        saved_nodes = []
        for node in nodes:
            raw_data = node.get("data", {}) or {}

          # 🧩 Safe image extraction (avoid IndexError on empty lists)
            gen_imgs = raw_data.get("generatedImages") or []
            first_img = gen_imgs[0] if len(gen_imgs) > 0 else ""

            formatted_data = {
                "data_description": raw_data.get("data_description", node.get("description", "")),
                "options": raw_data.get("options", node.get("options", [])),
                "next": raw_data.get("next", node.get("next", None)),
                "scene": raw_data.get("scene", ""),
               "b64image": raw_data.get("b64image") if raw_data.get("b64image") else first_img,
                "imageUrl": raw_data.get("imageUrl") if raw_data.get("imageUrl") else first_img,
                "generatedImages": gen_imgs,
            }

            node_doc = {
                "id": str(node.get("id")).strip(),
                "type": node.get("type", "scenario"),
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
            saved_nodes.append(node_doc)

        for n in saved_nodes:
            if "_id" in n:
                n["_id"] = str(n["_id"])
            if isinstance(n.get("scenarioId"), ObjectId):
                n["scenarioId"] = str(n["scenarioId"])

        print(f"✅ Saved {len(saved_nodes)} nodes for scenario {scenario_oid}")

        return jsonify({
            "success": True,
            "message": f"Scenario '{scenario_doc['title']}' saved successfully.",
            "nodesSaved": len(saved_nodes),
            "edgesSaved": len(flow.get('edges', [])),
            "scenarioId": str(scenario_oid),
            "savedNodes": saved_nodes,
            "updatedTitle": scenario_doc["title"],  # ✅ new field for frontend sync
        }), 200

    except Exception as e:
        print("❌ Error saving flow:", e)
        return jsonify({"success": False, "error": str(e)}), 500

# =========================================================
# ✅ Update a Single Node Image (for Regenerate button)
# =========================================================
# =========================================================
# ✅ Update a Single Node Image (Generate 3 Variations)
# =========================================================
@scenarios_bp.route("/updateImage", methods=["POST"])
def update_image():
    from app import TMP_DIR, _generate_single_image_file, _file_to_b64

    try:
        data = request.get_json(silent=True) or {}
        print("📩 Incoming updateImage payload:", data)

        node_id = data.get("nodeId") or data.get("id")
        description = data.get("description") or data.get("data_description")

        if not node_id or not description:
            return jsonify({
                "success": False,
                "error": "Missing nodeId/id or description/data_description"
            }), 400

        TMP_DIR.mkdir(parents=True, exist_ok=True)

        # 🧠 Generate multiple image variations (3 total)
        generated_images = []
        for i in range(3):
            out_path = TMP_DIR / f"{node_id}_regen_{i}.png"
            _generate_single_image_file(description, out_path)
            img_b64 = _file_to_b64(out_path)
            generated_images.append(f"data:image/png;base64,{img_b64}")

        print(f"📤 Sending images back to frontend: {len(generated_images)}")

        # 🩹 Fetch node
        node_doc = db.scenarioNodes.find_one({"id": node_id})
        if not node_doc:
            return jsonify({"success": False, "error": f"Node {node_id} not found"}), 404

        # 🧹 Ensure 'data' field is a dictionary
        if isinstance(node_doc.get("data"), str):
            node_doc["data"] = {"data_description": node_doc["data"]}
        if "data_description" not in node_doc["data"]:
            node_doc["data"]["data_description"] = description

        # 🧩 Merge and limit variations (keep latest 5)
        existing_images = node_doc["data"].get("generatedImages", [])
        existing_images.extend(generated_images)
        existing_images = existing_images[-5:]

        # 🧩 Update image info
        node_doc["data"].update({
            "b64image": generated_images[0].split(",")[1],
            "imageUrl": generated_images[0],
            "generatedImages": existing_images
        })

        db.scenarioNodes.update_one(
            {"id": node_id},
            {"$set": {"data": node_doc["data"]}}
        )

        # 🧹 Clean up temp files
        for i in range(3):
            try:
                (TMP_DIR / f"{node_id}_regen_{i}.png").unlink(missing_ok=True)
            except Exception:
                pass

        print(f"✅ Regenerated and updated 3 images for node {node_id}")
        return jsonify({
            "success": True,
            "id": node_id,
            "message": f"Generated {len(generated_images)} variations",
            "images": [img.split(",")[1] for img in generated_images]
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Error updating image:", e)
        return jsonify({
            "success": False,
            "error": f"Backend error during image regeneration: {str(e)}"
        }), 500


# =========================================================
# ✅ Get full flow (ReactFlow-ready, returns images)
# =========================================================
@scenarios_bp.route("/getFlow/<scenario_id>", methods=["GET"])
def get_flow(scenario_id):
    try:
        scenario = db.scenarios.find_one({"_id": ObjectId(scenario_id)})
        if not scenario:
            return jsonify({"error": "Scenario not found"}), 404

        # 🧩 Fetch nodes for scenario
        nodes = list(db.scenarioNodes.find({"scenarioId": ObjectId(scenario_id)}))
        edges = []

        for n in nodes:
            data_field = n.get("data") or {}
            if isinstance(data_field, str):
                data_field = {"data_description": data_field}
            elif not isinstance(data_field, dict):
                data_field = {}

            # ✅ Ensure defaults exist even if missing
            data_field.setdefault("data_description", "")
            data_field.setdefault("options", [])
            data_field.setdefault("next", None)
            data_field.setdefault("scene", "")
            data_field.setdefault("b64image", "")
            data_field.setdefault("imageUrl", "")
            data_field.setdefault("generatedImages", [])

            n["data"] = data_field


            # 🧩 FIX 2: Always read options from n["data"]
            n["data"] = {
                "data_description": data_field.get("data_description", ""),
                "options": data_field.get("options", []),
                "next": data_field.get("next", None),
                "scene": data_field.get("scene", ""),
                "b64image": data_field.get("b64image", ""),
                "imageUrl": data_field.get("imageUrl", ""),
                "generatedImages": data_field.get("generatedImages", []),
            }

            # --- Build edges safely ---
            for opt_id in n["data"]["options"]:
                edges.append({
                    "id": f"e-{n['id']}-{opt_id}",
                    "source": n["id"],
                    "target": opt_id,
                    "type": "smoothstep",
                    "animated": True
                })

            if n["data"]["next"]:
                edges.append({
                    "id": f"e-{n['id']}-{n['data']['next']}",
                    "source": n["id"],
                    "target": n["data"]["next"],
                    "type": "smoothstep",
                    "animated": True
                })

            n["_id"] = str(n["_id"])
            n["scenarioId"] = str(n["scenarioId"])

        # 🧩 FIX 3: Normalize all node IDs as strings
        for n in nodes:
            n["id"] = str(n["id"]).strip()

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

@scenarios_bp.route("/delete/<scenario_id>", methods=["DELETE"])
def delete_scenario(scenario_id):
    try:
        from bson import ObjectId

        if not ObjectId.is_valid(scenario_id):
            return jsonify({"success": False, "error": "Invalid scenario ID"}), 400

        scenario_oid = ObjectId(scenario_id)

        # 🗑 delete the scenario itself
        deleted_scenario = db.scenarios.delete_one({"_id": scenario_oid})

        # 🗑 delete all nodes linked to it
        deleted_nodes = db.scenarioNodes.delete_many({"scenarioId": scenario_oid})

        return jsonify({
            "success": True,
            "scenarioDeleted": deleted_scenario.deleted_count,
            "nodesDeleted": deleted_nodes.deleted_count,
            "scenarioId": scenario_id
        }), 200
    except Exception as e:
        print("❌ Error deleting scenario:", e)
        return jsonify({"success": False, "error": str(e)}), 500
