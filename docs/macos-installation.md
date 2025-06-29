# Running Cocobolo on macOS

Since Cocobolo doesn't have an Apple Developer certificate, you may encounter security warnings when trying to run the application on macOS. This document provides workarounds to run the application for testing purposes.

## Method 1: Using Terminal to Remove Quarantine Attribute

When you download an application from the internet, macOS adds a quarantine attribute to the file. You can remove this attribute using the Terminal:

1. Open Terminal (Applications > Utilities > Terminal)
2. Navigate to the directory containing the Cocobolo app
3. Run the following command:

```bash
xattr -d com.apple.quarantine /path/to/Cocobolo.app
```

Replace `/path/to/Cocobolo.app` with the actual path to the application.

## Method 2: Using Finder to Open the App

1. Locate the Cocobolo app in Finder
2. Right-click (or Control-click) on the app
3. Select "Open" from the context menu
4. When the warning dialog appears, click "Open"

This method needs to be done only once. After the first launch, you can open the app normally.

## Method 3: Adjusting Security & Privacy Settings

1. If you get a security warning, open System Preferences
2. Go to Security & Privacy > General
3. Look for a message about Cocobolo being blocked
4. Click "Open Anyway" to allow the app to run

## Building from Source

If you prefer to build the application from source:

1. Clone the repository
2. Make sure you have Node.js and Rust installed
3. Install dependencies with `npm install`
4. Run the development build with `npm run tauri dev`

## Troubleshooting

If you continue to experience issues:

- Make sure you're using the correct version for your Mac's architecture (Intel or Apple Silicon)
- Try running the app from the Terminal to see any error messages
- Check if your macOS version is compatible with the application

For more information, refer to the [Tauri documentation](https://tauri.app/v1/guides/distribution/macos).