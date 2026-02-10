/*
 * ProjectionLab Assistant - Content Script (Side Panel Bridge)
 * Copyright (c) 2026 cahenesy
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

console.log("[PLA:Content] Content script loaded on", window.location.href);
console.log("[PLA:Content] Extension ID:", chrome.runtime.id);

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[PLA:Content] MESSAGE RECEIVED from runtime:", request);
  console.log("[PLA:Content] Sender info:", sender);

  if (request.action === "runLLMQuery") {
    console.log("[PLA:Content] Received tabId from background:", request.tabId);
    console.log("[PLA:Content] Starting LLM query processing — user query:", request.query);

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

        console.log("[PLA:Content] Requesting plan export from background...");
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

        const prompt = `You are a financial planning assistant for ProjectionLab.

Respond in clean, well-formatted Markdown using:
- # for main headings
- ## for subheadings
- Bullet lists (- or *) for items
- Numbered lists (1.) when ordering matters
- **bold** for emphasis
- Tables in Markdown format when comparing things
- Short paragraphs, avoid walls of text

User query: "${request.query}"

Current plan data (summary): ${dataSummary}

If this is an analysis request, provide detailed, structured analysis.
If this is an update request, respond ONLY with valid JSON like:
{ "actions": [{ "action": "updateAccount", ... }] }

Do NOT include any other text outside the Markdown (analysis) or JSON (updates).`;

        console.log("[PLA:Content] Generated prompt length:", prompt.length);

        console.log("[PLA:Content] Sending request to LLM provider:", stored.llmProvider);
        const llmResponse = await fetchLLMResponse(
          prompt,
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
          console.log("[PLA:Content] LLM response appears to be JSON — attempting parse");
          try {
            const parsed = JSON.parse(llmResponse);
            console.log("[PLA:Content] Parsed JSON:", parsed);
            const actions = parsed.actions || [];
            if (actions.length > 0) {
              console.log("[PLA:Content] Found", actions.length, "actions to apply:", actions);
              // TODO: implement actual action calling when ready
              actionsApplied = true;
              finalAnswer += "\n\nChanges parsed (application not yet implemented).";
            } else {
              console.log("[PLA:Content] No actions array found in parsed JSON");
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

// LLM fetch helper (unchanged)
async function fetchLLMResponse(prompt, apiKey, baseUrl, model, provider) {
  console.log("[PLA:Content] fetchLLMResponse — provider:", provider, "model:", model, "baseUrl:", baseUrl);

  let endpoint, headers, body;

  if (provider === 'anthropic') {
    endpoint = `${baseUrl}/messages`;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.7
    });
  } else {
    endpoint = `${baseUrl}/chat/completions`;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  }

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