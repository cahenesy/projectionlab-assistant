/*
 * ProjectionLab Assistant - Background Script
 * Copyright (c) 2026 cahenesy
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */


console.log("[PLA:Background] Service worker started");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => console.log("[PLA:Background] Side panel set to open on action click"))
  .catch(err => console.error("[PLA:Background] setPanelBehavior failed:", err));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[PLA:Background] Received:", request);

  if (request.action === "openOptionsPage") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "processQuery") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs?.[0]) {
        console.error("[PLA:Background] No active tab");
        sendResponse({ success: false, error: "No active tab" });
        return;
      }

      const tabId = tabs[0].id;
      console.log("[PLA:Background] Forwarding query to content script in tab", tabId);

      chrome.tabs.sendMessage(tabId, {
        action: "runLLMQuery",
        query: request.query,
        tabId: tabId
      }, response => {
        if (chrome.runtime.lastError) {
          console.error("[PLA:Background] Content send failed:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log("[PLA:Background] Got response from content:", response);
          sendResponse(response);
        }
      });
    });

    return true;
  }

  if (request.action === "getPlanData") {
    console.log("[PLA:Background] Handling getPlanData — apiKey length:", request.apiKey?.length || 'missing');

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs?.[0]) {
        console.error("[PLA:Background] No active tab for data export");
        sendResponse({ success: false, error: "No active tab" });
        return;
      }

      const tabId = tabs[0].id;
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
    });

    return true;
  }

  sendResponse({ success: false, error: "Unknown action" });
  return true;
});