# Security Policy

## Supported Versions

The `main` branch is the supported branch for security and safety updates.

## Reporting a Vulnerability

Please do not open a public issue for secrets, credential exposure, or other sensitive security reports.

Use GitHub private vulnerability reporting when available, or contact the maintainers through the repository owner. Include:

- a concise description
- affected files or commands
- reproduction steps when safe to share
- any logs with secrets removed

## Repository Safety Notes

This repository is designed to keep heavy local artifacts and sensitive settings out of Git. Before pushing changes, check that these are not staged:

- `.env` or credential files
- model weights
- Hugging Face caches
- local virtual environments
- raw logs that may include paths, tokens, or local prompts
