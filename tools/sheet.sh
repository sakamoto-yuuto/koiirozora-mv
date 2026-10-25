#!/bin/sh
# QA contact sheet: tools/sheet.sh <name> <times,comma,separated> [cols]  -> out/<name>.png + out/<name>.jpg (2/3 size for review)
node export/export.mjs --sheet "out/$1.png" --times "$2" --cols "${3:-4}" 2>&1 | grep -v "404\|Failed to load resource" | tail -4
python -c "from PIL import Image; im=Image.open('out/$1.png'); im.convert('RGB').resize((im.width*2//3, im.height*2//3)).save('out/$1.jpg',quality=85)"
