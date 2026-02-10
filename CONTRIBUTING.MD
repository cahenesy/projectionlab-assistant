# Contributing to ProjectionLab Assistant

Thank you for considering contributing to **ProjectionLab Assistant**! This is a small, community-oriented Chrome extension that adds an AI chatbot sidebar to ProjectionLab for plan analysis and updates.

This project is dual-licensed:

- AGPLv3 (or later) for non-commercial, personal, hobby, educational, and open-source use.
- Separate commercial license required for any business, revenue-generating, professional, or paid-tier (e.g., ProjectionLab Pro) use.

By contributing code, you agree that your contributions will be licensed under **AGPLv3** (as reflected in the LICENSE file). The maintainer (cahenesy) retains the right to offer your contributions under a separate commercial license to others. If this is a concern, feel free to discuss alternatives (e.g., forking the repo) before submitting.

We welcome all kinds of contributions: bug fixes, new features (e.g., better LLM prompt engineering, support for other APIs like Anthropic/Claude/Grok, UI improvements), documentation updates, issue reports, or even ideas/discussions.

## How to Contribute

### 1. Found a Bug or Have an Idea?

- Open an **Issue** on GitHub: https://github.com/cahenesy/ProjectionLabAssistant/issues
- Use a clear title and description.
- Include steps to reproduce (for bugs), screenshots if visual, or mockups for new features.
- Label it appropriately (bug, enhancement, question, etc.) if you can.

### 2. Want to Submit Code or Docs?

1. Fork the repo: https://github.com/cahenesy/ProjectionLabAssistant
2. Create a branch from `main`:
git checkout -b feature/your-feature-name
(or `fix/bug-description`, `docs/update-readme`, etc.)
3. Make your changes:

- Follow existing code style (simple JS, no heavy frameworks yet).
- Add/update comments where helpful.
- Test locally: Load as unpacked extension in Chrome → test on app.projectionlab.com.

4. Commit with clear messages:
git commit -m "Add support for Grok API in LLM config"
5. Push your branch and open a **Pull Request** (PR):

- Target `main`.
- Describe what you changed and why.
- Reference any related issues (e.g., "Fixes #42").

6. Wait for review — I'll respond as soon as possible (usually within a few days).

### Code Guidelines

- Use modern JavaScript (ES6+).
- Keep changes focused (one feature/fix per PR).
- Update README.md or inline docs if behavior changes.
- If adding new dependencies (unlikely for now), discuss first.

### Questions or Discussion?

- Open an issue (label: question or discussion).
- Or reach out on X: @ChrisHenesy76 (mention the project).

All contributions are appreciated — even small ones help! Thanks for helping make ProjectionLab Assistant better.

Happy coding! 🚀