import json
import base64
from io import BytesIO
from PIL import Image
from image_gen import generate_images_for_all, clear_b64_image

def main():
    json_file = "flowchart.json"
    api_key = "AIzaSyDv2FzjQSF4iW9bPw3iQLafgTBq9RsJNVE"
    clear_b64_image(json_file)  # Clears the B64 image field
    generate_images_for_all(json_file, api_key)
 
    # Load updated JSON and display the image
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        found = False
        if isinstance(data, dict):
            b64_img = data.get("B64 image")
            if b64_img:
                img_bytes = base64.b64decode(b64_img)
                img = Image.open(BytesIO(img_bytes))
                img.show()
                found = True
        elif isinstance(data, list):
            for item in data:
                b64_img = item.get("B64 image") if isinstance(item, dict) else None
                if b64_img:
                    img_bytes = base64.b64decode(b64_img)
                    img = Image.open(BytesIO(img_bytes))
                    img.show()
                    found = True
        if not found:
            print("No image data found in JSON.")

if __name__ == "__main__":
    main()