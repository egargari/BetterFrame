// BetterFrame - Enhanced Frame.io Controls
// This content script adds 5-second skip forward/backward buttons to the Frame.io video player

(function() {
  'use strict';

  // Configuration
  const SKIP_SECONDS = 5;
  const CHECK_INTERVAL = 1000; // Check every 1 second for player
  let buttonsInjected = false;
  let transcriptInjected = false;
  let ffmpegLoaded = false;
  let ffmpeg = null;

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

  const TRANSCRIBE_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM17 11H13V17H11V11H7V9H17V11Z" fill="currentColor"/>
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
   * Get OpenAI API key from chrome storage
   */
  async function getApiKey() {
    try {
      console.log('[BetterFrame Transcribe] Retrieving API key from storage...');
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['openaiApiKey'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[BetterFrame Transcribe] Error retrieving API key:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else if (!result.openaiApiKey) {
            console.error('[BetterFrame Transcribe] No API key found in storage');
            reject(new Error('No API key found. Please add your OpenAI API key in the extension popup.'));
          } else {
            console.log('[BetterFrame Transcribe] API key retrieved successfully');
            resolve(result.openaiApiKey);
          }
        });
      });
    } catch (error) {
      console.error('[BetterFrame Transcribe] Exception getting API key:', error);
      throw error;
    }
  }

  /**
   * Get the video source URL
   */
  function getVideoSource() {
    try {
      console.log('[BetterFrame Transcribe] Getting video source...');
      const video = findVideoElement();
      if (!video) {
        throw new Error('Video element not found');
      }

      const src = video.src || video.currentSrc;
      if (!src) {
        throw new Error('Video source URL not found');
      }

      console.log('[BetterFrame Transcribe] Video source found:', src.substring(0, 50) + '...');
      return src;
    } catch (error) {
      console.error('[BetterFrame Transcribe] Error getting video source:', error);
      throw error;
    }
  }

  /**
   * Load FFmpeg.wasm library
   */
  async function loadFFmpeg() {
    if (ffmpegLoaded && ffmpeg) {
      console.log('[BetterFrame Transcribe] FFmpeg already loaded');
      return ffmpeg;
    }

    try {
      console.log('[BetterFrame Transcribe] Loading FFmpeg.wasm...');

      // Load FFmpeg from CDN if not already loaded
      if (!window.FFmpegWASM) {
        console.log('[BetterFrame Transcribe] Loading FFmpeg script from CDN...');

        // Try multiple CDNs in case one is blocked
        const cdnUrls = [
          'https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.min.js',
          'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.min.js'
        ];

        let loaded = false;
        for (const url of cdnUrls) {
          try {
            console.log(`[BetterFrame Transcribe] Trying CDN: ${url}`);
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = url;
              script.crossOrigin = 'anonymous';
              script.onload = () => {
                console.log('[BetterFrame Transcribe] FFmpeg script loaded from', url);
                // Wait a bit for the library to initialize
                setTimeout(resolve, 200);
              };
              script.onerror = (e) => {
                console.error('[BetterFrame Transcribe] Failed to load from', url, e);
                reject(new Error(`Failed to load from ${url}`));
              };
              document.head.appendChild(script);
            });
            loaded = true;
            break;
          } catch (err) {
            console.log('[BetterFrame Transcribe] CDN failed, trying next...', err.message);
          }
        }

        if (!loaded) {
          throw new Error('Failed to load FFmpeg from all CDN sources. This may be due to Frame.io CSP restrictions.');
        }
      }

      // Verify FFmpegWASM is available
      if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
        throw new Error('FFmpegWASM library not available after loading');
      }

      // Create FFmpeg instance
      console.log('[BetterFrame Transcribe] Creating FFmpeg instance...');
      const { FFmpeg } = window.FFmpegWASM;
      ffmpeg = new FFmpeg();

      // Set up logging
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      ffmpeg.on('progress', ({ progress }) => {
        console.log(`[FFmpeg] Progress: ${(progress * 100).toFixed(1)}%`);
      });

      // Load FFmpeg core
      console.log('[BetterFrame Transcribe] Loading FFmpeg core (this may take 10-30 seconds)...');

      // Try loading core with different CDNs
      try {
        await ffmpeg.load({
          coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
        });
      } catch (err) {
        console.log('[BetterFrame Transcribe] unpkg failed, trying jsdelivr...', err.message);
        await ffmpeg.load({
          coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
          wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
        });
      }

      ffmpegLoaded = true;
      console.log('[BetterFrame Transcribe] FFmpeg loaded successfully!');
      return ffmpeg;

    } catch (error) {
      console.error('[BetterFrame Transcribe] Failed to load FFmpeg:', error);
      ffmpegLoaded = false;
      ffmpeg = null;
      throw new Error('Failed to load FFmpeg: ' + error.message);
    }
  }

  /**
   * Extract audio from video using FFmpeg.wasm
   */
  async function extractAudioFromVideo(videoBlob) {
    try {
      console.log('[BetterFrame Transcribe] Extracting audio using FFmpeg.wasm...');

      // Load FFmpeg if not already loaded
      const ffmpegInstance = await loadFFmpeg();

      // Convert blob to Uint8Array
      console.log('[BetterFrame Transcribe] Reading video data...');
      const videoData = new Uint8Array(await videoBlob.arrayBuffer());

      // Write video file to FFmpeg filesystem
      console.log('[BetterFrame Transcribe] Writing video to FFmpeg filesystem...');
      await ffmpegInstance.writeFile('input.mp4', videoData);

      // Extract audio as MP3 with compression
      console.log('[BetterFrame Transcribe] Extracting and compressing audio...');
      await ffmpegInstance.exec([
        '-i', 'input.mp4',
        '-vn',                    // No video
        '-acodec', 'libmp3lame',  // MP3 codec
        '-b:a', '64k',            // 64kbps bitrate (good for speech)
        '-ar', '16000',           // 16kHz sample rate (optimal for Whisper)
        '-ac', '1',               // Mono
        'output.mp3'
      ]);

      // Read the output file
      console.log('[BetterFrame Transcribe] Reading extracted audio...');
      const audioData = await ffmpegInstance.readFile('output.mp3');

      // Clean up
      await ffmpegInstance.deleteFile('input.mp4');
      await ffmpegInstance.deleteFile('output.mp3');

      // Convert to Blob
      const audioBlob = new Blob([audioData.buffer], { type: 'audio/mp3' });
      console.log('[BetterFrame Transcribe] Audio extracted successfully, size:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB');

      return audioBlob;

    } catch (error) {
      console.error('[BetterFrame Transcribe] FFmpeg extraction failed:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI Whisper API to transcribe video
   */
  async function transcribeVideo(videoUrl, apiKey) {
    try {
      console.log('[BetterFrame Transcribe] Starting transcription process...');

      // First, we need to fetch the video as a blob
      console.log('[BetterFrame Transcribe] Fetching video file...');
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
      }

      const videoBlob = await videoResponse.blob();
      const videoSizeMB = videoBlob.size / 1024 / 1024;
      console.log('[BetterFrame Transcribe] Video fetched, size:', videoSizeMB.toFixed(2), 'MB');

      // Whisper API has a 25MB limit
      const MAX_SIZE_MB = 25;
      const EXTRACT_AUDIO_THRESHOLD_MB = 5; // Always extract audio for videos > 5MB using FFmpeg

      let fileToUpload = videoBlob;
      let fileName = 'video.mp4';

      // Always try to extract audio if video is large (FFmpeg handles CORS issues)
      if (videoSizeMB > EXTRACT_AUDIO_THRESHOLD_MB) {
        console.log(`[BetterFrame Transcribe] Video is ${videoSizeMB.toFixed(2)}MB, extracting audio with FFmpeg...`);
        console.log('[BetterFrame Transcribe] This may take 10-30 seconds on first use (loading FFmpeg)...');

        try {
          const audioBlob = await extractAudioFromVideo(videoBlob);
          const audioSizeMB = audioBlob.size / 1024 / 1024;

          console.log('[BetterFrame Transcribe] Audio extraction complete');
          console.log('[BetterFrame Transcribe] Original video:', videoSizeMB.toFixed(2), 'MB');
          console.log('[BetterFrame Transcribe] Extracted audio:', audioSizeMB.toFixed(2), 'MB');

          // Check if audio extraction produced valid data
          if (audioSizeMB < 0.01) {
            throw new Error('Audio extraction produced empty file');
          }

          console.log('[BetterFrame Transcribe] Size reduction:', ((1 - audioSizeMB / videoSizeMB) * 100).toFixed(1), '%');

          if (audioSizeMB > MAX_SIZE_MB) {
            throw new Error(
              `Audio file is still too large (${audioSizeMB.toFixed(2)}MB) after extraction.\n\n` +
              `The video is too long. OpenAI Whisper has a ${MAX_SIZE_MB}MB limit.\n\n` +
              `Please use a shorter video clip (under ${Math.floor((MAX_SIZE_MB / audioSizeMB) * (videoBlob.size / 1024 / 1024 / audioSizeMB))} minutes).`
            );
          }

          fileToUpload = audioBlob;
          fileName = 'audio.mp3';

        } catch (extractError) {
          console.error('[BetterFrame Transcribe] FFmpeg audio extraction failed:', extractError);

          // If extraction fails and video is over limit, throw error
          if (videoSizeMB > MAX_SIZE_MB) {
            throw new Error(
              `Video file is too large (${videoSizeMB.toFixed(2)}MB) and audio extraction failed.\n\n` +
              `Error: ${extractError.message}\n\n` +
              `Please try a shorter video (under ${MAX_SIZE_MB}MB).`
            );
          }

          // If extraction fails but video is under limit, use original video
          console.log('[BetterFrame Transcribe] Falling back to sending original video file');
          fileToUpload = videoBlob;
          fileName = 'video.mp4';
        }
      } else if (videoSizeMB > MAX_SIZE_MB) {
        // Small video but somehow over limit (shouldn't happen)
        throw new Error(
          `Video file is too large (${videoSizeMB.toFixed(2)}MB).\n\n` +
          `OpenAI Whisper has a ${MAX_SIZE_MB}MB file size limit.\n\n` +
          `Please use a shorter video clip.`
        );
      }

      // Create form data for Whisper API
      const formData = new FormData();
      formData.append('file', fileToUpload, fileName);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      console.log('[BetterFrame Transcribe] Uploading to OpenAI Whisper API...');
      console.log('[BetterFrame Transcribe] File:', fileName, 'Size:', (fileToUpload.size / 1024 / 1024).toFixed(2), 'MB');

      // Call Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BetterFrame Transcribe] API error response:', errorText);

        // Parse error for better user message
        let errorMessage = `Whisper API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message;
          }
        } catch (e) {
          errorMessage += ` - ${errorText}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[BetterFrame Transcribe] Transcription completed successfully');
      console.log('[BetterFrame Transcribe] Transcript preview:', result.text?.substring(0, 100) + '...');

      // Log full transcript for debugging
      console.log('[BetterFrame Transcribe] === FULL TRANSCRIPT ===');
      console.log(result.text);
      console.log('[BetterFrame Transcribe] === END TRANSCRIPT ===');

      if (result.segments && result.segments.length > 0) {
        console.log(`[BetterFrame Transcribe] Total segments: ${result.segments.length}`);
        console.log('[BetterFrame Transcribe] First few segments:');
        result.segments.slice(0, 5).forEach((seg, i) => {
          console.log(`  ${i + 1}. [${formatTimestamp(seg.start)}] ${seg.text}`);
        });
      }

      return result;
    } catch (error) {
      console.error('[BetterFrame Transcribe] Error during transcription:', error);
      throw error;
    }
  }

  /**
   * Create and display transcript UI
   */
  function createTranscriptUI(transcriptData) {
    try {
      console.log('[BetterFrame Transcribe] Creating transcript UI...');

      // Find the comments container
      const commentsContainer = document.querySelector('.PlayerPageLayout__ComposerContainerOuter-g2qz6t-7.dZIRvZ');
      if (!commentsContainer) {
        throw new Error('Comments container not found');
      }

      // Remove existing transcript if any
      const existingTranscript = document.getElementById('betterframe-transcript');
      if (existingTranscript) {
        existingTranscript.remove();
      }

      // Create transcript container
      const transcriptContainer = document.createElement('div');
      transcriptContainer.id = 'betterframe-transcript';
      transcriptContainer.className = 'betterframe-transcript-container';

      // Create header
      const header = document.createElement('div');
      header.className = 'betterframe-transcript-header';
      header.innerHTML = '<h3>AI Transcript</h3>';

      // Create content area
      const content = document.createElement('div');
      content.className = 'betterframe-transcript-content';

      // Add segments with timestamps
      if (transcriptData.segments && transcriptData.segments.length > 0) {
        transcriptData.segments.forEach((segment, index) => {
          const segmentEl = document.createElement('div');
          segmentEl.className = 'betterframe-transcript-segment';
          segmentEl.dataset.startTime = segment.start;
          segmentEl.dataset.endTime = segment.end;

          const timestamp = document.createElement('span');
          timestamp.className = 'betterframe-transcript-timestamp';
          timestamp.textContent = formatTimestamp(segment.start);
          timestamp.dataset.time = segment.start;

          const text = document.createElement('span');
          text.className = 'betterframe-transcript-text';
          text.textContent = segment.text;

          segmentEl.appendChild(timestamp);
          segmentEl.appendChild(text);
          content.appendChild(segmentEl);

          console.log(`[BetterFrame Transcribe] Added segment ${index + 1}:`, segment.text.substring(0, 30) + '...');
        });
      } else {
        // If no segments, just show the full text
        const textEl = document.createElement('p');
        textEl.textContent = transcriptData.text || 'No transcription available';
        content.appendChild(textEl);
      }

      transcriptContainer.appendChild(header);
      transcriptContainer.appendChild(content);

      // Insert before comments container
      commentsContainer.parentNode.insertBefore(transcriptContainer, commentsContainer);

      console.log('[BetterFrame Transcribe] Transcript UI created successfully');

      // Add timestamp interactivity
      addTimestampInteractivity();

    } catch (error) {
      console.error('[BetterFrame Transcribe] Error creating transcript UI:', error);
      throw error;
    }
  }

  /**
   * Format timestamp from seconds to MM:SS
   */
  function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Add timestamp interactivity (hover and click)
   */
  function addTimestampInteractivity() {
    try {
      console.log('[BetterFrame Transcribe] Adding timestamp interactivity...');

      const segments = document.querySelectorAll('.betterframe-transcript-segment');
      const video = findVideoElement();

      if (!video) {
        console.error('[BetterFrame Transcribe] Video element not found for interactivity');
        return;
      }

      segments.forEach((segment) => {
        const timestamp = segment.querySelector('.betterframe-transcript-timestamp');
        const startTime = parseFloat(segment.dataset.startTime);

        // Hover effect
        segment.addEventListener('mouseenter', () => {
          segment.classList.add('betterframe-transcript-segment-hover');
        });

        segment.addEventListener('mouseleave', () => {
          segment.classList.remove('betterframe-transcript-segment-hover');
        });

        // Click to jump to timestamp
        timestamp.addEventListener('click', () => {
          console.log(`[BetterFrame Transcribe] Jumping to timestamp: ${startTime}s`);
          video.currentTime = startTime;
          segment.classList.add('betterframe-transcript-segment-active');

          // Remove active class after 2 seconds
          setTimeout(() => {
            segment.classList.remove('betterframe-transcript-segment-active');
          }, 2000);
        });
      });

      console.log(`[BetterFrame Transcribe] Added interactivity to ${segments.length} segments`);
    } catch (error) {
      console.error('[BetterFrame Transcribe] Error adding timestamp interactivity:', error);
    }
  }

  /**
   * Show/hide loading message
   */
  function showLoadingMessage(message) {
    let loadingEl = document.getElementById('betterframe-loading');
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.id = 'betterframe-loading';
      loadingEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 100000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
      document.body.appendChild(loadingEl);
    }
    loadingEl.textContent = message;
    loadingEl.style.display = 'block';
  }

  function hideLoadingMessage() {
    const loadingEl = document.getElementById('betterframe-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  /**
   * Main transcribe handler
   */
  async function handleTranscribe() {
    const transcribeBtn = document.getElementById('betterframe-transcribe-btn');

    try {
      console.log('[BetterFrame Transcribe] === Starting transcription process ===');

      // Disable button and update UI
      if (transcribeBtn) {
        transcribeBtn.style.opacity = '0.5';
        transcribeBtn.style.pointerEvents = 'none';
        transcribeBtn.setAttribute('title', 'Transcribing...');
      }

      showLoadingMessage('🎬 Starting transcription...');

      // Get API key
      showLoadingMessage('🔑 Checking API key...');
      const apiKey = await getApiKey();

      // Get video source
      showLoadingMessage('📹 Loading video...');
      const videoUrl = getVideoSource();

      // Transcribe video (this will show its own loading messages via console)
      showLoadingMessage('🎵 Processing audio (this may take 30-60 seconds)...');
      const transcript = await transcribeVideo(videoUrl, apiKey);

      // Create and display UI
      showLoadingMessage('📝 Creating transcript...');
      createTranscriptUI(transcript);

      console.log('[BetterFrame Transcribe] === Transcription process completed successfully ===');

      showLoadingMessage('✅ Transcription complete!');
      setTimeout(hideLoadingMessage, 2000);

      // Re-enable button
      if (transcribeBtn) {
        transcribeBtn.style.opacity = '1';
        transcribeBtn.style.pointerEvents = 'auto';
        transcribeBtn.setAttribute('title', 'Transcribe video with AI');
      }

    } catch (error) {
      console.error('[BetterFrame Transcribe] === Transcription failed ===');
      console.error('[BetterFrame Transcribe] Error:', error.message);
      console.error('[BetterFrame Transcribe] Stack:', error.stack);

      hideLoadingMessage();

      // Show error to user
      alert(`Transcription failed: ${error.message}\n\nCheck the console for details.`);

      // Re-enable button
      if (transcribeBtn) {
        transcribeBtn.style.opacity = '1';
        transcribeBtn.style.pointerEvents = 'auto';
        transcribeBtn.setAttribute('title', 'Transcribe video with AI');
      }
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

    const transcribeButton = createButton(
      TRANSCRIBE_ICON,
      () => handleTranscribe(),
      'Transcribe video with AI'
    );
    transcribeButton.id = 'betterframe-transcribe-btn';

    // Insert buttons after the play button
    const parent = playButton.parentElement;
    const nextSibling = playButton.nextElementSibling;

    if (nextSibling) {
      parent.insertBefore(backwardButton, nextSibling);
      parent.insertBefore(forwardButton, nextSibling);
      parent.insertBefore(transcribeButton, nextSibling);
    } else {
      parent.appendChild(backwardButton);
      parent.appendChild(forwardButton);
      parent.appendChild(transcribeButton);
    }

    buttonsInjected = true;
    console.log('[BetterFrame] Skip and transcribe buttons injected successfully!');

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
