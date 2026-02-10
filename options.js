// Default presets for each provider
const providerDefaults = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model:   "gpt-4o"
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    model:   "grok-4"   // or "grok-2" / latest model name as of your knowledge
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model:   "claude-3-5-sonnet-20241022"   // current strongest Claude as of late 2025 / early 2026
  }
};

document.getElementById('save').addEventListener('click', async () => {
  const plaApiKey  = document.getElementById('plaApiKey').value.trim();
  const llmApiKey  = document.getElementById('llmApiKey').value.trim();
  const llmBaseUrl = document.getElementById('llmBaseUrl').value.trim();
  const llmModel   = document.getElementById('llmModel').value.trim();
  const llmProvider = document.getElementById('llmProvider').value;

  await chrome.storage.sync.set({
    plaApiKey,
    llmApiKey,
    llmBaseUrl,
    llmModel,
    llmProvider
  });

  document.getElementById('status').textContent = 'Options saved!';
  setTimeout(() => { document.getElementById('status').textContent = ''; }, 2000);
});

// Load saved values when options page opens
chrome.storage.sync.get([
  'plaApiKey', 'llmApiKey', 'llmBaseUrl', 'llmModel', 'llmProvider'
], (data) => {
  document.getElementById('plaApiKey').value  = data.plaApiKey  || '';
  document.getElementById('llmApiKey').value  = data.llmApiKey  || '';
  document.getElementById('llmBaseUrl').value = data.llmBaseUrl || providerDefaults.openai.baseUrl;
  document.getElementById('llmModel').value   = data.llmModel   || providerDefaults.openai.model;
  
  const providerSelect = document.getElementById('llmProvider');
  providerSelect.value = data.llmProvider || 'openai';
});

// Auto-update base URL and model when provider changes
document.getElementById('llmProvider').addEventListener('change', (event) => {
  const selectedProvider = event.target.value;
  const defaults = providerDefaults[selectedProvider] || providerDefaults.openai; // fallback

  document.getElementById('llmBaseUrl').value = defaults.baseUrl;
  document.getElementById('llmModel').value   = defaults.model;
});