# Privacy Policy — ProjectionLab Assistant

**Last updated: February 25, 2026**

## Purpose

ProjectionLab Assistant is a Chrome extension with a single purpose: to connect the [ProjectionLab](https://app.projectionlab.com) financial planning application to a Large Language Model (LLM) of the user's choice, enabling AI-assisted analysis and updates of the user's own financial plan.

## Data Collection

**The developer of this extension does not collect, store, transmit, or have any access to any user data of any kind.**

There are no developer-operated servers, databases, analytics services, or telemetry systems involved in this extension.

## Data Handled by the Extension

When you use ProjectionLab Assistant, the following data flows occur entirely on your device and between services you have explicitly configured:

| Data | Source | Destination | Purpose |
|---|---|---|---|
| Financial plan data | Your ProjectionLab account | Your chosen LLM API | Provide context for AI analysis |
| Chat messages | You (typed input) | Your chosen LLM API | Fulfill your AI query |
| API keys (ProjectionLab & LLM) | You (entered in settings) | Stored locally in your browser | Authenticate with respective services |
| Chat history | Your conversation | Stored locally in your browser | Persist conversation between sessions |

All data transmission to an LLM occurs **only when you explicitly send a message**, using **your own API key**, to **the LLM provider you configured**. The extension does not send data at any other time.

## Local Storage

The extension stores the following data locally in your browser using Chrome's built-in storage APIs:

- **`chrome.storage.sync`** — Your ProjectionLab API key, LLM API key, LLM provider, base URL, and model name (synced across your signed-in Chrome instances via Google's infrastructure).
- **`chrome.storage.local`** — Your chat conversation history and a temporary snapshot of your plan data used solely to support the "undo last changes" feature.

This data never leaves your browser except as described in the table above.

## Third-Party Services

This extension communicates with two categories of third-party services, both configured entirely by you:

1. **ProjectionLab** (`app.projectionlab.com`) — To read and write your financial plan data via ProjectionLab's official plugin API, using your ProjectionLab API key.
2. **Your chosen LLM provider** (e.g., OpenAI, Anthropic, xAI, or any OpenAI-compatible endpoint) — To process your queries, using your LLM API key.

The developer of this extension has no affiliation with, control over, or visibility into either of these services. Their respective privacy policies govern how they handle data you send to them.

## Data the Extension Does Not Access

This extension does not access, read, or transmit:

- Any data from browser tabs other than `app.projectionlab.com`
- Browsing history
- Cookies or credentials
- Any data outside of ProjectionLab and the LLM provider you configured

## Changes to This Policy

If the data handling practices of this extension change in a future version, this document will be updated and the "Last updated" date revised. The policy will always reflect the current released version.

## Contact

This extension is open source. To report concerns or ask questions, please open an issue at:
[https://github.com/cahenesy/ProjectionLabAssistant/issues](https://github.com/cahenesy/ProjectionLabAssistant/issues)
