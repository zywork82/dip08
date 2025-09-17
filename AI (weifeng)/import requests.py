import os
import google.generativeai as genai
from PIL import Image
from io import BytesIO

# Set your API key
genai.configure(api_key="AIzaSyDv2FzjQSF4iW9bPw3iQLafgTBq9RsJNVE")

# Create the model object
model = genai.GenerativeModel("gemini-2.5-flash-image-preview")

# Generate an image from a text prompt
response = model.generate_content(
    "A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl. The setting is his rustic, sun-drenched workshop with pottery wheels and shelves of clay pots in the background. The scene is illuminated by soft, golden hour light streaming through a window, highlighting the fine texture of the clay and the fabric of his apron. Captured with an 85mm portrait lens, resulting in a soft, blurred background (bokeh). The overall mood is serene and masterful."
)

print(response)  # <-- Add this line to inspect the response

# Handle the response and save the image.
try:
    image_parts = [
        part.inline_data.data
        for part in response.candidates[0].content.parts
        if part.inline_data
    ]

    if image_parts:
        image = Image.open(BytesIO(image_parts[0]))
        image.save('photorealistic_example.png')
        image.show()
    else:
        print("No image data found in the response.")

except Exception as e:
    print(f"An error occurred while processing the response: {e}")