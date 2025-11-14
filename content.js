// BetterFrame - Enhanced Frame.io Controls
// This content script adds 5-second skip forward/backward buttons to the Frame.io video player

(function() {
  'use strict';

  // Configuration
  const SKIP_SECONDS = 5;
  const CHECK_INTERVAL = 1000; // Check every 1 second for player
  let buttonsInjected = false;

  // SVG icons for the buttons
  const BACKWARD_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 18V6L2.5 12L11 18Z" fill="currentColor"/>
    <path d="M19 18V6L10.5 12L19 18Z" fill="currentColor"/>
    <text x="6" y="16" font-size="8" fill="currentColor" font-weight="bold">5</text>
  </svg>`;

  const FORWARD_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 6V18L21.5 12L13 6Z" fill="currentColor"/>
    <path d="M5 6V18L13.5 12L5 6Z" fill="currentColor"/>
    <text x="14" y="16" font-size="8" fill="currentColor" font-weight="bold">5</text>
  </svg>`;

  /**
   * Find the video element on the page
   */
  function findVideoElement() {
    return document.querySelector('video');
  }

  /**
   * Find the play button in the controls
   * Frame.io typically uses a controls container with buttons
   */
  function findControlsContainer() {
    // Try multiple selectors as Frame.io's structure may vary
    const selectors = [
      '[class*="controls"]',
      '[class*="player-controls"]',
      '[class*="PlayerControls"]',
      '[class*="video-controls"]',
      'video + div', // Controls often come right after video element
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if this element contains buttons
        const buttons = element.querySelectorAll('button');
        if (buttons.length > 0) {
          return element;
        }
      }
    }
    return null;
  }

  /**
   * Find the play button specifically
   * Frame.io uses <div role="button"> instead of <button> elements
   */
  function findPlayButton() {
    // First try to find div with role="button" and aria-label="Play"
    const divButtons = document.querySelectorAll('[role="button"]');
    for (const button of divButtons) {
      const ariaLabel = button.getAttribute('aria-label') || '';
      if (ariaLabel.toLowerCase().includes('play')) {
        return button;
      }
    }

    // Fallback: try regular button elements
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      const ariaLabel = button.getAttribute('aria-label') || '';
      const title = button.getAttribute('title') || '';
      const className = button.className || '';

      if (
        ariaLabel.toLowerCase().includes('play') ||
        title.toLowerCase().includes('play') ||
        className.toLowerCase().includes('play')
      ) {
        return button;
      }
    }
    return null;
  }

  /**
   * Skip video forward or backward by specified seconds
   */
  function skipVideo(seconds) {
    const video = findVideoElement();
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    }
  }

  /**
   * Create a control button matching Frame.io's style
   */
  function createButton(icon, onClick, ariaLabel) {
    const button = document.createElement('div');
    button.className = 'betterframe-skip-button';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('title', ariaLabel);
    button.innerHTML = icon;

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
      // Remove focus so space key returns to play/pause functionality
      button.blur();
    });

    // Add keyboard support (Enter and Space)
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onClick();
        // Remove focus so space key returns to play/pause functionality
        button.blur();
      }
    });

    return button;
  }

  /**
   * Inject the skip buttons into the player controls
   */
  function injectButtons() {
    if (buttonsInjected) return;

    const video = findVideoElement();
    if (!video) {
      console.log('BetterFrame: Video element not found yet');
      return;
    }

    const playButton = findPlayButton();
    if (!playButton) {
      console.log('BetterFrame: Play button not found yet');
      return;
    }

    // Create the buttons
    const backwardButton = createButton(
      BACKWARD_ICON,
      () => skipVideo(-SKIP_SECONDS),
      `Skip backward ${SKIP_SECONDS} seconds`
    );

    const forwardButton = createButton(
      FORWARD_ICON,
      () => skipVideo(SKIP_SECONDS),
      `Skip forward ${SKIP_SECONDS} seconds`
    );

    // Insert buttons after the play button
    const parent = playButton.parentElement;
    const nextSibling = playButton.nextElementSibling;

    if (nextSibling) {
      parent.insertBefore(backwardButton, nextSibling);
      parent.insertBefore(forwardButton, nextSibling);
    } else {
      parent.appendChild(backwardButton);
      parent.appendChild(forwardButton);
    }

    buttonsInjected = true;
    console.log('BetterFrame: Skip buttons injected successfully!');

    // Add keyboard shortcuts
    addKeyboardShortcuts();
  }

  /**
   * Add keyboard shortcuts for skipping
   */
  function addKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Left arrow: skip backward 5 seconds
      if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        skipVideo(-SKIP_SECONDS);
      }
      // Right arrow: skip forward 5 seconds
      else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        skipVideo(SKIP_SECONDS);
      }
    });
  }

  /**
   * Monitor for the player to appear on the page
   * Frame.io is a single-page app, so we need to watch for route changes
   */
  function monitorForPlayer() {
    const interval = setInterval(() => {
      if (!buttonsInjected) {
        injectButtons();
      }
    }, CHECK_INTERVAL);

    // Also watch for DOM changes
    const observer = new MutationObserver(() => {
      if (!buttonsInjected) {
        injectButtons();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Start monitoring when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', monitorForPlayer);
  } else {
    monitorForPlayer();
  }

  console.log('BetterFrame: Extension loaded');
})();
