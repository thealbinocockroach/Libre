# LibriAudio

A free, open-source audiobook and ebook companion for Android. Stream thousands of public domain audiobooks from [LibriVox](https://librivox.org), import your own EPUBs, and track your reading journey with detailed stats.

## Download

**[Latest APK (v0.0.0)](https://github.com/thealbinocockroach/Libre/releases/latest)**

Download the `.apk` file from [Releases](https://github.com/thealbinocockroach/Libre/releases) and install it on your Android device. You may need to enable "Install from unknown sources" in your device settings.

## Features

### Audiobooks
- Stream from the LibriVox public domain catalog
- Download chapters for offline listening
- Background playback with media notification controls
- Sleep timer and playback speed control
- Voice enhancer (bass boost, reverb, virtualizer)

### Ebook Reader
- Import and read EPUB files
- Customizable reader (fonts, size, themes, margins)
- Highlight, bookmark, and annotate passages
- Note-taking with searchable annotations
- Chapter navigation

### Stats & Tracking
- Daily listening goal with progress ring
- Listening velocity (minutes per day)
- Time-of-day distribution chart
- Author and genre rankings
- Daily streaks and milestones

### Personalization
- Multiple dark and light themes with custom color editor
- Adjustable typography and font sizing
- User profile with avatar color picker
- Full-screen mode

### Data
- Export and import all app data as JSON backup
- Per-book reading positions saved automatically

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS v4
- **Mobile:** Capacitor 8 (Android)
- **Audio:** ExoPlayer (via Capacitor)
- **Build:** Vite + Gradle

## Getting Started

### Prerequisites
- Node.js 18+
- Java 21+ (for Android builds)
- Android SDK (via Android Studio)

### Development

```bash
npm install
npm run dev
```

### Build APK

```bash
npx vite build
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK will be at `android/app/build/outputs/apk/debug/LibreAudio-debug.apk`.

### Install on Device

```bash
adb install -r android/app/build/outputs/apk/debug/LibreAudio-debug.apk
```

## Project Structure

```
src/
  components/       # React UI components
    ExploreView     # Home/discover page
    SearchView      # Search and genre browsing
    LibraryView     # Saved books and downloads
    StatsView       # Listening/reading analytics
    SettingsView    # App settings
    ProfileDrawer   # Slide-in profile panel
    GutenbergReaderModal  # Ebook reader
    FullPlayerModal # Full audio player
    MiniPlayerWidget # Persistent mini player
    OnboardingView  # First-launch intro
  utils/            # Business logic and helpers
  types/            # TypeScript type definitions
  data/             # Mock catalog data
android/            # Capacitor Android project
```

## License

MIT
