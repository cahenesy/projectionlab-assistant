/*
 * ProjectionLab Assistant - Content Script (Side Panel Bridge)
 * Copyright (c) 2026 cahenesy
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

console.log("[PLA:Content] Content script loaded on", window.location.href);
console.log("[PLA:Content] Extension ID:", chrome.runtime.id);

// Storage key for pre-update data
const PRE_UPDATE_STORAGE_KEY = 'pla_pre_update_data';

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[PLA:Content] MESSAGE RECEIVED from runtime:", request);
  console.log("[PLA:Content] Sender info:", sender);

  if (request.action === "runLLMQuery") {
    console.log("[PLA:Content] Received tabId from background:", request.tabId);
    console.log("[PLA:Content] Starting LLM query processing — messages length:", request.messages?.length);

    (async () => {
      let typingSent = false;
      try {
        console.log("[PLA:Content] Loading stored configuration from chrome.storage.sync...");
        const stored = await chrome.storage.sync.get([
          'plaApiKey', 'llmApiKey', 'llmBaseUrl', 'llmModel', 'llmProvider'
        ]);
        console.log("[PLA:Content] Loaded storage keys:", Object.keys(stored));
        console.log("[PLA:Content] LLM provider:", stored.llmProvider);
        console.log("[PLA:Content] LLM model:", stored.llmModel);
        console.log("[PLA:Content] LLM base URL:", stored.llmBaseUrl);
        console.log("[PLA:Content] PLA API key length:", stored.plaApiKey?.length || 'missing');
        console.log("[PLA:Content] LLM API key length:", stored.llmApiKey?.length || 'missing');

        if (!stored.plaApiKey?.trim()) {
          console.error("[PLA:Content] PLA API key missing or empty");
          throw new Error("ProjectionLab API key not configured in options");
        }
        if (!stored.llmApiKey?.trim()) {
          console.error("[PLA:Content] LLM API key missing or empty");
          throw new Error("LLM API key not configured in options");
        }

        console.log("[PLA:Content] Sending showTypingIndicator message to side panel");
        chrome.runtime.sendMessage({ action: "showTypingIndicator" });
        typingSent = true;

        // Initial data fetch for non-confirmation queries
        console.log("[PLA:Content] Requesting initial plan export from background...");
        const exportResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "getPlanData",
            apiKey: stored.plaApiKey
          }, resolve);
        });

        if (!exportResponse?.success) {
          console.error("[PLA:Content] Background export failed:", exportResponse?.error);
          throw new Error(
            `Failed to export ProjectionLab data: ${exportResponse?.error || 'Unknown error'}\n` +
            `→ Logged in? Plugins enabled in account settings?`
          );
        }

        const exported = exportResponse.data;
        console.log("[PLA:Content] Plan exported successfully — data type:", typeof exported);
        console.log("[PLA:Content] Exported data size (stringified):", JSON.stringify(exported).length, "chars");

        let dataSummary = JSON.stringify(exported);
        if (dataSummary.length > 150000) {  // ~40k tokens safety buffer
          console.warn("[PLA:Content] Plan data too large — truncating to 150k chars");
          dataSummary = dataSummary.substring(0, 150000) + "\n... [truncated - full data exceeds limit]";
        } else {
          console.log("[PLA:Content] Data summary length:", dataSummary.length);
        }

        // System prompt (updated as above)
        const system = `You are a financial planning assistant for ProjectionLab.

Respond in clean, well-formatted Markdown using:
- # for main headings
- ## for subheadings
- Bullet lists (- or *) for items
- Numbered lists (1.) when ordering matters
- **bold** for emphasis
- Tables in Markdown format when comparing things
- Short paragraphs, avoid walls of text

If the conversation involves an analysis request, provide a detailed, structured analysis.

If you have suggestions for improvements during analysis, list them under ## Suggestions for Improvement as a bullet list, describing each clearly.

At the end of an analysis with suggestions, add: **Would you like me to apply these changes? Reply with "yes" or "apply changes" to confirm.**

If the user is confirming to apply suggestions from the previous response (e.g., "yes", "apply changes"), review the conversation history, extract the suggestions from your prior analysis, and respond ONLY with valid JSON like:
{ "actions": [{ "action": "updateAccount", "accountId": "12345", "data": { "balance": 10000 } }] }
For restoreCurrentFinances, restorePlans, or restoreProgress, ALWAYS output the FULL complete dataset for that category (e.g., "data": [complete array of plans with modifications incorporated]), based on the provided current plan data summary. Do NOT send partial or incremental updates for these methods, as they require wholesale replacement to avoid data loss.
Adapt the JSON structure to match ProjectionLab's API methods (e.g., include required fields like account IDs if available from plan data; use "options": { "force": "value" } if needed for new properties).

If the user requests to undo or revert changes (e.g., "undo", "revert last changes"), respond ONLY with { "action": "revert" } to trigger restoration from the pre-update state.

Do NOT include any other text outside the Markdown (for analysis) or JSON (updates).`;

        console.log("[PLA:Content] Sending initial request to LLM provider:", stored.llmProvider);
        const llmResponse = await fetchLLMResponse(
          system,
          request.messages,
          dataSummary,
          stored.llmApiKey,
          stored.llmBaseUrl,
          stored.llmModel,
          stored.llmProvider
        );

        console.log("[PLA:Content] LLM response received — length:", llmResponse.length);
        console.log("[PLA:Content] LLM response preview:", llmResponse.substring(0, 300) + (llmResponse.length > 300 ? "..." : ""));

        let finalAnswer = llmResponse;
        let actionsApplied = false;

        if (llmResponse.trim().startsWith('{')) {
          console.log("[PLA:Content] LLM response appears to be JSON — possible confirmation or revert");
          try {
            const parsed = JSON.parse(llmResponse);
            if (parsed.action === "revert") {
              // Handle revert
              const { [PRE_UPDATE_STORAGE_KEY]: preUpdateData } = await chrome.storage.local.get(PRE_UPDATE_STORAGE_KEY);
              if (!preUpdateData) {
                throw new Error("No pre-update data available for revert.");
              }
              // Apply restore using pre-update data (assuming it's the full export)
              let revertResults = [];
              // Example: Restore finances, plans, progress if present in preUpdateData
              for (let method of ['restoreCurrentFinances', 'restorePlans', 'restoreProgress']) {
                if (preUpdateData[method.toLowerCase().replace('restore', '')]) {  // e.g., currentFinances
                  const params = { data: preUpdateData[method.toLowerCase().replace('restore', '')] };
                  const revertResponse = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                      action: "executePluginMethod",
                      method,
                      params,
                      apiKey: stored.plaApiKey
                    }, resolve);
                  });
                  if (revertResponse.success) {
                    revertResults.push({ success: true, method });
                  } else {
                    revertResults.push({ success: false, method, error: revertResponse.error });
                  }
                }
              }
              let statusMessage = "## Revert Status\n\n";
              revertResults.forEach(r => {
                statusMessage += `- **${r.method}**: ${r.success ? 'Success' : `Failed - ${r.error}`}\n`;
              });
              if (revertResults.every(r => r.success)) {
                statusMessage += "\nReverted successfully. Refresh the page if needed. No further undo available until next apply.";
              } else if (revertResults.some(r => r.success)) {
                statusMessage += "\nPartial revert. Some data restored, but errors occurred.";
              } else {
                statusMessage += "\nRevert failed. Please check the errors.";
              }
              finalAnswer = statusMessage;
              // Clear stored pre-update data after successful revert
              if (revertResults.every(r => r.success)) {
                await chrome.storage.local.remove(PRE_UPDATE_STORAGE_KEY);
              }
            } else {
              // Handle confirmation: Fetch fresh data
              console.log("[PLA:Content] Confirmation detected — fetching fresh plan data");
              const freshExportResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                  action: "getPlanData",
                  apiKey: stored.plaApiKey
                }, resolve);
              });
              if (!freshExportResponse?.success) {
                throw new Error("Failed to fetch fresh plan data for updates.");
              }
              const freshExported = freshExportResponse.data;
              let freshDataSummary = JSON.stringify(freshExported);
              if (freshDataSummary.length > 150000) {
                freshDataSummary = freshDataSummary.substring(0, 150000) + "\n... [truncated]";
              }

              // Store pre-update data for potential revert
              await chrome.storage.local.set({ [PRE_UPDATE_STORAGE_KEY]: freshExported });
              console.log("[PLA:Content] Pre-update data stored for revert.");

              // Secondary LLM call with fresh data to generate accurate JSON
              console.log("[PLA:Content] Sending secondary LLM request with fresh data");
              const updateMessages = [...request.messages, { role: 'assistant', content: llmResponse }];  // Include initial response
              const updateJson = await fetchLLMResponse(
                system,
                updateMessages,
                freshDataSummary,
                stored.llmApiKey,
                stored.llmBaseUrl,
                stored.llmModel,
                stored.llmProvider
              );

              // Now parse and apply the new JSON
              const updateParsed = JSON.parse(updateJson);
              const actions = updateParsed.actions || [];
              if (actions.length > 0) {
                console.log("[PLA:Content] Found", actions.length, "actions to apply from fresh JSON");
                let applyResults = [];
                for (let item of actions) {
                  const params = { ...item };
                  delete params.action;  // Remove 'action' key if present
                  const applyResponse = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                      action: "executePluginMethod",
                      method: item.action,
                      params,
                      apiKey: stored.plaApiKey
                    }, resolve);
                  });
                  if (applyResponse.success) {
                    console.log("[PLA:Content] Action applied:", item.action);
                    applyResults.push({ success: true, action: item.action, details: applyResponse.data });
                  } else {
                    console.error("[PLA:Content] Action failed:", item.action, applyResponse.error);
                    applyResults.push({ success: false, action: item.action, error: applyResponse.error });
                  }
                }
                actionsApplied = true;
                let statusMessage = "## Changes Application Status\n\n";
                applyResults.forEach(r => {
                  statusMessage += `- **${r.action}**: ${r.success ? 'Success' : `Failed - ${r.error}`}\n`;
                });
                if (applyResults.every(r => r.success)) {
                  statusMessage += "\nAll changes applied successfully! Refresh the page if needed to see updates. Reply 'undo' if you want to revert.";
                } else if (applyResults.some(r => r.success)) {
                  statusMessage += "\nPartial success. Some changes applied, but errors occurred. Please review and try again if needed.";
                } else {
                  statusMessage += "\nAll changes failed. Please check the errors and try again.";
                  // Clear stored data on full failure
                  await chrome.storage.local.remove(PRE_UPDATE_STORAGE_KEY);
                }
                finalAnswer = statusMessage;
              } else {
                console.log("[PLA:Content] No actions in fresh JSON");
              }
            }
          } catch (parseErr) {
            console.warn("[PLA:Content] LLM returned JSON-like text but parsing failed:", parseErr);
          }
        }

        console.log("[PLA:Content] Sending success response back — actionsApplied:", actionsApplied);
        sendResponse({
          success: true,
          answer: finalAnswer,
          actionsApplied
        });
      } catch (err) {
        console.error("[PLA:Content] Query processing failed:", err);
        console.error("[PLA:Content] Error stack:", err.stack);
        sendResponse({
          success: false,
          error: err.message || "Something went wrong. Please try again."
        });
      } finally {
        if (typingSent) {
          console.log("[PLA:Content] Hiding typing indicator");
          chrome.runtime.sendMessage({ action: "hideTypingIndicator" });
        }
        console.log("[PLA:Content] Query handler finished");
      }
    })();

    return true; // keep message channel open for async
  }

  console.warn("[PLA:Content] Unknown action received:", request.action);
  sendResponse({ success: false, error: "Unknown action" });
  return true;
});

// Updated LLM fetch helper to support history
async function fetchLLMResponse(system, historyMessages, dataSummary, apiKey, baseUrl, model, provider) {
  console.log("[PLA:Content] fetchLLMResponse — provider:", provider, "model:", model, "baseUrl:", baseUrl);
  console.log("[PLA:Content] History messages length:", historyMessages.length);

  // Append data summary to the last user message
  const messages = historyMessages.map(m => ({ role: m.role, content: m.content }));
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1].content += `\n\nCurrent plan data (summary): ${dataSummary}`;
  }

  let endpoint, headers, body;

  const bodyObj = {
    model,
    temperature: 0.7
  };

  if (provider === 'anthropic') {
    bodyObj.system = system;
    bodyObj.messages = messages;
    bodyObj.max_tokens = 4096;
    endpoint = `${baseUrl}/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
  } else {
    bodyObj.messages = [{ role: 'system', content: system }, ...messages];
    endpoint = `${baseUrl}/chat/completions`;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  body = JSON.stringify(bodyObj);

  console.log("[PLA:Content] LLM request — endpoint:", endpoint);
  console.log("[PLA:Content] Request body length:", body.length);

  const response = await fetch(endpoint, { method: 'POST', headers, body });
  
  console.log("[PLA:Content] LLM HTTP response status:", response.status, response.statusText);

  if (!response.ok) {
    const text = await response.text();
    console.error("[PLA:Content] LLM fetch failed — status:", response.status);
    console.error("[PLA:Content] Error response body:", text);
    throw new Error(`LLM HTTP error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("[PLA:Content] LLM response JSON received — keys:", Object.keys(data));

  return provider === 'anthropic'
    ? data.content?.[0]?.text?.trim() || ""
    : data.choices?.[0]?.message?.content?.trim() || "";
}