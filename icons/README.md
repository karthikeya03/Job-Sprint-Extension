# JobSprint Extension Icons Setup

The `icons/` directory needs three PNG files for the Chrome extension:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Generate Icons Using JavaScript

You can generate placeholder icons using this Node.js script. Save it as `generate-icons.js` in the root of jobsprint-extension/:

```javascript
const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Draw text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.floor(size * 0.5)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JS', size / 2, size / 2);
    
    return canvas.toBuffer('image/png');
}

// Generate all sizes
const sizes = [16, 48, 128];
for (const size of sizes) {
    const buffer = generateIcon(size);
    fs.writeFileSync(`icons/icon${size}.png`, buffer);
    console.log(`Generated icon${size}.png`);
}
```

## Installation Steps

1. Install canvas dependency:
```bash
npm install canvas
```

2. Run the generator:
```bash
node generate-icons.js
```

3. The PNG files will be created in `icons/` directory

## Alternative: Use Online Tools

If you prefer not to install dependencies, use:
- [Favicon Generator](https://favicon.io/) - Upload a design or create from text
- [Icon Generator](https://www.favicon-generator.org/) - Create from scratch

Then place the generated PNGs in the `icons/` folder.

## Manual Option

Create simple placeholder icons by:
1. Using Photoshop, GIMP, or Figma
2. Creating 16x16, 48x48, and 128x128 pixel images
3. Using the gradient (from #667eea to #764ba2) with "JS" text centrally placed
