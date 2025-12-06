#!/bin/bash

# Simple icon creation script
# This creates basic placeholder icons for the Chrome extension

# Create a simple 128x128 icon using ImageMagick (if available)
if command -v convert &> /dev/null; then
    echo "Creating icons with ImageMagick..."
    
    # Create base icon with gradient background and llama emoji
    convert -size 128x128 gradient:#667eea-#764ba2 \
            -gravity center \
            -pointsize 72 -annotate +0+0 "🦙" \
            icons/icon128.png
    
    # Resize for other sizes
    convert icons/icon128.png -resize 48x48 icons/icon48.png
    convert icons/icon128.png -resize 16x16 icons/icon16.png
    
    echo "Icons created successfully!"
else
    echo "ImageMagick not found. Please install it or create icons manually."
    echo "See icons/README.md for instructions."
fi
