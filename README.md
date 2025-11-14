# BetterFrame

A Chrome extension that enhances the Frame.io video review experience by adding convenient skip forward/backward buttons to the video player.

## Features

- **5-Second Skip Buttons**: Adds backward and forward skip buttons (5 seconds each) to the Frame.io video player controls
- **Strategic Placement**: Buttons are positioned right after the play button, before the loop button
- **Keyboard Shortcuts**:
  - `Shift + ←` - Skip backward 5 seconds
  - `Shift + →` - Skip forward 5 seconds
- **Seamless Integration**: Matches Frame.io's native styling and user experience
- **Automatic Detection**: Works automatically on all Frame.io review pages

## Installation

### From Source (Development Mode)

1. **Clone or download this repository**
   ```bash
   cd /Users/esmaeilatashpazgargari/Documents/GitHub/BetterFrame
   ```

2. **Generate PNG icons** (optional - for better appearance)

   You can use any SVG to PNG converter to create icons from `icons/icon.svg`:
   - `icons/icon16.png` (16x16)
   - `icons/icon48.png` (48x48)
   - `icons/icon128.png` (128x128)

   Or use an online tool like [CloudConvert](https://cloudconvert.com/svg-to-png) or install ImageMagick:
   ```bash
   # If you have ImageMagick installed:
   convert icons/icon.svg -resize 16x16 icons/icon16.png
   convert icons/icon.svg -resize 48x48 icons/icon48.png
   convert icons/icon.svg -resize 128x128 icons/icon128.png
   ```

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked"
   - Select the `BetterFrame` directory

4. **Use the extension**
   - Navigate to any Frame.io review page (e.g., `https://app.frame.io/reviews/...`)
   - The skip buttons will appear automatically next to the play button
   - Click the extension icon in your toolbar to view features and shortcuts

## Usage

1. Open any Frame.io review link
2. Wait for the video player to load
3. You'll see two new buttons appear next to the play button:
   - **«5** - Skip backward 5 seconds
   - **5»** - Skip forward 5 seconds
4. Click the buttons or use keyboard shortcuts to navigate the video

## File Structure

```
BetterFrame/
├── manifest.json          # Extension configuration
├── content.js            # Main script that injects buttons
├── styles.css            # Styling for the skip buttons
├── popup.html            # Extension popup interface
├── icons/                # Extension icons
│   ├── icon.svg          # Source SVG icon
│   ├── icon16.png        # 16x16 icon (to be generated)
│   ├── icon48.png        # 48x48 icon (to be generated)
│   └── icon128.png       # 128x128 icon (to be generated)
├── Frame.io.html         # Sample Frame.io page (for reference)
└── README.md             # This file
```

## Development

### How It Works

1. **Content Script Injection**: The extension injects `content.js` into all Frame.io pages
2. **Player Detection**: Monitors the page for the video player and controls to appear
3. **Button Creation**: Creates custom skip buttons with SVG icons
4. **Button Placement**: Inserts buttons after the play button
5. **Video Control**: Manipulates the HTML5 video element's `currentTime` property

### Customization

To change the skip duration, edit `content.js`:

```javascript
const SKIP_SECONDS = 5; // Change this value
```

To modify button styling, edit `styles.css`.

### Testing

1. Load the extension in developer mode
2. Open the browser console (F12)
3. Navigate to a Frame.io review page
4. Look for console messages starting with "BetterFrame:"
5. Test the buttons and keyboard shortcuts

## Troubleshooting

**Buttons not appearing?**
- Check that you're on a Frame.io review page (`app.frame.io`)
- Open the browser console and look for "BetterFrame:" messages
- Try refreshing the page
- Make sure the video player has loaded

**Buttons not working?**
- Check the browser console for errors
- Verify the video element is accessible
- Try clicking the play button first to ensure the video is initialized

**Styling looks wrong?**
- Frame.io may have updated their UI
- Check `styles.css` and adjust colors/spacing as needed

## Future Enhancements

Potential features to add:
- Customizable skip duration (via popup settings)
- Additional keyboard shortcuts
- Frame-by-frame navigation
- Custom playback speed controls
- Timestamp copy/paste functionality
- Comment quick-add buttons

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use and modify as needed.

## Credits

Created to enhance the Frame.io video review workflow for video editors and reviewers.
