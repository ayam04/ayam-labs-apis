from PIL import Image
import os
src = r'C:\Users\ayamu\.dsh\attachments\v1\objects\24\240edabda5bf6f006f10b6361638d318de1bb1bf5a269f6a15f2ad9e4f2a4c68'
im = Image.open(src)
box = (150, 340, 540, 445)
crop = im.crop(box)
crop = crop.resize((crop.width*4, crop.height*4), Image.LANCZOS)
out = os.path.join(os.environ['TEMP'], 'vis_crop2.png')
crop.save(out)
print(out, crop.size)