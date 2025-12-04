// BetterFrame - Popup Script
// Handles OpenAI API key storage and retrieval

(function() {
  'use strict';

  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveKey');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');

  /**
   * Load saved API key on popup open
   */
  function loadApiKey() {
    try {
      chrome.storage.sync.get(['openaiApiKey'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[BetterFrame Popup] Error loading API key:', chrome.runtime.lastError);
          return;
        }

        if (result.openaiApiKey) {
          apiKeyInput.value = result.openaiApiKey;
          console.log('[BetterFrame Popup] API key loaded successfully');
        }
      });
    } catch (error) {
      console.error('[BetterFrame Popup] Exception loading API key:', error);
    }
  }

  /**
   * Save API key to chrome storage
   */
  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();

    // Hide previous messages
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';

    if (!apiKey) {
      errorMessage.textContent = '✗ Please enter an API key';
      errorMessage.style.display = 'block';
      console.error('[BetterFrame Popup] Empty API key provided');
      return;
    }

    // Basic validation for OpenAI API key format
    if (!apiKey.startsWith('sk-')) {
      errorMessage.textContent = '✗ Invalid API key format';
      errorMessage.style.display = 'block';
      console.error('[BetterFrame Popup] Invalid API key format:', apiKey.substring(0, 5) + '...');
      return;
    }

    // Disable button while saving
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      chrome.storage.sync.set({ openaiApiKey: apiKey }, () => {
        if (chrome.runtime.lastError) {
          console.error('[BetterFrame Popup] Error saving API key:', chrome.runtime.lastError);
          errorMessage.textContent = '✗ Failed to save API key';
          errorMessage.style.display = 'block';
        } else {
          console.log('[BetterFrame Popup] API key saved successfully');
          successMessage.style.display = 'block';

          // Hide success message after 3 seconds
          setTimeout(() => {
            successMessage.style.display = 'none';
          }, 3000);
        }

        // Re-enable button
        saveButton.disabled = false;
        saveButton.textContent = 'Save API Key';
      });
    } catch (error) {
      console.error('[BetterFrame Popup] Exception saving API key:', error);
      errorMessage.textContent = '✗ Exception: ' + error.message;
      errorMessage.style.display = 'block';
      saveButton.disabled = false;
      saveButton.textContent = 'Save API Key';
    }
  }

  // Event listeners
  saveButton.addEventListener('click', saveApiKey);

  // Allow saving with Enter key
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
    }
  });

  // Load API key when popup opens
  loadApiKey();

  console.log('[BetterFrame Popup] Popup script loaded');
})();
