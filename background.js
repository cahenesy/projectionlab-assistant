/*
 * ProjectionLab Assistant - Background Script
 * Copyright (c) 2026 cahenesy
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */


console.log("[PLA:Background] Service worker started");

// Track the tab ID where the content script is active (persisted across service worker restarts)
let activeContentTabId = null;
chrome.storage.session.get('activeContentTabId', (r) => {
  if (r.activeContentTabId) {
    activeContentTabId = r.activeContentTabId;
    console.log("[PLA:Background] Restored content tab ID from session storage:", activeContentTabId);
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log("[PLA:Background] Side panel set to open on action click"))
  .catch(err => console.error("[PLA:Background] setPanelBehavior failed:", err));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[PLA:Background] Received:", request);

  // Content script registers its tab ID when it loads
  if (request.action === "contentScriptReady") {
    activeContentTabId = sender.tab?.id || request.tabId;
    chrome.storage.session.set({ activeContentTabId });
    console.log("[PLA:Background] Content script registered from tab:", activeContentTabId);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "processQuery") {
    const sendToContentScript = (tabId, attempt = 1) => {
      console.log("[PLA:Background] Forwarding query to content script in tab", tabId, "(attempt", attempt + ")");
      chrome.tabs.sendMessage(tabId, {
        action: "runLLMQuery",
        messages: request.messages,
        tabId: tabId
      }, response => {
        if (chrome.runtime.lastError) {
          console.warn("[PLA:Background] Content send failed (attempt " + attempt + "):", chrome.runtime.lastError.message);
          if (attempt < 3) {
            // Retry after a short delay — content script may still be initialising
            setTimeout(() => sendToContentScript(tabId, attempt + 1), 500);
          } else {
            sendResponse({ success: false, error: "Could not reach content script after 3 attempts. Try reloading the ProjectionLab tab." });
          }
        } else {
          console.log("[PLA:Background] Got response from content:", response);
          sendResponse(response);
        }
      });
    };

    if (activeContentTabId) {
      console.log("[PLA:Background] Using registered content tab ID:", activeContentTabId);
      sendToContentScript(activeContentTabId);
    } else {
      // Fallback: find a ProjectionLab tab
      chrome.tabs.query({ url: "https://app.projectionlab.com/*" }, tabs => {
        if (!tabs?.[0]) {
          console.error("[PLA:Background] No ProjectionLab tab found");
          sendResponse({ success: false, error: "No ProjectionLab tab found. Please open a plan first." });
          return;
        }
        activeContentTabId = tabs[0].id;
        chrome.storage.session.set({ activeContentTabId });
        console.log("[PLA:Background] Found ProjectionLab tab via query:", activeContentTabId);
        sendToContentScript(activeContentTabId);
      });
    }

    return true;
  }

  if (request.action === "getPlanData") {
    console.log("[PLA:Background] Handling getPlanData — apiKey length:", request.apiKey?.length || 'missing');

    const tabId = activeContentTabId;
      if (!tabId) {
        console.error("[PLA:Background] No active content tab for data export");
        sendResponse({ success: false, error: "No ProjectionLab tab found. Please open a plan first." });
        return;
      }
      console.log("[PLA:Background] Injecting exportData into tabId:", tabId);

      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (apiKey) => {
          console.log("[PLA:Injected] Injected function running in MAIN world");
          if (!window.projectionlabPluginAPI) {
            throw new Error("projectionlabPluginAPI not found – ensure logged in and plugins enabled");
          }
          const method = window.projectionlabPluginAPI.exportData;
          if (typeof method !== 'function') {
            throw new Error("exportData method not available");
          }
          return method({ key: apiKey });
        },
        args: [request.apiKey]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("[PLA:Background] executeScript failed:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        const result = results?.[0]?.result;
        if (result === undefined) {
          sendResponse({ success: false, error: "No result from plugin method" });
        } else {
          sendResponse({ success: true, data: result });
        }
      });

    return true;
  }

  if (request.action === "executePluginMethod") {
    console.log("[PLA:Background] Handling executePluginMethod — method:", request.method);

    const tabId = activeContentTabId;
      if (!tabId) {
        console.error("[PLA:Background] No active content tab for method execution");
        sendResponse({ success: false, error: "No ProjectionLab tab found. Please open a plan first." });
        return;
      }
      console.log("[PLA:Background] Injecting method", request.method, "into tabId:", tabId);

      const params = { key: request.apiKey, ...request.params };

      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (methodName, params) => {
          console.log("[PLA:Injected] Executing method:", methodName);
          if (!window.projectionlabPluginAPI) {
            throw new Error("projectionlabPluginAPI not found – ensure logged in and plugins enabled");
          }
          const method = window.projectionlabPluginAPI[methodName];
          if (typeof method !== 'function') {
            throw new Error(`Method ${methodName} not available`);
          }
          return method(params);
        },
        args: [request.method, params]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("[PLA:Background] executeScript failed:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        const result = results?.[0]?.result;
        if (result === undefined) {
          sendResponse({ success: false, error: "No result from plugin method" });
        } else {
          sendResponse({ success: true, data: result });
        }
      });

    return true;
  }

  if (request.action === "llmFetch") {
    console.log("[PLA:Background] Handling llmFetch — endpoint:", request.endpoint);

    const headers = {
      ...request.headers,
      'anthropic-dangerous-direct-browser-access': 'true'
    };

    fetch(request.endpoint, {
      method: 'POST',
      headers,
      body: request.body
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          console.error("[PLA:Background] LLM fetch failed — status:", response.status, text);
          sendResponse({ error: `LLM HTTP error ${response.status}: ${text}` });
        } else {
          const data = await response.json();
          console.log("[PLA:Background] LLM fetch succeeded — keys:", Object.keys(data));
          sendResponse({ data });
        }
      })
      .catch((err) => {
        console.error("[PLA:Background] LLM fetch threw:", err.message);
        sendResponse({ error: err.message });
      });

    return true; // keep message channel open for async response
  }

  sendResponse({ success: false, error: "Unknown action" });
  return true;
});
