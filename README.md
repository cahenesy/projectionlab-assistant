# ProjectionLab Assistant

A Chrome extension that provides an AI-powered chatbot side panel for ProjectionLab[](https://app.projectionlab.com). It analyzes your financial plans, spots potential issues, and applies configuration changes via natural language commands.

**Features**:
- Natural language plan analysis (e.g., "Any risks in my base plan?")
- Supports OpenAI-compatible LLMs, Grok (xAI), or Claude (Anthropic)
- Dynamic theming to match ProjectionLab's color schemes

**Screenshots**:
- [Sidebar in action] (add image URL from GitHub or Imgur)
- [Options page] (add image URL)

## Licensing

This project is dual-licensed:
- For **non-commercial, personal, hobby, educational, or open-source use**, licensed under GNU Affero General Public License v3 (AGPLv3) or later. See [LICENSE](LICENSE) for full text.
- For **commercial use** (e.g., integration with paid ProjectionLab tiers, business use, selling/reselling), a separate license is required. Contact chris@heartofgoldventures.com for pricing/terms.

## Installation (During Development)

1. Download the ZIP from the latest GitHub release (or clone the repo).
2. Unzip the folder.
3. Go to `chrome://extensions/` in Chrome.
4. Enable "Developer mode" (top-right toggle).
5. Click "Load unpacked" → select the unzipped folder.
6. The extension icon appears in the toolbar.
7. Click the icon to open the side panel.
8. Configure API keys in the options page (gear icon in side panel).

## Installation (Once Published on Chrome Web Store)

1. Go to the Chrome Web Store page (link coming soon).
2. Click "Add to Chrome".
3. The icon appears in the toolbar.
4. Click it to open the side panel.
5. Configure API keys (gear icon in side panel).

## Usage

1. Log in to ProjectionLab[](https://app.projectionlab.com).
2. Open a plan.
3. Click the extension icon in the Chrome toolbar to open the side panel.
4. Type queries like:
   - "Analyze my base plan for risks"
5. The AI will respond.

Note: Ensure your ProjectionLab Plugin API key is set in options (from ProjectionLab Account Settings > Plugins).

## Configuration

In the options page:
- ProjectionLab Plugin API Key: Required for plan export/updates.
- LLM Provider: OpenAI, xAI (Grok), or Anthropic (Claude).
- LLM API Key: Your provider's key.
- LLM Base URL: e.g., `https://api.x.ai/v1` for Grok.
- LLM Model: e.g., `grok-beta` for Grok.

## Troubleshooting

- Side panel not opening: Ensure you're on a ProjectionLab plan page.
- "Plugin API not available": Wait for the page to fully load or reload.
- Errors in console: Check for `[PJA:Content]` or `[PJA:Background]` logs for details.
- If issues persist, open an issue on GitHub.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Pull requests welcome during development!

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Contact

Questions? Contact chris@heartofgoldventures.com or open an issue on GitHub.