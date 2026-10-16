import fs from 'node:fs/promises';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const input=new URL('../public/icons/bao-an.svg',import.meta.url);
for(const size of [192,512])await sharp(await fs.readFile(input)).resize(size,size).png().toFile(fileURLToPath(new URL(`../public/icons/bao-an-${size}.png`,import.meta.url)));
console.log('Exported PWA icons: 192×192 and 512×512.');
