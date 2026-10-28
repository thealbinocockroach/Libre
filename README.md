# Libre

Libre is an Android app for finding and enjoying public-domain audiobooks and ebooks. Browse the LibriVox catalog, discover ebooks from open libraries, and keep your listening and reading progress together.

## Download

[Download the latest Android APK](https://github.com/thealbinocockroach/Libre/releases/latest/download/LibreAudio.apk)

On your Android device, open the downloaded APK and follow the installation prompt. Android may ask you to allow installs from your browser or file manager.

## What you can do

- Search and explore audiobooks and ebooks from multiple open catalogs.
- Stream audiobooks or download chapters for offline listening.
- Read ebooks, save your place, and keep notes and bookmarks.
- Track listening and reading activity in your library and stats.
- Choose a light or dark appearance, adjust typography, and use system theme settings.
- Continue with downloaded audio and previously opened books when offline.

## Build it yourself

You’ll need Node.js, Java 21, and the Android SDK.

```sh
npm install
npx vite build
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is created at `android/app/build/outputs/apk/debug/LibreAudio-debug.apk`.

## Project details

Libre is built with React, TypeScript, Vite, and Capacitor for Android. Audiobook and ebook availability depends on the catalogs and network connection; the app also supports offline use for downloaded audio and saved books.

