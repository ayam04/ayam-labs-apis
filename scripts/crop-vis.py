from PIL import Image
import os
src = r'C:\Users\ayamu\.dsh\attachments\v1\objects\24\240edabda5bf6f006f10b6361638d318de1bb1bf5a269f6a15f2ad9e4f2a4c68'
im = Image.open(src)
print('size', im.size)
box = (300, 670, 1080, 880)
crop = im.crop(box).resize(((box[2]-box[0])*2, (box[3]-box[1])*2), Image.LANCZOS)
out = os.path.join(os.environ['TEMP'], 'vis_crop.png')
crop.save(out)
print(out, crop.size)