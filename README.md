# Cocobolo - Secure Notes Application

A secure, encrypted, cross-platform note-taking application built with Tauri 2.0, React, and Rust.

## ⚠️ ALPHA SOFTWARE WARNING ⚠️

**This is alpha software (v0.0.1) and is NOT ready for production use.**

- **Use at your own risk** - This software may contain bugs, security vulnerabilities, or data loss issues
- **No warranty** - There is no guarantee of data integrity or application stability
- **Backup your data** - Always maintain external backups of important notes
- **Breaking changes** - Future updates may not be compatible with current data formats
- **Security audit pending** - While designed with security in mind, the cryptographic implementation has not been independently audited

This software is provided for testing and development purposes only. Do not use it to store sensitive or critical information until it reaches a stable release.

## Development

### Prerequisites
- Node.js (v22 or later)
- Rust (latest stable)
- Tauri CLI

### Running in Development
```bash
npm install
npm run tauri dev
```

### Building for Production
```bash
npm run tauri build
```

## Security

Cocobolo prioritizes security and privacy:
- All data is encrypted at rest using industry-standard encryption
- No telemetry or data collection
- All data stays local on your device
- Zero-knowledge architecture

## Documentation

For more detailed information, check out the documentation in the [docs](./docs) folder:
- [macOS Installation Guide](./docs/macos-installation.md) - Instructions for running Cocobolo on macOS without a developer certificate
