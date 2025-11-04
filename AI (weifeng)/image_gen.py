import os
import json
import base64
from io import BytesIO
from PIL import Image
import google.generativeai as genai

def generate_images_for_all(json_filename, api_key):
    # Configure Gemini API
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash-image-preview")

    # Load JSON data (array of dicts)
    with open(json_filename, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated = False

    # Iterate through each option in the list
    for item in data:
        scene = item.get("scene", "")
        b64_img = item.get("B64 image", "")
        if scene and not b64_img:
            try:
                response = model.generate_content(scene)
                image_parts = [
                    part.inline_data.data
                    for part in response.candidates[0].content.parts
                    if part.inline_data
                ]
                if image_parts:
                    image = Image.open(BytesIO(image_parts[0]))
                    buffered = BytesIO()
                    image.save(buffered, format="PNG")
                    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
                    item["B64 image"] = img_base64
                    print(f'Base64 image data added for id: {item.get("id")}')
                    updated = True
                else:
                    print(f'No image data for id: {item.get("id")}')
            except Exception as e:
                print(f'Error generating image for id {item.get("id")}: {e}')

    # Save updated JSON if any images were added
    if updated:
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("JSON file updated with new images.")
    else:
        print("No new images were generated.")

def clear_b64_image(json_filename):
    with open(json_filename, 'r', encoding='utf-8') as f:
        data = json.load(f)

    cleared = False
    # Iterate and clear B64 image for each item
    for item in data:
        if "B64 image" in item:
            item["B64 image"] = ""
            cleared = True

    if cleared:
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("B64 image data cleared for all items.")
    else:
        print("No B64 image field found in JSON.")
