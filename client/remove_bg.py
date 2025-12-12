from PIL import Image
import numpy as np
import os

# Paths
input_path = r"c:\sitrep\client\public\logo.png"
output_path = r"c:\sitrep\client\public\logo.png"

def remove_background():
    print(f"Opening {input_path}")
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            # Check if pixel is white-ish (background)
            # Adjust threshold as needed. 240 is usually safe for white backgrounds.
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        img.save(output_path, "PNG")
        print("Successfully saved transparent image.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_background()
