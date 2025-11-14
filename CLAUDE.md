# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BetterFrame is a Chrome extension that enhances the Frame.io video review platform by adding skip forward/backward buttons (5-second intervals) to the video player controls. Frame.io is a web-based video collaboration platform where teams review videos and add timestamped comments.

## Development Commands

### Loading the Extension
```bash
# No build process required - this is vanilla JavaScript
# Load in Chrome:
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this directory
```

### Generating Icons (Optional)
```bash
# Using ImageMagick to convert SVG to PNG:
convert icons/icon.svg -resize 16x16 icons/icon16.png
convert icons/icon.svg -resize 48x48 icons/icon48.png
convert icons/icon.svg -resize 128x128 icons/icon128.png
```

### Testing
```bash
# No automated tests - manual testing required
# 1. Load extension in Chrome
# 2. Navigate to https://app.frame.io/reviews/...
# 3. Check browser console for "BetterFrame:" messages
# 4. Test skip buttons and keyboard shortcuts
```

## Architecture

### Chrome Extension Structure

This is a Manifest V3 Chrome extension with the following components:

1. **manifest.json**: Extension configuration
   - Defines permissions for app.frame.io
   - Specifies content scripts and resources
   - Configured for Manifest V3

2. **content.js**: Main functionality
   - Injected into all Frame.io pages
   - Monitors DOM for video player appearance
   - Dynamically injects skip buttons
   - Handles video time manipulation via HTML5 video API

3. **styles.css**: Button styling
   - Matches Frame.io's native UI aesthetics
   - Provides hover effects and tooltips
   - Uses CSS animations for smooth appearance

4. **popup.html**: Extension popup UI
   - Displays features and keyboard shortcuts
   - Standalone HTML with inline styles
   - No dependencies on external libraries

### Key Technical Patterns

**Dynamic Content Injection**
- Frame.io is a React-based single-page application
- The video player loads asynchronously
- Uses `MutationObserver` to detect when player appears
- Polls every 1 second as fallback
- Sets `buttonsInjected` flag to prevent duplicate injection

**Player Detection Strategy**
```javascript
// Tries multiple selectors as Frame.io structure may vary:
// 1. Find video element: document.querySelector('video')
// 2. Find controls: [class*="controls"], [class*="player-controls"], etc.
// 3. Find play button: by aria-label, title, or className
// 4. Insert new buttons after play button
```

**Video Control**
```javascript
// Direct HTML5 video API manipulation:
video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
```

**Keyboard Shortcuts**
- Shift + Left Arrow: Skip backward 5 seconds
- Shift + Right Arrow: Skip forward 5 seconds
- Only active when not typing in input/textarea

### Important Constraints

1. **No Build System**: Pure vanilla JavaScript, no transpilation
2. **No External Dependencies**: No npm packages or libraries
3. **Manifest V3**: Must use latest Chrome extension standards
4. **Frame.io DOM**: Relies on detecting Frame.io's player structure
   - May break if Frame.io updates their UI significantly
   - Uses defensive programming with multiple selector fallbacks

### Frame.io Integration Points

**Frame.io Page Structure** (as of v2025-10-15-18-19):
- Single-page React application
- Video player uses standard HTML5 `<video>` element
- Controls are rendered dynamically after video loads
- Play button can be identified via aria-label="play" or className
- Loop button typically follows play/pause controls

**Injection Strategy**:
```javascript
// Find play button
const playButton = findPlayButton();
const parent = playButton.parentElement;
const nextSibling = playButton.nextElementSibling;

// Insert our buttons between play button and next control
parent.insertBefore(backwardButton, nextSibling);
parent.insertBefore(forwardButton, nextSibling);
```

## Common Development Tasks

### Adding New Features

**To add a new skip duration**:
1. Modify `SKIP_SECONDS` constant in content.js
2. Update button labels and aria-labels
3. Update popup.html to reflect new duration
4. Update README.md

**To add new buttons**:
1. Create button using `createButton()` function
2. Add SVG icon constant
3. Insert in desired position using DOM manipulation
4. Update styles.css if needed

**To add settings/preferences**:
1. Add storage permission to manifest.json
2. Create options page (options.html)
3. Use chrome.storage.sync API to save/load preferences
4. Update content.js to read settings

### Debugging

**Console Logging**:
- Extension logs messages prefixed with "BetterFrame:"
- Check for "Video element not found" or "Play button not found"
- Verify "Skip buttons injected successfully!" appears

**Common Issues**:
1. Buttons not appearing → Player detection failing
   - Frame.io changed their DOM structure
   - Update selectors in `findControlsContainer()` and `findPlayButton()`

2. Buttons injected but not visible → CSS issues
   - Check z-index conflicts
   - Verify parent container display properties

3. Video skip not working → Video element access issues
   - Check if video has duration property
   - Verify currentTime is writable

### Frame.io DOM Inspection

When Frame.io updates their UI, inspect their structure:
```javascript
// In browser console on Frame.io:
document.querySelector('video') // Find video
document.querySelectorAll('button') // Find all buttons
// Look for play button aria-label or data attributes
// Identify parent container for controls
```

## File Reference

- `Frame.io.html`: Saved copy of Frame.io page for reference (not used by extension)
- `Frame.io_files/`: Assets from saved page (not used by extension)
- `icons/icon.svg`: Source SVG for generating PNG icons
