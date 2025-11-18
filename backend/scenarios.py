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
#rom app import _generate_single_image_file, _file_to_b64


scenarios_bp = Blueprint("scenarios", __name__, url_prefix="/scenarios")
BASE_DIR = Path(__file__).resolve().parent  # path to backend/scenarios.py folder
TMP_DIR = BASE_DIR / "temp"                # backend/scenarios/temp
TMP_DIR.mkdir(parents=True, exist_ok=True)
# def _file_to_b64(path):
#     with open(path, "rb") as f:
#         return base64.b64encode(f.read()).decode("utf-8")

# def _generate_single_image_file(prompt: str, file_path: Path, max_retries: int = 4, delay: float = 2.0) -> bool:
#     # Create scenario folder if missing
#     scenario_dir = TMP_DIR / str(scenario_id)
#     scenario_dir.mkdir(parents=True, exist_ok=True)

#     # Build output path
#     out_path = scenario_dir / f"{filename}.png"

#     # --- PLACEHOLDER IMAGE CREATION ---
#     img = Image.new("RGB", (512, 512), (245, 245, 245))
#     draw = ImageDraw.Draw(img)
#     draw.text((10, 10), prompt[:40], fill=(0, 0, 0))  # show prompt as label
#     img.save(out_path)

#     return str(out_path)



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

        # ✅ Try to auto-select a representative image (node "101" or first scenario node)
        nodes = flow.get("nodes", [])
        first_image = None
        for n in nodes:
            node_id = str(n.get("id"))
            if node_id == "101" or n.get("type") == "scenario":
                data = n.get("data", {})
                img = data.get("imageUrl") or data.get("b64image")
                if img:
                    first_image = img
                    break

        scenario_doc = {
            "title": flow.get("title", "Untitled Scenario").strip(),
            "status": computed_status,
            "image": first_image or flow.get("image") or "",  # ✅ sets the cover image
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
        existing_ids = [str(n["id"]).strip() for n in nodes]
        db.scenarioNodes.delete_many({
            "scenarioId": scenario_oid,
            "id": {"$nin": existing_ids}
        })

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
    
    
@scenarios_bp.route("/generate_images", methods=["POST"])
def generate_images():
    from app import _generate_single_image_file, _file_to_b64  
    """
    Generate one Gemini image per node (used by FlowChartEditor "Generate Images" button).
    Returns a list of {"id", "image_b64"} for all nodes.
    """
    try:
        data = request.get_json(force=True) or {}
        nodes = data.get("nodes", [])
        results = []

        for n in nodes:
            node_id = n.get("id")
            prompt = n.get("data_description", "")
            if not node_id or not prompt.strip():
                continue

            file_path = TMP_DIR / f"{node_id}.png"

            # ✅ Use your Gemini generator (with retries/fallback)
            ok = _generate_single_image_file(prompt, file_path)

            # ✅ Encode image for frontend
            img_b64 = _file_to_b64(file_path)
            results.append({"id": node_id, "image_b64": img_b64})

        print(f"🎨 Generated {len(results)} node images via Gemini core.")
        return jsonify({"images": results, "success": True}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
# @scenarios_bp.route("/updateImage", methods=["POST"])
# def update_image():
#     try:
#         from app import _generate_single_image_file, _file_to_b64
#     except ImportError:
#         print("⚠️ _generate_single_image_file not found — using placeholder mode.")
#         def _generate_single_image_file(prompt, file_path):
#             # fallback placeholder if generator not available
#             from PIL import Image, ImageDraw
#             file_path.parent.mkdir(parents=True, exist_ok=True)
#             img = Image.new("RGB", (512, 512), (245, 245, 245))
#             draw = ImageDraw.Draw(img)
#             draw.text((10, 10), prompt[:40], fill=(0, 0, 0))
#             img.save(file_path)
#             return str(file_path)
#         def _file_to_b64(path):
#             with open(path, "rb") as f:
#                 return base64.b64encode(f.read()).decode("utf-8")

#     try:
#         data = request.get_json(silent=True) or {}
#         print("📩 Incoming updateImage payload:", data)

#         node_id = data.get("nodeId") or data.get("id")
#         description = data.get("description") or data.get("data_description")
#         scenario_id = data.get("scenario_id")
#         is_temp = not (scenario_id and ObjectId.is_valid(str(scenario_id)))


#         if not node_id or not description:
#             return jsonify({
#                 "success": False,
#                 "error": "Missing nodeId/id or description/data_description"
#             }), 400

#         generated_images = []
#         for i in range(3):
#             folder_name = str(scenario_id) if not is_temp else "unsaved"
#             file_path = TMP_DIR / folder_name / f"{node_id}_regen_{i}.png"
#             file_path.parent.mkdir(parents=True, exist_ok=True)
#             _generate_single_image_file(description, file_path)
#             if file_path.exists():
#                 web_path = f"/scenarios/temp/{scenario_id}/{file_path.name}"
#                 generated_images.append(web_path)

#         if not generated_images:
#             print(f"⚠️ No images generated for node {node_id}")
#             return jsonify({
#                 "success": False,
#                 "error": "Backend error during image regeneration: no images generated"
#             }), 500

#         # ✅ Update DB safely
#         node_doc = db.scenarioNodes.find_one({
#             "id": node_id,
#             "scenarioId": ObjectId(scenario_id)
#         })
        

#         if not node_doc:
#             return jsonify({"success": False, "error": f"Node {node_id} not found"}), 404

#         if isinstance(node_doc.get("data"), str):
#             node_doc["data"] = {"data_description": node_doc["data"]}

#         node_doc["data"].update({
#             "b64image": "",  # optional: no heavy data in DB
#             "imageUrl": generated_images[0],
#             "generatedImages": generated_images[-5:],
#         })

#         db.scenarioNodes.update_one(
#     {"id": node_id, "scenarioId": ObjectId(scenario_id)},
#     {"$set": {"data": node_doc["data"]}}
# )


#         print(f"✅ Regenerated and updated {len(generated_images)} images for node {node_id}")

#         return jsonify({
#             "success": True,
#             "id": node_id,
#             "images": generated_images,
#             "message": f"Generated {len(generated_images)} variations"
#         }), 200

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         print("❌ Error updating image:", e)
#         return jsonify({
#             "success": False,
#             "error": f"Backend error during image regeneration: {str(e)}"
#         }), 500
@scenarios_bp.route("/updateImage", methods=["POST"])
def update_image():
    try:
        from app import _generate_single_image_file, _file_to_b64
    except ImportError:
        print("⚠️ _generate_single_image_file not found — using placeholder mode.")
        def _generate_single_image_file(prompt, file_path):
            file_path.parent.mkdir(parents=True, exist_ok=True)
            img = Image.new("RGB", (512, 512), (245, 245, 245))
            draw = ImageDraw.Draw(img)
            draw.text((10, 10), prompt[:40], fill=(0, 0, 0))
            img.save(file_path)
            return str(file_path)
        def _file_to_b64(path):
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")

    try:
        data = request.get_json(silent=True) or {}
        print("📩 Incoming updateImage payload:", data)

        node_id = data.get("nodeId") or data.get("id")
        description = data.get("description") or data.get("data_description")
        scenario_id = data.get("scenario_id")

        # Determine if scenario is unsaved
        is_temp = not (scenario_id and ObjectId.is_valid(str(scenario_id)))

        if not node_id or not description:
            return jsonify({
                "success": False,
                "error": "Missing nodeId/id or description/data_description"
            }), 400

        generated_images = []
        folder_name = str(scenario_id) if not is_temp else "unsaved"

        for i in range(3):
            file_path = TMP_DIR / folder_name / f"{node_id}_regen_{i}.png"
            file_path.parent.mkdir(parents=True, exist_ok=True)

            _generate_single_image_file(description, file_path)

            if file_path.exists():
                web_path = f"/scenarios/temp/{folder_name}/{file_path.name}"
                generated_images.append(web_path)

        if not generated_images:
            return jsonify({
                "success": False,
                "error": "Backend error during image regeneration"
            }), 500

        # Database update only if scenario is saved (valid ObjectId)
        if not is_temp:
            scenario_oid = ObjectId(scenario_id)
            node_doc = db.scenarioNodes.find_one(
                {"id": node_id, "scenarioId": scenario_oid}
            )

            if not node_doc:
                return jsonify({"success": False, "error": f"Node {node_id} not found"}), 404

            if isinstance(node_doc.get("data"), str):
                node_doc["data"] = {"data_description": node_doc["data"]}

            node_doc["data"].update({
                "b64image": "",
                "imageUrl": generated_images[0],
                "generatedImages": generated_images[-5:],
            })

            db.scenarioNodes.update_one(
                {"id": node_id, "scenarioId": scenario_oid},
                {"$set": {"data": node_doc["data"]}}
            )

        return jsonify({
            "success": True,
            "id": node_id,
            "images": generated_images,
            "temp": is_temp,
            "message": f"Generated {len(generated_images)} variations"
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# # =========================================================
# # ✅ Update a Single Node Image (Generate 3 Variations)
# # =========================================================
# @scenarios_bp.route("/updateImage", methods=["POST"])
# def update_image():
   
#     try: 
#         from app import _generate_single_image_file
#         data = request.get_json(silent=True) or {}
#         print("📩 Incoming updateImage payload:", data)

#         node_id = data.get("nodeId") or data.get("id")
#         description = data.get("description") or data.get("data_description")
#         scenario_id = str(data.get("scenario_id") or "global")

#         if not node_id or not description:
#             return jsonify({
#                 "success": False,
#                 "error": "Missing nodeId/id or description/data_description"
#             }), 400

#         generated_images = []
#         for i in range(3):
#             # ✅ Use the utils function (auto saves in /temp_images/<scenario_id>)
#             # url = _generate_single_image_file(description, scenario_id, f"{node_id}_regen_{i}")

#             # Build a proper Path to the image file
#             file_path = TMP_DIR / scenario_id / f"{node_id}_regen_{i}.png"

#             # Ensure the scenario temp folder exists
#             file_path.parent.mkdir(parents=True, exist_ok=True)

#             # Call the image generator with correct argument types
#             _generate_single_image_file(description, file_path)
#              # ✅ Return relative web-accessible path
#             web_path = f"/scenarios/temp/{scenario_id}/{node_id}_regen_{i}.png"
#             generated_images.append(web_path)
#             # ✅ Build absolute path so we can b64 it for frontend
#             #local_path = TMP_DIR / scenario_id / f"{node_id}_regen_{i}.png"
#             # img_b64 = _file_to_b64(file_path)
#             # generated_images.append(f"data:image/png;base64,{img_b64}")

#         print(f"📤 Sending images back to frontend: {len(generated_images)}")

#         # ✅ Update database
#         node_doc = db.scenarioNodes.find_one({"id": node_id})
#         if not node_doc:
#             return jsonify({"success": False, "error": f"Node {node_id} not found"}), 404

#         if isinstance(node_doc.get("data"), str):
#             node_doc["data"] = {"data_description": node_doc["data"]}

#         node_doc["data"].update({
#             "b64image": generated_images[0].split(",")[1],
#             "imageUrl": generated_images[0],
#             "generatedImages": generated_images[-5:],  # keep only last 5
#         })

#         db.scenarioNodes.update_one(
#             {"id": node_id},
#             {"$set": {"data": node_doc["data"]}}
#         )

#         print(f"✅ Regenerated and updated {len(generated_images)} images for node {node_id}")

#         return jsonify({
#             "success": True,
#             "id": node_id,
#             "images": generated_images,
#             "message": f"Generated {len(generated_images)} variations"
#         }), 200

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         print("❌ Error updating image:", e)
#         return jsonify({
#             "success": False,
#             "error": f"Backend error during image regeneration: {str(e)}"
#         }), 500

# =========================================================
# 🖼 Upload temp image (base64 → file → URL) [Per Scenario]
# =========================================================
@scenarios_bp.route("/uploadTempImage", methods=["POST"])
def upload_temp_image():
    try:
        data = request.get_json(silent=True) or {}
        node_id = data.get("node_id")
        scenario_id = str(data.get("scenario_id") or "global")
        b64image = data.get("b64image")

        if not node_id or not b64image:
            return jsonify({"success": False, "error": "Missing node_id or b64image"}), 400

        # ✅ Build scenario-specific directory: /temp_images/<scenario_id>/
        scenario_dir = TMP_DIR / scenario_id
        scenario_dir.mkdir(parents=True, exist_ok=True)

        # ✅ Decode base64 string (handle potential data URLs)
        try:
            img_bytes = base64.b64decode(b64image.split(",")[-1])
        except Exception:
            return jsonify({"success": False, "error": "Invalid base64 data"}), 400

        # ✅ Save image file
        filename = f"{node_id}.png"
        filepath = scenario_dir / filename
        if not filepath.exists():
            return jsonify({"error": "File not found"}), 404


        with Image.open(BytesIO(img_bytes)) as img:
            img.convert("RGBA").save(filepath, "PNG")

        # ✅ Build relative URL for frontend (served via Flask)
        url = f"/scenarios/temp/{scenario_id}/{filename}"
        print(f"🖼 Temp image saved → {filepath} ({url})")

        return jsonify({
            "success": True,
            "url": url,
            "node_id": node_id,
            "scenario_id": scenario_id
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print("❌ Error saving temp image:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# 🖼 Serve temp images (by scenario)
# =========================================================
@scenarios_bp.route("/temp/<scenario_id>/<filename>")
def serve_temp_image(scenario_id, filename):
    """Serve images from /temp_images/<scenario_id>/"""
    scenario_dir = TMP_DIR / scenario_id
    if not scenario_dir.exists():
        return jsonify({"error": f"Scenario {scenario_id} not found"}), 404
    return send_from_directory(scenario_dir, filename)

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
            "title": scenario.get("title", "Untitled Scenario"),     # ✅ ensure fallback
            "description": scenario.get("description", ""),          # ✅ safe default
            "status": (scenario.get("status") or "draft").lower(),   # ✅ normalized
            "image": scenario.get("image", ""),                      # ✅ safe default
            "startNodeId": scenario.get("startNodeId", ""),          # ✅ safe default
            "lastEdited": scenario.get("lastEdited", ""),            # ✅ include for UI
            "user_id": scenario.get("user_id", ""),                  # ✅ include if needed
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
         # Delete corresponding temp image folder
        scenario_folder = TMP_DIR / scenario_id
        if scenario_folder.exists():
            import shutil
            shutil.rmtree(scenario_folder)
            print(f"🧹 Deleted temp images for scenario {scenario_id}")
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
    for f in TMP_DIR.rglob("*.png"):  # 🔁 recursive scan
        try:
            if now - f.stat().st_mtime > 60 * 60 * 24:  # older than 1 day
                f.unlink()
                print(f"🧹 Removed old temp image: {f}")
        except Exception:
            pass

@scenarios_bp.route("/stop_generation", methods=["POST"])
def stop_generation():
    global AUTO_GEN_RUNNING
    AUTO_GEN_RUNNING = False
    global GLOBAL_STOP
    GLOBAL_STOP = True
    print("🛑 Generation manually stopped from frontend.")
    return jsonify({"success": True})
