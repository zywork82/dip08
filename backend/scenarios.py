from flask import Blueprint, request, jsonify
from db import db
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import os, time
from flask import send_from_directory
from PIL import Image
import base64
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw
scenarios_bp = Blueprint("scenarios", __name__, url_prefix="/scenarios")
TMP_DIR = Path("scenarios/temp_images")
TMP_DIR.mkdir(parents=True, exist_ok=True)

def _file_to_b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def _generate_single_image_file(prompt, out_path):
    img = Image.new("RGB", (512, 512), (245, 245, 245))
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "AI Image Placeholder", fill=(0, 0, 0))
    img.save(out_path)




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
            user_id = data.get("user_id")  # ✅ Add this line
            created_at = datetime.utcnow()

            doc = {
                "title": title,
                "description": description,
                "status": "Draft",
                "createdAt": created_at.isoformat(),
                "lastEdited": created_at.isoformat(),
                "user_id": user_id,  # ✅ store owner
            }

            result = db.scenarios.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
            return jsonify({"success": True, "scenario": doc}), 201
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500


    # --- Get all scenarios ---
    if request.method == "GET":
        try:
            user_id = request.args.get("user_id")  # ✅ read from query params
            query = {"user_id": user_id} if user_id else {}

            scenarios = list(db.scenarios.find(query))
            for s in scenarios:
                s["_id"] = str(s["_id"])
                if "lastEdited" in s:
                    s["lastEdited"] = s["lastEdited"][:10]
                if "status" not in s:
                    s["status"] = "draft"

            return jsonify(scenarios)
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500


# =========================================================
# ✅ Save Flow (upsert nodes with full image support)
# =========================================================
@scenarios_bp.route("/saveFlow", methods=["POST", "OPTIONS"])
def save_flow():
    if request.method == "OPTIONS":
        return '', 200

    try:
        # ✅ Always parse JSON safely
        flow = request.get_json(force=True, silent=False)
        if not flow:
            print("⚠️ No JSON payload received.")
            return jsonify({"success": False, "error": "No JSON payload"}), 400

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

        # --- Determine scenario status automatically ---
        raw_status = (flow.get("status") or "").lower()
        has_images = any(
            (n.get("data", {}).get("b64image") or n.get("data", {}).get("imageUrl"))
            for n in (flow.get("nodes") or [])
        )

        if raw_status in ["published", "images", "flowchart", "draft"]:
            computed_status = raw_status
        elif has_images:
            computed_status = "images"
        elif flow.get("nodes"):
            computed_status = "flowchart"
        else:
            computed_status = "draft"

        scenario_doc = {
            "title": flow.get("title", "Untitled Scenario").strip(),
            "status": computed_status,
            "image": flow.get("image"),
            "lastEdited": now.isoformat(),
            "startNodeId": flow.get("startNodeId"),
        }

        print(f"🧩 Auto-detected status for '{scenario_doc['title']}': {computed_status}")

        # --- Upsert scenario document ---
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
        # ✅ Parse nodes properly (fix indentation)
        # =========================================================
        nodes = flow.get("nodes", [])
        if isinstance(nodes, dict):
            nodes = list(nodes.values())

        saved_nodes = []

        for node in nodes:
            raw_data = node.get("data", {})
            if isinstance(raw_data, str):
                raw_data = {"data_description": raw_data}
            elif not isinstance(raw_data, dict):
                raw_data = {}

            gen_imgs = raw_data.get("generatedImages") or []
            first_img = gen_imgs[0] if len(gen_imgs) > 0 else ""

            formatted_data = {
                "data_description": raw_data.get("data_description", node.get("description", "")),
                "options": raw_data.get("options", node.get("options", [])),
                "next": raw_data.get("next", node.get("next", None)),
                "scene": raw_data.get("scene", ""),
                "b64image": raw_data.get("b64image", ""),
                "imageUrl": raw_data.get("imageUrl", ""),
                "generatedImages": gen_imgs,
            }

            node_doc = {
                "id": str(node.get("id")).strip(),
                "type": node.get("type", "scenario"),
                "data": formatted_data,
                "psych_dimensions": node.get("psych_dimensions", ""),
                "position": node.get("position", {}),
                "scenarioId": ObjectId(scenario_oid)
            }

            db.scenarioNodes.update_one(
                {"id": node_doc["id"], "scenarioId": ObjectId(scenario_oid)},
                {"$set": node_doc},
                upsert=True
            )
            saved_nodes.append(node_doc)

        print(f"✅ Saved {len(saved_nodes)} nodes for scenario {scenario_oid}")

        return jsonify({
            "success": True,
            "message": f"Scenario '{scenario_doc['title']}' saved successfully.",
            "nodesSaved": len(saved_nodes),
            "edgesSaved": len(flow.get('edges', [])),
            "scenarioId": str(scenario_oid),
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Error saving flow:", e)
        return jsonify({"success": False, "error": str(e)}), 500
    
    

# =========================================================
# ✅ Update a Single Node Image (Generate 3 Variations)
# =========================================================
@scenarios_bp.route("/updateImage", methods=["POST"])
def update_image():
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
        "images": generated_images

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
# 🖼 Upload temp image (base64 → file → URL)
# =========================================================
@scenarios_bp.route("/uploadTempImage", methods=["POST"])
def upload_temp_image():
    try:
        data = request.get_json(silent=True) or {}
        node_id = data.get("node_id")
        b64image = data.get("b64image")

        if not node_id or not b64image:
            return jsonify({"success": False, "error": "Missing node_id or b64image"}), 400
        TMP_DIR.mkdir(parents=True, exist_ok=True)

        # Decode base64 and save to /temp_images
        img_bytes = base64.b64decode(b64image.split(",")[-1])
        img = Image.open(BytesIO(img_bytes))
        filename = f"{node_id}.png"
        filepath = os.path.join(TMP_DIR, filename)
        img.save(filepath, "PNG")

        url = f"/scenarios/temp/{filename}"
        print(f"🖼 Temp image saved for node {node_id}: {url}")

        return jsonify({"success": True, "url": f"/scenarios/temp/{filename}"}), 200


    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Error saving temp image:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================
# 🖼 Serve temp images (used in SceneEditor)
# =========================================================
@scenarios_bp.route("/temp/<filename>")
def serve_temp_image(filename):
    """Serve images from the temp_images folder"""
    return send_from_directory(TMP_DIR, filename)

# =========================================================
# ✅ Get full flow (ReactFlow-ready, returns images)
# =========================================================
@scenarios_bp.route("/getFlow/<scenario_id>", methods=["GET"])
def get_flow(scenario_id):
    print(f"📩 [getFlow] Incoming scenario ID: {scenario_id}")

    try:
        # ✅ Handle both valid ObjectId and string IDs
        try:
            query_id = ObjectId(scenario_id)
            print("✅ Parsed as valid ObjectId")
        except InvalidId:
            print("⚠️ Invalid ObjectId format, using string comparison")
            query_id = scenario_id

        scenario = db.scenarios.find_one({"_id": query_id})
        if not scenario:
            print("❌ Scenario not found in database.")
            return jsonify({"error": "Scenario not found"}), 404

        # ✅ Fetch nodes
        print("📥 Fetching nodes for scenario...")
        # 🧩 FIX — handle both ObjectId and string type
        nodes = list(
            db.scenarioNodes.find({
                "$or": [
                    {"scenarioId": query_id},
                    {"scenarioId": str(query_id)}
                ]
            })
        )
        print(f"✅ Retrieved {len(nodes)} nodes from DB (string/ObjectId tolerant)")

        print(f"✅ Retrieved {len(nodes)} nodes from DB")

        edges = []

        for n in nodes:
            data_field = n.get("data") or {}
            if isinstance(data_field, str):
                data_field = {"data_description": data_field}
            elif not isinstance(data_field, dict):
                data_field = {}

            data_field.setdefault("data_description", "")
            data_field.setdefault("options", [])
            data_field.setdefault("next", None)
            data_field.setdefault("scene", "")
            data_field.setdefault("b64image", "")
            data_field.setdefault("imageUrl", "")
            data_field.setdefault("generatedImages", [])

            n["data"] = data_field

            # edges
            for opt_id in data_field.get("options", []):
                edges.append({
                    "id": f"e-{n['id']}-{opt_id}",
                    "source": n["id"],
                    "target": opt_id,
                    "type": "smoothstep",
                    "animated": True
                })
            if data_field.get("next"):
                edges.append({
                    "id": f"e-{n['id']}-{data_field['next']}",
                    "source": n["id"],
                    "target": data_field["next"],
                    "type": "smoothstep",
                    "animated": True
                })

            n["_id"] = str(n["_id"])
            n["scenarioId"] = str(n["scenarioId"])
            n["id"] = str(n["id"]).strip()

        flow_data = {
            "id": str(scenario["_id"]),
            "title": scenario.get("title"),
            "description": scenario.get("description"),
            "status": (scenario.get("status") or "draft").lower(),
            "image": scenario.get("image"),
            "startNodeId": scenario.get("startNodeId"),
            "nodes": nodes,
            "edges": edges,
        }

        print(f"✅ Returning flow data for '{flow_data['title']}' ({len(nodes)} nodes)")
        return jsonify(flow_data), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Error in get_flow:", e)
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
# =========================================================
# ✅ Update Scenario Status (Draft → Flowchart → Images → Published)
# =========================================================
@scenarios_bp.route("/updateStatus/<scenario_id>", methods=["PATCH"])
def update_status(scenario_id):
    """
    Allows frontend to update the scenario status as user progresses:
      - 'draft'       : flow generated but unsaved
      - 'flowchart'   : flowchart saved but no images yet
      - 'images'      : images generated in SceneEditor
      - 'published'   : finalized simulation ready for trainees
    """
    try:
        data = request.get_json() or {}
        new_status = (data.get("status") or "").lower()

        if not new_status:
            return jsonify({"success": False, "error": "Missing 'status' field"}), 400

        # ✅ Validate ID
        if not ObjectId.is_valid(scenario_id):
            return jsonify({"success": False, "error": "Invalid scenario ID"}), 400

        now = datetime.utcnow().isoformat()

        result = db.scenarios.update_one(
            {"_id": ObjectId(scenario_id)},
            {"$set": {"status": new_status, "lastEdited": now}}
        )

        if result.matched_count == 0:
            return jsonify({"success": False, "error": "Scenario not found"}), 404

        print(f"✅ Updated scenario {scenario_id} → status = {new_status}")

        return jsonify({
            "success": True,
            "scenarioId": scenario_id,
            "newStatus": new_status
        }), 200

    except Exception as e:
        print("❌ Error updating scenario status:", e)
        return jsonify({"success": False, "error": str(e)}), 500
@scenarios_bp.route("/rename/<id>", methods=["POST"])
def rename_scenario(id):
    try:
        data = request.get_json()
        new_title = data.get("title")

        if not new_title:
            return jsonify({"success": False, "error": "Missing title"}), 400

        result = db.scenarios.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"title": new_title, "lastEdited": datetime.utcnow().isoformat()}}
        )

        if result.modified_count == 0:
            return jsonify({"success": False, "error": "Scenario not found"}), 404

        return jsonify({"success": True, "title": new_title})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
@scenarios_bp.before_app_request
def cleanup_old_temp_images():
    now = time.time()
    for f in TMP_DIR.glob("*.png"):
        if now - f.stat().st_mtime > 60 * 60 * 24:
            try:
                f.unlink()
                print(f"🧹 Removed old temp image: {f.name}")
            except Exception:
                pass
