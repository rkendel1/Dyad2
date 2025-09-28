# Element Selector Chrome Extension

A Chrome extension (Manifest V3) that allows users to easily select any element on a webpage, capture its CSS selector, add optional notes, and copy the formatted result to the clipboard.

## Features

- **Element Selection**: Click any element on any webpage to capture its CSS selector
- **Smart Selector Generation**: Generates unique, reliable CSS selectors using IDs, classes, and structural information
- **Optional Notes**: Add notes to describe the selected element
- **Clipboard Integration**: Automatically copies results in "selector → note" format
- **Visual Feedback**: Highlights elements as you hover over them during selection
- **Keyboard Support**: Press ESC to cancel selection mode

## Installation

1. Clone this repository or download the files
2. Replace the placeholder icon files (`icon16.png`, `icon48.png`, `icon128.png`) with actual PNG icons
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right corner
5. Click "Load unpacked" and select the extension directory
6. The Element Selector extension should now appear in your extensions toolbar

## Usage

1. Click the Element Selector extension icon in the Chrome toolbar
2. Click the "Select Element" button in the popup
3. Move your mouse over any element on the webpage - it will be highlighted
4. Click on the element you want to select
5. The CSS selector will appear in the popup
6. Optionally add a note to describe the element
7. Click "Copy to Clipboard" to copy the formatted result

## File Structure

```
├── manifest.json       # Extension manifest (v3)
├── popup.html          # Extension popup interface
├── popup.css           # Popup styling
├── popup.js            # Popup functionality
├── content.js          # Content script for element selection
├── icon16.png          # 16x16 extension icon (placeholder)
├── icon48.png          # 48x48 extension icon (placeholder)
├── icon128.png         # 128x128 extension icon (placeholder)
└── README.md           # This file
```

## Technical Details

- **Manifest V3**: Uses the latest Chrome extension manifest version
- **Permissions**: Requires `activeTab` and `scripting` permissions
- **Content Script**: Runs on all pages to handle element selection
- **CSS Selector Generation**: Creates reliable selectors using element IDs, classes, and structural hierarchy
- **Clipboard API**: Uses the modern Clipboard API for copying results

## Output Format

The extension copies results to the clipboard in this format:
- With note: `css-selector → your note here`
- Without note: `css-selector`

## Browser Support

- Chrome 88+ (Manifest V3 support required)
- Other Chromium-based browsers with Manifest V3 support