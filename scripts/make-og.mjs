// 1200x630 OG card from the hero photo, metadata stripped (sharp ships with astro).
import sharp from 'sharp';
await sharp('src/assets/photos/hero-riding-tbilisi-freedom-square.png')
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 72 })
  .toFile('public/og.jpg');
console.log('og.jpg 1200x630 written');
