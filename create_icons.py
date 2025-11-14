#!/usr/bin/env python3
"""
Generate PNG icons for the BetterFrame Chrome extension
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a single icon of the specified size"""
    # Create a new image with blue background
    img = Image.new('RGB', (size, size), color='#4285f4')
    draw = ImageDraw.Draw(img)

    # Draw a white circle in the center
    center = size // 2
    circle_radius = int(size * 0.28)

    # Outer circle (light)
    outer_radius = int(circle_radius * 1.15)
    draw.ellipse(
        [center - outer_radius, center - outer_radius,
         center + outer_radius, center + outer_radius],
        fill='rgba(255, 255, 255, 50)'
    )

    # Inner circle (white)
    draw.ellipse(
        [center - circle_radius, center - circle_radius,
         center + circle_radius, center + circle_radius],
        fill='white'
    )

    # Draw play triangle
    triangle_size = int(size * 0.15)
    triangle = [
        (center - triangle_size * 0.3, center - triangle_size),
        (center + triangle_size * 0.7, center),
        (center - triangle_size * 0.3, center + triangle_size)
    ]
    draw.polygon(triangle, fill='#4285f4')

    # Add text for larger icons
    if size >= 48:
        try:
            font_size = int(size * 0.12)
            # Try to use a system font
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
            except:
                font = ImageFont.load_default()

            # Draw skip indicators
            draw.text((size * 0.3, size * 0.78), '«5', fill='white', font=font, anchor='mm')
            draw.text((size * 0.7, size * 0.78), '5»', fill='white', font=font, anchor='mm')
        except Exception as e:
            print(f"Warning: Could not add text to {size}x{size} icon: {e}")

    # Save the image
    img.save(filename)
    print(f"Created {filename}")

def main():
    # Create icons directory if it doesn't exist
    os.makedirs('icons', exist_ok=True)

    # Create icons in different sizes
    sizes = [16, 48, 128]

    for size in sizes:
        filename = f'icons/icon{size}.png'
        create_icon(size, filename)

    print("\nAll icons created successfully!")
    print("You can now load the extension in Chrome.")

if __name__ == '__main__':
    main()
