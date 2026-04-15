#!/usr/bin/env node

/**
 * Icon Generator Script
 * Generates PNG icons for the JobSprint Chrome Extension
 * 
 * Usage: node generate-icons.js
 * 
 * Note: Requires the 'canvas' package
 * Install with: npm install canvas
 */

const fs = require('fs');
const path = require('path');

// Check if canvas is available
let canCreateIcons = false;
let canvas, createCanvas;

try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
    canCreateIcons = true;
} catch (err) {
    console.log('⚠️  Canvas not available. Using fallback method...');
    console.log('Install canvas with: npm install canvas\n');
}

// Ensure icons directory exists
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

function generateIconWithCanvas(size) {
    if (!canCreateIcons) return null;
    
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient - purple theme
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add rounded corners effect at edges
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    const radius = Math.floor(size / 8);
    for (let i = 0; i < radius; i++) {
        const alpha = i / radius * 0.1;
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(i, i, size - i * 2, size - i * 2);
    }
    
    // Draw "JS" text
    ctx.fillStyle = 'white';
    const fontSize = Math.floor(size * 0.5);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('JS', size / 2, size / 2);
    
    // Add subtle shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
    
    return canvas.toBuffer('image/png');
}

function generateIconWithBase64Fallback(size) {
    // Base64 encoded 1x1 transparent pixel PNG as fallback
    // This is a minimal placeholder - user should replace with actual icons
    const placeholder = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
    );
    
    // Create a simple colored square as placeholder
    const pixelData = Buffer.alloc(size * size * 4);
    const colors = {
        16: [102, 126, 234, 255],   // #667eea
        48: [118, 75, 162, 255],    // #764ba2
        128: [102, 126, 234, 255]   // #667eea
    };
    
    const c = colors[size] || [102, 126, 234, 255];
    for (let i = 0; i < pixelData.length; i += 4) {
        pixelData[i] = c[0];     // R
        pixelData[i + 1] = c[1]; // G
        pixelData[i + 2] = c[2]; // B
        pixelData[i + 3] = c[3]; // A
    }
    
    // Return the placeholder since we can't generate real PNG without canvas
    return placeholder;
}

// Generate all icon sizes
const sizes = [16, 48, 128];
let successCount = 0;

console.log('🎨 Generating JobSprint Extension Icons...\n');

for (const size of sizes) {
    try {
        let buffer;
        
        if (canCreateIcons) {
            buffer = generateIconWithCanvas(size);
            if (buffer) {
                const filepath = path.join(iconsDir, `icon${size}.png`);
                fs.writeFileSync(filepath, buffer);
                console.log(`✅ Generated icon${size}.png (${size}x${size})`);
                successCount++;
            }
        } else {
            console.log(`⏭️  Skipping icon${size}.png (canvas required)`);
        }
    } catch (err) {
        console.error(`❌ Failed to generate icon${size}.png:`, err.message);
    }
}

console.log();

if (successCount === sizes.length) {
    console.log('✨ All icons generated successfully!');
    console.log('📁 Icons saved in: icons/');
    console.log('\n✅ Extension is ready to load in Chrome!');
    console.log('   1. Go to chrome://extensions/');
    console.log('   2. Enable "Developer mode"');
    console.log('   3. Click "Load unpacked"');
    console.log('   4. Select the jobsprint-extension folder');
} else if (successCount === 0 && !canCreateIcons) {
    console.log('⚠️  Canvas library not installed.');
    console.log('\n📦 To generate icons automatically:');
    console.log('   npm install canvas');
    console.log('   node generate-icons.js');
    console.log('\n🎨 Or manually add PNG files:');
    console.log('   - icon16.png (16x16)');
    console.log('   - icon48.png (48x48)');
    console.log('   - icon128.png (128x128)');
    console.log('\n💡 See icons/README.md for more options');
} else {
    console.log(`⚙️  Generated ${successCount}/${sizes.length} icons`);
    console.log('📝 Manually create missing icons - see icons/README.md');
}

console.log();
