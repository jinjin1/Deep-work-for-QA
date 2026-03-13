// Deep Work Background Service Worker
export {};

const API_BASE = 'http://localhost:3001/v1';

let isRecording = false;

// Session recording state
let isSessionRecording = false;
let sessionId: string | null = null;
let sessionStartTime = 0;
let sessionPageCount = 0;
let sessionCurrentUrl = '';

// In-memory store for the latest capture data
let latestCaptureData: Record<string, unknown> | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      isRecording = true;
      console.log('[Deep Work] Recording started');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'START_CAPTURE' });
        }
      });
      // Broadcast to SidePanel and other extension pages
      chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' }).catch(() => {
        // No listeners — safe to ignore
      });
      sendResponse({ success: true });
      break;

    case 'STOP_RECORDING':
      isRecording = false;
      console.log('[Deep Work] Recording stopped');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_CAPTURE' });
        }
      });
      // Broadcast to SidePanel and other extension pages
      chrome.runtime.sendMessage({ type: 'RECORDING_STOPPED' }).catch(() => {
        // No listeners — safe to ignore
      });
      sendResponse({ success: true });
      break;

    case 'CAPTURE_DATA':
      latestCaptureData = message.data;
      console.log('[Deep Work] Capture data received:', {
        events: message.data?.events?.length || 0,
        console_logs: message.data?.console_logs?.length || 0,
        network_logs: message.data?.network_logs?.length || 0,
      });
      chrome.storage.local.set({ captureData: message.data }, () => {
        console.log('[Deep Work] Capture data persisted to storage');
      });
      sendResponse({ success: true });
      break;

    case 'GET_CAPTURE_DATA':
      if (latestCaptureData) {
        sendResponse({ success: true, data: latestCaptureData });
      } else {
        chrome.storage.local.get('captureData', (result) => {
          if (result.captureData) {
            latestCaptureData = result.captureData;
            sendResponse({ success: true, data: result.captureData });
          } else {
            sendResponse({ success: false, data: null });
          }
        });
        return true;
      }
      break;

    case 'GET_STATUS':
      sendResponse({ isRecording, isSessionRecording });
      break;

    // ---- Session Recording ----

    case 'START_SESSION_RECORDING': {
      isSessionRecording = true;
      sessionStartTime = Date.now();
      sessionPageCount = 1;
      sessionCurrentUrl = message.data?.url || '';
      const tag = message.data?.tag || '';

      console.log('[Deep Work] Session recording started');

      // Create session via API
      fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_url: sessionCurrentUrl,
          environment: {
            browser: navigator.userAgent,
            os: navigator.platform,
            viewport: { width: 1440, height: 900 },
          },
          tags: tag ? [tag] : [],
        }),
      })
        .then(res => res.json())
        .then(result => {
          sessionId = result.data?.id || null;
          console.log('[Deep Work] Session created:', sessionId);
          // Store session ID
          chrome.storage.local.set({ sessionId, isSessionRecording: true });
        })
        .catch(err => {
          console.error('[Deep Work] Failed to create session:', err);
        });

      // Start capture on active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'START_SESSION_CAPTURE' });
        }
      });

      sendResponse({ success: true });
      break;
    }

    case 'STOP_SESSION_RECORDING': {
      isSessionRecording = false;
      const duration = Date.now() - sessionStartTime;
      console.log('[Deep Work] Session recording stopped, duration:', duration);

      // Stop capture on active tab and collect data
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_SESSION_CAPTURE' }, (response) => {
            if (response?.data && sessionId) {
              // Upload session data to API
              const sessionData = response.data;
              fetch(`${API_BASE}/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  duration_ms: duration,
                  page_count: sessionPageCount,
                  event_count: sessionData.events?.length || 0,
                  events_data: sessionData.events || [],
                  console_logs: sessionData.console_logs || [],
                  network_logs: sessionData.network_logs || [],
                  status: 'ready',
                }),
              })
                .then(res => res.json())
                .then(result => {
                  console.log('[Deep Work] Session data uploaded:', result);
                })
                .catch(err => {
                  console.error('[Deep Work] Failed to upload session data:', err);
                });
            }
          });
        }
      });

      chrome.storage.local.set({ isSessionRecording: false });
      sendResponse({ success: true });
      break;
    }

    case 'GET_SESSION_STATUS': {
      const elapsed = isSessionRecording ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
      sendResponse({
        isSessionRecording,
        sessionId,
        elapsed,
        pageCount: sessionPageCount,
        currentUrl: sessionCurrentUrl,
      });
      break;
    }

    case 'ADD_SESSION_MARK': {
      if (sessionId) {
        fetch(`${API_BASE}/sessions/${sessionId}/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: message.data?.timestamp || (Date.now() - sessionStartTime),
            label: message.data?.label || 'User mark',
          }),
        })
          .then(res => res.json())
          .then(result => {
            console.log('[Deep Work] Bookmark added:', result);
          })
          .catch(err => {
            console.error('[Deep Work] Failed to add bookmark:', err);
          });
      }
      sendResponse({ success: true });
      break;
    }

    case 'SESSION_CAPTURE_DATA': {
      // Session capture data from content script
      console.log('[Deep Work] Session capture data received');
      sendResponse({ success: true });
      break;
    }

    case 'SESSION_PAGE_VISIT': {
      if (isSessionRecording) {
        sessionPageCount++;
        sessionCurrentUrl = message.data?.url || sessionCurrentUrl;
        console.log('[Deep Work] Session page visit:', sessionCurrentUrl, 'count:', sessionPageCount);
      }
      sendResponse({ success: true });
      break;
    }

    case 'TAKE_SCREENSHOT':
      chrome.tabs.captureVisibleTab(
        undefined as unknown as number,
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('[Deep Work] Screenshot failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('[Deep Work] Screenshot captured');
            const screenshotData = { dataUrl, timestamp: Date.now() };
            chrome.storage.local.set({ screenshotData }, () => {
              // Broadcast to SidePanel so it can show the screenshot
              chrome.runtime.sendMessage({ type: 'SCREENSHOT_TAKEN' }).catch(() => {
                // No listeners — safe to ignore
              });
              sendResponse({ success: true, dataUrl });
            });
          }
        }
      );
      return true;

    case 'CLEAR_CAPTURE_DATA':
      latestCaptureData = null;
      chrome.storage.local.remove(['captureData', 'screenshotData'], () => {
        console.log('[Deep Work] Capture data cleared');
        sendResponse({ success: true });
      });
      return true;
  }
  return true;
});

// Side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

console.log('[Deep Work] Background service worker loaded');
