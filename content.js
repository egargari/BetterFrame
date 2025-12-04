// BetterFrame - Enhanced Frame.io Controls
// This content script adds 5-second skip forward/backward buttons to the Frame.io video player

(function() {
  'use strict';

  // Configuration
  const SKIP_SECONDS = 5;
  const CHECK_INTERVAL = 1000; // Check every 1 second for player
  let buttonsInjected = false;
  let transcriptInjected = false;

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
   * Get AssemblyAI API key from chrome storage
   */
  async function getApiKey() {
    try {
      console.log('[BetterFrame Transcribe] Retrieving API key from storage...');
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['assemblyaiApiKey'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('[BetterFrame Transcribe] Error retrieving API key:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else if (!result.assemblyaiApiKey) {
            console.error('[BetterFrame Transcribe] No API key found in storage');
            reject(new Error('No API key found. Please add your AssemblyAI API key in the extension popup.'));
          } else {
            console.log('[BetterFrame Transcribe] API key retrieved successfully');
            resolve(result.assemblyaiApiKey);
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
   * Upload video to AssemblyAI
   */
  async function uploadVideoToAssemblyAI(videoBlob, apiKey) {
    console.log('[BetterFrame Transcribe] ========================================');
    console.log('[BetterFrame Transcribe] STEP 1: Uploading video to AssemblyAI');
    console.log('[BetterFrame Transcribe] ========================================');
    console.log('[BetterFrame Transcribe] Video size:', (videoBlob.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('[BetterFrame Transcribe] Starting upload...');

    const startTime = Date.now();
    const response = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/octet-stream'
      },
      body: videoBlob
    });

    const uploadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('[BetterFrame Transcribe] Upload completed in', uploadTime, 'seconds');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BetterFrame Transcribe] Upload error:', errorText);
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[BetterFrame Transcribe] ✓ Upload successful!');
    console.log('[BetterFrame Transcribe] Upload URL:', data.upload_url);
    return data.upload_url;
  }

  /**
   * Create transcription job
   */
  async function createTranscription(uploadUrl, apiKey) {
    console.log('[BetterFrame Transcribe] ========================================');
    console.log('[BetterFrame Transcribe] STEP 2: Creating transcription job');
    console.log('[BetterFrame Transcribe] ========================================');
    console.log('[BetterFrame Transcribe] Sending request to AssemblyAI...');

    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: uploadUrl
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BetterFrame Transcribe] Transcription creation error:', errorText);
      throw new Error(`Failed to create transcription: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[BetterFrame Transcribe] ✓ Transcription job created successfully!');
    console.log('[BetterFrame Transcribe] Job ID:', data.id);
    console.log('[BetterFrame Transcribe] Status:', data.status);
    return data.id;
  }

  /**
   * Poll for transcription completion
   */
  async function pollTranscription(transcriptId, apiKey) {
    console.log('[BetterFrame Transcribe] ========================================');
    console.log('[BetterFrame Transcribe] STEP 3: Polling for completion');
    console.log('[BetterFrame Transcribe] ========================================');
    console.log('[BetterFrame Transcribe] This may take 1-3 minutes depending on video length...');
    console.log('[BetterFrame Transcribe] Checking status every 3 seconds...');

    let pollCount = 0;
    const startTime = Date.now();

    while (true) {
      pollCount++;
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[BetterFrame Transcribe] Poll #${pollCount} (${elapsedTime}s elapsed) - Checking status...`);

      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'authorization': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BetterFrame Transcribe] Polling error:', errorText);
        throw new Error(`Failed to get transcription status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[BetterFrame Transcribe] Status: ${data.status.toUpperCase()}`);

      if (data.status === 'completed') {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('[BetterFrame Transcribe] ========================================');
        console.log('[BetterFrame Transcribe] ✓ TRANSCRIPTION COMPLETED!');
        console.log('[BetterFrame Transcribe] ========================================');
        console.log('[BetterFrame Transcribe] Total time:', totalTime, 'seconds');
        console.log('[BetterFrame Transcribe] Text length:', data.text?.length || 0, 'characters');
        console.log('[BetterFrame Transcribe] Word count:', data.words?.length || 0, 'words');
        return data;
      } else if (data.status === 'error') {
        console.error('[BetterFrame Transcribe] Transcription error:', data.error);
        throw new Error(`Transcription failed: ${data.error}`);
      } else if (data.status === 'processing') {
        console.log('[BetterFrame Transcribe] ⏳ Processing audio... (this is the slowest part)');
      } else if (data.status === 'queued') {
        console.log('[BetterFrame Transcribe] 📋 Job queued, waiting to start...');
      }

      // Wait 3 seconds before next poll
      console.log('[BetterFrame Transcribe] Waiting 3 seconds before next check...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  /**
   * Convert AssemblyAI words to segments (group by sentences/pauses)
   */
  function convertWordsToSegments(words) {
    if (!words || words.length === 0) {
      console.log('[BetterFrame Transcribe] No words to convert to segments');
      return [];
    }

    console.log('[BetterFrame Transcribe] Converting', words.length, 'words into segments...');
    console.log('[BetterFrame Transcribe] Grouping by sentences and pauses...');

    const segments = [];
    let currentSegment = {
      start: words[0].start / 1000, // Convert ms to seconds
      end: words[0].end / 1000,
      text: ''
    };

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordStart = word.start / 1000;
      const wordEnd = word.end / 1000;

      // Add word to current segment
      currentSegment.text += (currentSegment.text ? ' ' : '') + word.text;
      currentSegment.end = wordEnd;

      // Check if we should start a new segment
      // (after punctuation or if there's a pause > 1 second)
      const isPunctuation = /[.!?]$/.test(word.text);
      const nextWordGap = i < words.length - 1 ? (words[i + 1].start / 1000 - wordEnd) : 0;
      const shouldBreak = isPunctuation || nextWordGap > 1.0;

      if (shouldBreak || i === words.length - 1) {
        segments.push({ ...currentSegment });

        if (i < words.length - 1) {
          currentSegment = {
            start: words[i + 1].start / 1000,
            end: words[i + 1].end / 1000,
            text: ''
          };
        }
      }
    }

    console.log('[BetterFrame Transcribe] ✓ Created', segments.length, 'segments');
    return segments;
  }

  /**
   * Transcribe video using AssemblyAI
   */
  async function transcribeVideo(videoUrl, apiKey) {
    try {
      console.log('[BetterFrame Transcribe] ╔════════════════════════════════════════════════╗');
      console.log('[BetterFrame Transcribe] ║   STARTING VIDEO TRANSCRIPTION PROCESS      ║');
      console.log('[BetterFrame Transcribe] ╚════════════════════════════════════════════════╝');
      console.log('[BetterFrame Transcribe]');
      console.log('[BetterFrame Transcribe] Video URL:', videoUrl.substring(0, 80) + '...');

      // Fetch video file
      console.log('[BetterFrame Transcribe]');
      console.log('[BetterFrame Transcribe] ========================================');
      console.log('[BetterFrame Transcribe] STEP 0: Fetching video from Frame.io');
      console.log('[BetterFrame Transcribe] ========================================');
      const fetchStartTime = Date.now();
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
      }

      const videoBlob = await videoResponse.blob();
      const videoSizeMB = videoBlob.size / 1024 / 1024;
      const fetchTime = ((Date.now() - fetchStartTime) / 1000).toFixed(2);
      console.log('[BetterFrame Transcribe] ✓ Video fetched successfully!');
      console.log('[BetterFrame Transcribe] Size:', videoSizeMB.toFixed(2), 'MB');
      console.log('[BetterFrame Transcribe] Download time:', fetchTime, 'seconds');
      console.log('[BetterFrame Transcribe]');

      // Upload to AssemblyAI
      const uploadUrl = await uploadVideoToAssemblyAI(videoBlob, apiKey);
      console.log('[BetterFrame Transcribe]');

      // Create transcription job
      const transcriptId = await createTranscription(uploadUrl, apiKey);
      console.log('[BetterFrame Transcribe]');

      // Poll for completion
      const result = await pollTranscription(transcriptId, apiKey);
      console.log('[BetterFrame Transcribe]');

      // Log full transcript
      console.log('[BetterFrame Transcribe] ========================================');
      console.log('[BetterFrame Transcribe] FULL TRANSCRIPT TEXT:');
      console.log('[BetterFrame Transcribe] ========================================');
      console.log(result.text);
      console.log('[BetterFrame Transcribe] ========================================');
      console.log('[BetterFrame Transcribe]');

      // Convert AssemblyAI format to our format
      const segments = result.words ? convertWordsToSegments(result.words) : [];

      if (segments.length > 0) {
        console.log('[BetterFrame Transcribe] ========================================');
        console.log('[BetterFrame Transcribe] PREVIEW OF FIRST 5 SEGMENTS:');
        console.log('[BetterFrame Transcribe] ========================================');
        segments.slice(0, 5).forEach((seg, i) => {
          console.log(`[BetterFrame Transcribe]  ${i + 1}. [${formatTimestamp(seg.start)}] ${seg.text}`);
        });
        console.log('[BetterFrame Transcribe] ========================================');
        console.log('[BetterFrame Transcribe]');
      }

      return {
        text: result.text,
        segments: segments
      };
    } catch (error) {
      console.error('[BetterFrame Transcribe] ❌ ERROR during transcription:', error);
      throw error;
    }
  }

  /**
   * Create and display transcript UI as a sidebar
   */
  function createTranscriptUI(transcriptData) {
    try {
      console.log('[BetterFrame Transcribe] ========================================');
      console.log('[BetterFrame Transcribe] STEP 4: Creating transcript sidebar UI');
      console.log('[BetterFrame Transcribe] ========================================');

      // Remove existing transcript if any
      const existingTranscript = document.getElementById('betterframe-transcript-sidebar');
      const existingToggle = document.getElementById('betterframe-transcript-toggle');
      if (existingTranscript) {
        existingTranscript.remove();
      }
      if (existingToggle) {
        existingToggle.remove();
      }

      // Create transcript sidebar container
      const sidebar = document.createElement('div');
      sidebar.id = 'betterframe-transcript-sidebar';
      sidebar.className = 'betterframe-transcript-sidebar';

      // Create header with close button
      const header = document.createElement('div');
      header.className = 'betterframe-transcript-header';

      const title = document.createElement('h3');
      title.textContent = 'AI Transcript';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'betterframe-transcript-close';
      closeBtn.innerHTML = '×';
      closeBtn.setAttribute('aria-label', 'Close transcript');
      closeBtn.onclick = () => toggleTranscriptSidebar();

      header.appendChild(title);
      header.appendChild(closeBtn);

      // Create content area
      const content = document.createElement('div');
      content.className = 'betterframe-transcript-content';

      console.log('[BetterFrame Transcribe] Adding', transcriptData.segments?.length || 0, 'segments to sidebar...');

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
        });
      } else {
        // If no segments, just show the full text
        const textEl = document.createElement('p');
        textEl.textContent = transcriptData.text || 'No transcription available';
        content.appendChild(textEl);
      }

      sidebar.appendChild(header);
      sidebar.appendChild(content);

      // Insert sidebar into document body
      document.body.appendChild(sidebar);

      // Adjust page layout to make room for sidebar
      adjustPageLayout(true);

      // Create toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'betterframe-transcript-toggle';
      toggleBtn.className = 'betterframe-transcript-toggle';
      toggleBtn.innerHTML = '✕';  // Start with close icon since sidebar is visible
      toggleBtn.setAttribute('aria-label', 'Toggle transcript');
      toggleBtn.setAttribute('title', 'Hide Transcript');
      toggleBtn.onclick = () => toggleTranscriptSidebar();

      document.body.appendChild(toggleBtn);

      console.log('[BetterFrame Transcribe] ✓ Transcript sidebar created successfully!');
      console.log('[BetterFrame Transcribe] ✓ Page layout adjusted');
      console.log('[BetterFrame Transcribe] ✓ All done! Click timestamps to jump to that time.');

      // Add timestamp interactivity
      addTimestampInteractivity();

    } catch (error) {
      console.error('[BetterFrame Transcribe] Error creating transcript UI:', error);
      throw error;
    }
  }

  /**
   * Adjust page layout to make room for sidebar
   */
  function adjustPageLayout(sidebarVisible) {
    // Find the PlayerPageScrollContainer - this holds both video and comments
    // Try multiple selectors to be resilient to class name changes
    const selectors = [
      '[class*="PlayerPageLayout__PlayerPageScrollContainer"]',
      '.PlayerPageLayout__PlayerPageScrollContainer-g2qz6t-1'
    ];

    let scrollContainer = null;
    for (const selector of selectors) {
      scrollContainer = document.querySelector(selector);
      if (scrollContainer) {
        console.log('[BetterFrame Transcribe] Found scroll container using selector:', selector);
        break;
      }
    }

    if (scrollContainer) {
      if (sidebarVisible) {
        // Push the entire scroll container (video + comments) to the right
        scrollContainer.style.marginLeft = '400px';
        scrollContainer.style.transition = 'margin-left 0.3s ease';
        console.log('[BetterFrame Transcribe] ✓ Adjusted page layout - pushed scroll container 400px to the right');
      } else {
        // Reset to original position
        scrollContainer.style.marginLeft = '0px';
        console.log('[BetterFrame Transcribe] ✓ Reset page layout to original position');
      }
    } else {
      console.warn('[BetterFrame Transcribe] ⚠ Could not find PlayerPageScrollContainer to adjust layout');
      console.warn('[BetterFrame Transcribe] ⚠ Sidebar will overlay content instead of pushing it');
    }
  }

  /**
   * Toggle transcript sidebar visibility
   */
  function toggleTranscriptSidebar() {
    const sidebar = document.getElementById('betterframe-transcript-sidebar');
    const toggleBtn = document.getElementById('betterframe-transcript-toggle');

    if (sidebar) {
      const isHidden = sidebar.classList.contains('hidden');
      sidebar.classList.toggle('hidden');

      // Adjust page layout
      adjustPageLayout(!isHidden ? false : true);

      // Update toggle button
      if (toggleBtn) {
        if (sidebar.classList.contains('hidden')) {
          toggleBtn.innerHTML = '📝';
          toggleBtn.setAttribute('title', 'Show Transcript');
        } else {
          toggleBtn.innerHTML = '✕';
          toggleBtn.setAttribute('title', 'Hide Transcript');
        }
      }
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
