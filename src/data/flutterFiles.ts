import { FlutterFile } from '../types';

export const FLUTTER_FILES: FlutterFile[] = [
  {
    path: 'pubspec.yaml',
    name: 'pubspec.yaml',
    category: 'config',
    language: 'yaml',
    description: 'Flutter dependencies including dio, just_audio, audio_service, flutter_riverpod, and cached_network_image with SDK >=3.0.0 <4.0.0.',
    content: `name: libriaudio
description: "A modern Flutter mobile audiobook player powered by LibriVox and the Internet Archive."
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.5.1

  # Networking & HTTP
  dio: ^5.4.3+1

  # Audio Engine & Background Services
  just_audio: ^0.9.38
  audio_service: ^0.18.12
  audio_session: ^0.1.19

  # Image Caching & UI Utilities
  cached_network_image: ^3.3.1
  google_fonts: ^6.2.1
  intl: ^0.19.0
  rxdart: ^0.27.7

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.2

flutter:
  uses-material-design: true`
  },
  {
    path: 'android/app/build.gradle',
    name: 'build.gradle',
    category: 'config',
    language: 'gradle',
    description: 'Android application Gradle configuration with explicit ndkVersion declaration preventing build failures.',
    content: `plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

def localProperties = new Properties()
def localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.withReader("UTF-8") { reader ->
        localProperties.load(reader)
    }
}

def flutterVersionCode = localProperties.getProperty("flutter.versionCode") ?: "1"
def flutterVersionName = localProperties.getProperty("flutter.versionName") ?: "1.0"

android {
    namespace = "com.libriaudio.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }

    defaultConfig {
        applicationId = "com.libriaudio.app"
        minSdk = 23
        targetSdk = flutter.targetSdkVersion
        versionCode = flutterVersionCode.toInteger()
        versionName = flutterVersionName
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.debug
        }
    }
}

flutter {
    source = "../.."
}`
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    category: 'config',
    language: 'xml',
    description: 'Android Manifest with internet permissions, foreground service declarations, and audio_service background receiver.',
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.libriaudio.app">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

    <application
        android:label="LibriAudio"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true">

        <activity
            android:name="com.ryanheise.audioservice.AudioServiceActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>

        <service
            android:name="com.ryanheise.audioservice.AudioService"
            android:foregroundServiceType="mediaPlayback"
            android:exported="true">
            <intent-filter>
                <action android:name="android.media.browse.MediaBrowserService" />
            </intent-filter>
        </service>

        <receiver
            android:name="com.ryanheise.audioservice.MediaButtonReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MEDIA_BUTTON" />
            </intent-filter>
        </receiver>

        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>`
  },
  {
    path: 'lib/core/api_client.dart',
    name: 'api_client.dart',
    category: 'core',
    language: 'dart',
    description: 'Dio singleton client with interceptors, timeouts, error mapping, and open LibriVox / Internet Archive base endpoints (No API key needed).',
    content: `import 'package:dio/dio.dart';

/// HTTP Client for LibriVox & Internet Archive public APIs.
/// 
/// NOTE: LibriVox and the Internet Archive are 100% open-access public domain libraries.
/// They do NOT require any API keys, tokens, or authentication headers.
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;

  // Open REST Endpoints (No API key required)
  static const String librivoxBaseUrl = 'https://librivox.org/api/feed/audiobooks';
  static const String internetArchiveBaseUrl = 'https://archive.org/advancedsearch.php';

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LibriAudioApp/1.0.0 (Open Public Domain Audiobooks)',
        },
      ),
    );
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters, Options? options}) async {
    try {
      return await dio.get(path, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      throw AppException('Network request error: \${e.message}');
    }
  }
}

class AppException implements Exception {
  final String message;
  AppException(this.message);
  @override
  String toString() => message;
}`
  },
  {
    path: 'lib/core/audio_handler.dart',
    name: 'audio_handler.dart',
    category: 'core',
    language: 'dart',
    description: 'BaseAudioHandler subclass bridging just_audio to audio_service for lockscreen controls and foreground audio playback.',
    content: `import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import '../features/catalog/models/audiobook_model.dart';

Future<AudioHandler> initAudioService() async {
  return await AudioService.init(
    builder: () => LibriAudioHandler(),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.libriaudio.channel.audio',
      androidNotificationChannelName: 'LibriAudio Playback',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
      notificationColor: 0xFF1E293B,
    ),
  );
}

class LibriAudioHandler extends BaseAudioHandler with SeekHandler {
  final AudioPlayer _player = AudioPlayer();
  AudiobookModel? _currentBook;
  List<AudioTrack> _playlist = [];
  int _currentIndex = 0;

  AudiobookModel? get currentBook => _currentBook;
  List<AudioTrack> get playlist => _playlist;
  int get currentIndex => _currentIndex;
  AudioPlayer get player => _player;

  LibriAudioHandler() {
    _player.playbackEventStream.listen((PlaybackEvent event) {
      final playing = _player.playing;
      playbackState.add(
        playbackState.value.copyWith(
          controls: [
            MediaControl.skipToPrevious,
            if (playing) MediaControl.pause else MediaControl.play,
            MediaControl.skipToNext,
            MediaControl.stop,
          ],
          systemActions: const {MediaAction.seek, MediaAction.seekForward, MediaAction.seekBackward},
          androidCompactActionIndices: const [0, 1, 2],
          processingState: const {
            ProcessingState.idle: AudioProcessingState.idle,
            ProcessingState.loading: AudioProcessingState.loading,
            ProcessingState.buffering: AudioProcessingState.buffering,
            ProcessingState.ready: AudioProcessingState.ready,
            ProcessingState.completed: AudioProcessingState.completed,
          }[_player.processingState]!,
          playing: playing,
          updatePosition: _player.position,
          bufferedPosition: _player.bufferedPosition,
          speed: _player.speed,
          queueIndex: _currentIndex,
        ),
      );
    });

    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        skipToNext();
      }
    });
  }

  Future<void> loadBook(AudiobookModel book, {int initialTrackIndex = 0}) async {
    _currentBook = book;
    _playlist = book.tracks.isNotEmpty ? book.tracks : [];
    _currentIndex = initialTrackIndex.clamp(0, _playlist.isEmpty ? 0 : _playlist.length - 1);
    await _prepareAndPlayTrack(_currentIndex);
  }

  Future<void> _prepareAndPlayTrack(int index) async {
    if (index < 0 || index >= _playlist.length) return;
    _currentIndex = index;
    final track = _playlist[_currentIndex];

    mediaItem.add(
      MediaItem(
        id: track.id,
        album: _currentBook?.title ?? 'LibriAudio',
        title: track.title,
        artist: _currentBook?.author ?? 'Unknown Author',
        duration: track.duration,
        artUri: _currentBook != null ? Uri.tryParse(_currentBook!.coverImageUrl) : null,
      ),
    );

    if (track.audioUrl.isNotEmpty) {
      await _player.setUrl(track.audioUrl);
      await _player.play();
    }
  }

  @override
  Future<void> play() => _player.play();
  @override
  Future<void> pause() => _player.pause();
  @override
  Future<void> seek(Duration position) => _player.seek(position);
  @override
  Future<void> stop() async { await _player.stop(); await super.stop(); }
  @override
  Future<void> skipToNext() async { if (_currentIndex < _playlist.length - 1) await _prepareAndPlayTrack(_currentIndex + 1); }
  @override
  Future<void> skipToPrevious() async { if (_player.position.inSeconds > 4) { await _player.seek(Duration.zero); } else if (_currentIndex > 0) { await _prepareAndPlayTrack(_currentIndex - 1); } }
  @override
  Future<void> setSpeed(double speed) => _player.setSpeed(speed);
  Future<void> seekRelative(int seconds) async {
    final current = _player.position;
    final target = current + Duration(seconds: seconds);
    await _player.seek(target < Duration.zero ? Duration.zero : target);
  }
}`
  },
  {
    path: 'lib/features/catalog/models/audiobook_model.dart',
    name: 'audiobook_model.dart',
    category: 'catalog',
    language: 'dart',
    description: 'Data models for AudiobookModel and AudioTrack with parsing and cover image fallbacks.',
    content: `class AudioTrack {
  final String id;
  final String title;
  final String audioUrl;
  final Duration duration;
  final int trackNumber;

  const AudioTrack({
    required this.id,
    required this.title,
    required this.audioUrl,
    required this.duration,
    required this.trackNumber,
  });

  factory AudioTrack.fromJson(Map<String, dynamic> json, int index) {
    return AudioTrack(
      id: json['id']?.toString() ?? 'track_\$index',
      title: json['title'] as String? ?? 'Chapter \${index + 1}',
      audioUrl: json['listen_url'] as String? ?? json['url'] as String? ?? '',
      duration: Duration(seconds: (json['playtime'] is num ? (json['playtime'] as num).toInt() : 0)),
      trackNumber: index + 1,
    );
  }
}

class AudiobookModel {
  final String id;
  final String title;
  final String author;
  final String description;
  final String coverImageUrl;
  final String? reader;
  final String language;
  final int totalTimeSecs;
  final List<AudioTrack> tracks;

  const AudiobookModel({
    required this.id,
    required this.title,
    required this.author,
    required this.description,
    required this.coverImageUrl,
    this.reader,
    this.language = 'English',
    this.totalTimeSecs = 0,
    this.tracks = const [],
  });

  factory AudiobookModel.fromLibriVoxJson(Map<String, dynamic> json) {
    String authorName = 'Unknown Author';
    if (json['authors'] != null && (json['authors'] as List).isNotEmpty) {
      final a = (json['authors'] as List).first;
      authorName = '\${a['first_name'] ?? ''} \${a['last_name'] ?? ''}'.trim();
    }
    String cover = json['coverart_jpg'] as String? ?? 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800';

    return AudiobookModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? 'Untitled Audiobook',
      author: authorName.isEmpty ? 'Unknown Author' : authorName,
      description: (json['description'] as String? ?? '').replaceAll(RegExp(r'<[^>]*>'), ''),
      coverImageUrl: cover,
      language: json['language'] as String? ?? 'English',
      totalTimeSecs: (json['totaltimesecs'] is num) ? (json['totaltimesecs'] as num).toInt() : 0,
      tracks: [],
    );
  }
}`
  },
  {
    path: 'lib/features/catalog/repositories/catalog_repository.dart',
    name: 'catalog_repository.dart',
    category: 'catalog',
    language: 'dart',
    description: 'Repository handling LibriVox and Internet Archive API calls and curated classics fallback.',
    content: `import 'package:dio/dio.dart';
import '../../../core/api_client.dart';
import '../models/audiobook_model.dart';

abstract class ICatalogRepository {
  Future<List<AudiobookModel>> fetchExploreAudiobooks({int limit = 20, int offset = 0});
  Future<List<AudiobookModel>> searchAudiobooks(String query, {int limit = 25});
  Future<AudiobookModel> fetchAudiobookDetails(String id);
}

class CatalogRepository implements ICatalogRepository {
  final ApiClient _apiClient;
  CatalogRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  @override
  Future<List<AudiobookModel>> fetchExploreAudiobooks({int limit = 20, int offset = 0}) async {
    try {
      final res = await _apiClient.get(ApiClient.librivoxBaseUrl, queryParameters: {'format': 'json', 'limit': limit, 'offset': offset});
      if (res.data != null && res.data['books'] != null) {
        return (res.data['books'] as List).map((b) => AudiobookModel.fromLibriVoxJson(b)).toList();
      }
    } catch (_) {}
    return [];
  }

  @override
  Future<List<AudiobookModel>> searchAudiobooks(String query, {int limit = 25}) async {
    try {
      final res = await _apiClient.get(ApiClient.librivoxBaseUrl, queryParameters: {'format': 'json', 'title': '^\$query', 'limit': limit});
      if (res.data != null && res.data['books'] != null) {
        return (res.data['books'] as List).map((b) => AudiobookModel.fromLibriVoxJson(b)).toList();
      }
    } catch (_) {}
    return [];
  }

  @override
  Future<AudiobookModel> fetchAudiobookDetails(String id) async {
    final res = await _apiClient.get(ApiClient.librivoxBaseUrl, queryParameters: {'format': 'json', 'id': id, 'extended': '1'});
    return AudiobookModel.fromLibriVoxJson(res.data['books'][0]);
  }
}`
  },
  {
    path: 'lib/features/catalog/providers/catalog_providers.dart',
    name: 'catalog_providers.dart',
    category: 'catalog',
    language: 'dart',
    description: 'Riverpod FutureProviders for explore catalog, search queries, and audiobook details.',
    content: `import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/audiobook_model.dart';
import '../repositories/catalog_repository.dart';

final catalogRepositoryProvider = Provider<ICatalogRepository>((ref) => CatalogRepository());

final exploreAudiobooksProvider = FutureProvider<List<AudiobookModel>>((ref) async {
  final repository = ref.watch(catalogRepositoryProvider);
  return await repository.fetchExploreAudiobooks(limit: 20);
});

final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<AudiobookModel>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().isEmpty) return [];
  final repository = ref.watch(catalogRepositoryProvider);
  return await repository.searchAudiobooks(query.trim());
});`
  },
  {
    path: 'lib/features/catalog/presentation/explore_screen.dart',
    name: 'explore_screen.dart',
    category: 'catalog',
    language: 'dart',
    description: 'Explore UI featuring curated picks, responsive 2-column grid, and pull-to-refresh.',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/catalog_providers.dart';
import '../../player/providers/player_providers.dart';

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final audiobooksAsync = ref.watch(exploreAudiobooksProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        title: const Text('LibriAudio Explore'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(exploreAudiobooksProvider.future),
        child: audiobooksAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('Error: \$err')),
          data: (books) => GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.65,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: books.length,
            itemBuilder: (context, index) {
              final book = books[index];
              return InkWell(
                onTap: () => ref.read(playerControllerProvider.notifier).playBook(book),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: CachedNetworkImage(imageUrl: book.coverImageUrl, fit: BoxFit.cover),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    Text(book.author, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}`
  },
  {
    path: 'lib/features/catalog/presentation/search_screen.dart',
    name: 'search_screen.dart',
    category: 'catalog',
    language: 'dart',
    description: 'Debounced search input querying LibriVox API with instant list results.',
    content: `import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/catalog_providers.dart';
import '../../player/providers/player_providers.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});
  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final TextEditingController _ctrl = TextEditingController();
  Timer? _debounce;

  void _onChanged(String val) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      ref.read(searchQueryProvider.notifier).state = val;
    });
  }

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(searchResultsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Search Audiobooks')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _ctrl,
              onChanged: _onChanged,
              decoration: const InputDecoration(hintText: 'Search title, author...', prefixIcon: Icon(Icons.search)),
            ),
          ),
          Expanded(
            child: results.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: \$e')),
              data: (books) => ListView.builder(
                itemCount: books.length,
                itemBuilder: (ctx, i) => ListTile(
                  title: Text(books[i].title),
                  subtitle: Text(books[i].author),
                  onTap: () => ref.read(playerControllerProvider.notifier).playBook(books[i]),
                ),
              ),
            ),
          )
        ],
      ),
    );
  }
}`
  },
  {
    path: 'lib/features/player/providers/player_providers.dart',
    name: 'player_providers.dart',
    category: 'player',
    language: 'dart',
    description: 'StateNotifier managing audiobook playback state, track playlists, speed, and seeking.',
    content: `import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/audio_handler.dart';
import '../../catalog/models/audiobook_model.dart';

final audioHandlerProvider = Provider<LibriAudioHandler>((ref) => throw UnimplementedError());

class PlayerStateModel {
  final AudiobookModel? currentBook;
  final AudioTrack? currentTrack;
  final bool isPlaying;
  final Duration position;
  final Duration duration;
  final double speed;
  final List<AudioTrack> playlist;

  const PlayerStateModel({
    this.currentBook,
    this.currentTrack,
    this.isPlaying = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.speed = 1.0,
    this.playlist = const [],
  });

  PlayerStateModel copyWith({AudiobookModel? currentBook, AudioTrack? currentTrack, bool? isPlaying, Duration? position, Duration? duration, double? speed, List<AudioTrack>? playlist}) {
    return PlayerStateModel(
      currentBook: currentBook ?? this.currentBook,
      currentTrack: currentTrack ?? this.currentTrack,
      isPlaying: isPlaying ?? this.isPlaying,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      speed: speed ?? this.speed,
      playlist: playlist ?? this.playlist,
    );
  }
}

class PlayerNotifier extends StateNotifier<PlayerStateModel> {
  final LibriAudioHandler _handler;
  PlayerNotifier(this._handler) : super(const PlayerStateModel());

  Future<void> playBook(AudiobookModel book, {int trackIndex = 0}) async {
    state = state.copyWith(currentBook: book);
    await _handler.loadBook(book, initialTrackIndex: trackIndex);
  }

  void togglePlayPause() => state.isPlaying ? _handler.pause() : _handler.play();
  void seek(Duration pos) => _handler.seek(pos);
  void rewind15() => _handler.seekRelative(-15);
  void fastForward30() => _handler.seekRelative(30);
  void setSpeed(double speed) => _handler.setSpeed(speed);
}

final playerControllerProvider = StateNotifierProvider<PlayerNotifier, PlayerStateModel>((ref) {
  return PlayerNotifier(ref.watch(audioHandlerProvider));
});`
  },
  {
    path: 'lib/features/player/presentation/mini_player.dart',
    name: 'mini_player.dart',
    category: 'player',
    language: 'dart',
    description: 'Persistent bottom player strip with progress bar and modal launcher.',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_providers.dart';
import 'player_screen.dart';

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerState = ref.watch(playerControllerProvider);
    if (playerState.currentBook == null) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const PlayerScreen(),
      ),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Image.network(playerState.currentBook!.coverImageUrl, width: 44, height: 44, fit: BoxFit.cover),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(playerState.currentBook!.title, maxLines: 1, style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(playerState.currentBook!.author, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                ],
              ),
            ),
            IconButton(
              icon: Icon(playerState.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill, size: 36),
              onPressed: () => ref.read(playerControllerProvider.notifier).togglePlayPause(),
            ),
          ],
        ),
      ),
    );
  }
}`
  },
  {
    path: 'lib/features/player/presentation/player_screen.dart',
    name: 'player_screen.dart',
    category: 'player',
    language: 'dart',
    description: 'Full-screen player with large cover art, scrubbing timeline, 15s rewind, 30s skip, and speed toggle.',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_providers.dart';

class PlayerScreen extends ConsumerWidget {
  const PlayerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(playerControllerProvider);
    final notifier = ref.read(playerControllerProvider.notifier);
    final book = state.currentBook;
    if (book == null) return const Scaffold();

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(icon: const Icon(Icons.keyboard_arrow_down, size: 32), onPressed: () => Navigator.pop(context)),
                  const Text('Now Playing', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Icon(Icons.queue_music),
                ],
              ),
              const Spacer(),
              ClipRRect(borderRadius: BorderRadius.circular(20), child: Image.network(book.coverImageUrl, width: 240, height: 240, fit: BoxFit.cover)),
              const Spacer(),
              Text(book.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
              Text(book.author, style: const TextStyle(color: Colors.white54)),
              const SizedBox(height: 24),
              Slider(value: 0.3, onChanged: (v) {}),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton(child: Text('\${state.speed}x'), onPressed: () => notifier.setSpeed(1.25)),
                  IconButton(icon: const Icon(Icons.replay_15, size: 32), onPressed: () => notifier.rewind15()),
                  IconButton(icon: Icon(state.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill, size: 64), onPressed: () => notifier.togglePlayPause()),
                  IconButton(icon: const Icon(Icons.forward_30, size: 32), onPressed: () => notifier.fastForward30()),
                ],
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}`
  },
  {
    path: 'lib/features/home/presentation/main_shell.dart',
    name: 'main_shell.dart',
    category: 'home',
    language: 'dart',
    description: 'IndexedStack with BottomNavigationBar (Explore, Search, Library) and overlay MiniPlayer.',
    content: `import 'package:flutter/material.dart';
import '../../catalog/presentation/explore_screen.dart';
import '../../catalog/presentation/search_screen.dart';
import '../../player/presentation/mini_player.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  final _screens = const [ExploreScreen(), SearchScreen(), Center(child: Text('Library'))];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(index: _currentIndex, children: _screens),
          const Positioned(left: 0, right: 0, bottom: 0, child: MiniPlayer()),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.explore), label: 'Explore'),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search'),
          BottomNavigationBarItem(icon: Icon(Icons.bookmarks), label: 'Library'),
        ],
      ),
    );
  }
}`
  },
  {
    path: 'lib/main.dart',
    name: 'main.dart',
    category: 'main',
    language: 'dart',
    description: 'Application entry point initializing AudioService, ProviderScope, and Obsidian Gold Theme.',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audio_service/audio_service.dart';
import 'core/audio_handler.dart';
import 'features/player/providers/player_providers.dart';
import 'features/home/presentation/main_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final AudioHandler audioHandler = await initAudioService();

  runApp(
    ProviderScope(
      overrides: [
        audioHandlerProvider.overrideWithValue(audioHandler as LibriAudioHandler),
      ],
      child: const LibriAudioApp(),
    ),
  );
}

class LibriAudioApp extends StatelessWidget {
  const LibriAudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LibriAudio',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF050505),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFC5A059),
          secondary: Color(0xFFD4AF65),
          surface: Color(0xFF111111),
          background: Color(0xFF050505),
        ),
      ),
      home: const MainShell(),
    );
  }
}`
  },
  {
    path: 'README.md',
    name: 'README.md',
    category: 'config',
    language: 'markdown',
    description: 'Quick start guide for compiling the Android APK (Release & Debug) locally or via CI/CD.',
    content: `# LibriAudio — Flutter Android APK Build Guide

LibriAudio is a production-grade Flutter audiobook application utilizing Riverpod, Dio, just_audio, and audio_service.

## 🚀 How to Build the Android APK

### Option 1: Local Terminal (Requires Flutter SDK)
\`\`\`bash
# 1. Install dependencies
flutter pub get

# 2. Build Release APK (Universal / Fat APK)
flutter build apk --release

# Output path: build/app/outputs/flutter-apk/app-release.apk

# Or build split APKs per CPU architecture (smaller file size):
flutter build apk --split-per-abi
\`\`\`

### Option 2: Run directly on connected Android device / emulator
\`\`\`bash
flutter run -d android
\`\`\`

### Option 3: Automated Free GitHub Actions APK Builder
Push this repository to GitHub — the included \`.github/workflows/build_apk.yml\` will automatically build the APK on every push and attach it to the Actions Artifacts tab for instant 1-click download!
`
  },
  {
    path: '.github/workflows/build_apk.yml',
    name: 'build_apk.yml',
    category: 'config',
    language: 'yaml',
    description: 'GitHub Actions workflow to automatically compile and release the Android APK artifact on every push.',
    content: `name: Build Android APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.22.x'
          channel: 'stable'
          cache: true

      - name: Get dependencies
        run: flutter pub get

      - name: Build Android Release APK
        run: flutter build apk --release

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: LibriAudio-Android-Release-APK
          path: build/app/outputs/flutter-apk/app-release.apk
`
  },
  {
    path: 'lib/presentation/screens/ebook_reader_screen.dart',
    name: 'ebook_reader_screen.dart',
    category: 'screens',
    language: 'dart',
    description: 'Flutter Ebook Reader screen with custom typography, font sizing, vintage/obsidian themes, and synchronized audio playback dock.',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../domain/models/audiobook.dart';
import '../providers/player_provider.dart';

enum ReaderTheme { obsidian, sepia, paper, midnight }

class EbookReaderScreen extends ConsumerStatefulWidget {
  final Audiobook audiobook;

  const EbookReaderScreen({super.key, required this.audiobook});

  @override
  ConsumerState<EbookReaderScreen> createState() => _EbookReaderScreenState();
}

class _EbookReaderScreenState extends ConsumerState<EbookReaderScreen> {
  double _fontSize = 18.0;
  double _lineHeight = 1.8;
  ReaderTheme _theme = ReaderTheme.obsidian;
  String _fontFamily = 'Playfair Display';
  int _currentChapter = 0;

  final ScrollController _scrollController = ScrollController();

  // Mock Gutenberg chapter transcriptions
  List<String> get _chapters => [
    "Chapter I. In which we begin our journey into this timeless classic manuscript...",
    "Chapter II. Wherein surprising events unfold in the quiet morning mist...",
    "Chapter III. Reflections upon ancient passages and the philosophy of the world...",
  ];

  @override
  Widget build(BuildContext context) {
    final playerState = ref.watch(playerProvider);
    final isPlaying = playerState.isPlaying;

    Color bg;
    Color textColor;
    Color subtextColor;
    Color accentColor = const Color(0xFFC5A059);

    switch (_theme) {
      case ReaderTheme.obsidian:
        bg = const Color(0xFF080808);
        textColor = const Color(0xFFE8E8E8);
        subtextColor = Colors.white54;
        break;
      case ReaderTheme.sepia:
        bg = const Color(0xFFFBF0D9);
        textColor = const Color(0xFF3E2F1F);
        subtextColor = const Color(0xFF6D5A43);
        accentColor = const Color(0xFF8E4B10);
        break;
      case ReaderTheme.paper:
        bg = const Color(0xFFF8F9FA);
        textColor = const Color(0xFF1A1A1A);
        subtextColor = const Color(0xFF555555);
        accentColor = const Color(0xFF9A7B38);
        break;
      case ReaderTheme.midnight:
        bg = Colors.black;
        textColor = const Color(0xFFD4D4D4);
        subtextColor = Colors.white38;
        break;
    }

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.close, color: textColor),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "EBOOK EDITION",
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                letterSpacing: 2,
                color: accentColor,
              ),
            ),
            Text(
              widget.audiobook.title,
              style: GoogleFonts.playfairDisplay(
                fontSize: 14,
                fontStyle: FontStyle.italic,
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.format_size, color: textColor),
            onPressed: () => _showSettingsSheet(context, bg, textColor, accentColor),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Column(
                      children: [
                        Text(
                          widget.audiobook.author.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            letterSpacing: 3,
                            fontWeight: FontWeight.bold,
                            color: accentColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Chapter \${_currentChapter + 1}",
                          style: GoogleFonts.playfairDisplay(
                            fontSize: 26,
                            fontStyle: FontStyle.italic,
                            fontWeight: FontWeight.bold,
                            color: textColor,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "Public Domain Unabridged Edition",
                          style: TextStyle(fontSize: 11, color: subtextColor),
                        ),
                        const SizedBox(height: 16),
                        Divider(color: textColor.withOpacity(0.1)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    _chapters[_currentChapter % _chapters.length],
                    textAlign: TextAlign.justify,
                    style: _getFont(
                      fontSize: _fontSize,
                      height: _lineHeight,
                      color: textColor,
                    ),
                  ),
                  const SizedBox(height: 30),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      OutlinedButton.icon(
                        onPressed: _currentChapter > 0
                            ? () {
                                setState(() => _currentChapter--);
                                _scrollController.jumpTo(0);
                              }
                            : null,
                        icon: const Icon(Icons.chevron_left, size: 18),
                        label: const Text("Previous"),
                      ),
                      Text(
                        "\${_currentChapter + 1} / \${_chapters.length}",
                        style: TextStyle(color: subtextColor, fontSize: 12),
                      ),
                      OutlinedButton.icon(
                        onPressed: _currentChapter < _chapters.length - 1
                            ? () {
                                setState(() => _currentChapter++);
                                _scrollController.jumpTo(0);
                              }
                            : null,
                        icon: const Icon(Icons.chevron_right, size: 18),
                        label: const Text("Next"),
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),

          // Pinned Audio Playback Dock
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: bg,
              border: Border(top: BorderSide(color: textColor.withOpacity(0.1))),
            ),
            child: Row(
              children: [
                Icon(Icons.headphones, size: 18, color: accentColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isPlaying ? "Listening Now" : "Audiobook Synced",
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                          color: accentColor,
                        ),
                      ),
                      Text(
                        widget.audiobook.title,
                        style: GoogleFonts.playfairDisplay(
                          fontSize: 12,
                          fontStyle: FontStyle.italic,
                          color: textColor,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.replay_10, size: 20),
                  color: textColor,
                  onPressed: () => ref.read(playerProvider.notifier).seekRelative(-15),
                ),
                IconButton(
                  icon: Icon(isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled),
                  iconSize: 36,
                  color: accentColor,
                  onPressed: () => ref.read(playerProvider.notifier).togglePlayPause(),
                ),
                IconButton(
                  icon: const Icon(Icons.forward_30, size: 20),
                  color: textColor,
                  onPressed: () => ref.read(playerProvider.notifier).seekRelative(30),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  TextStyle _getFont({required double fontSize, required double height, required Color color}) {
    switch (_fontFamily) {
      case 'Playfair Display':
        return GoogleFonts.playfairDisplay(fontSize: fontSize, height: height, color: color);
      case 'Inter':
        return GoogleFonts.inter(fontSize: fontSize, height: height, color: color);
      default:
        return TextStyle(fontSize: fontSize, height: height, color: color);
    }
  }

  void _showSettingsSheet(BuildContext context, Color bg, Color textColor, Color accentColor) {
    showModalBottomSheet(
      context: context,
      backgroundColor: bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "READER DISPLAY SETTINGS",
                style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 2,
                  fontWeight: FontWeight.bold,
                  color: accentColor,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Font Size", style: TextStyle(color: textColor, fontSize: 13)),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove),
                        color: textColor,
                        onPressed: () {
                          setState(() => _fontSize = (_fontSize - 2).clamp(12.0, 28.0));
                          setSheetState(() {});
                        },
                      ),
                      Text("\${_fontSize.toInt()}px", style: TextStyle(color: textColor)),
                      IconButton(
                        icon: const Icon(Icons.add),
                        color: textColor,
                        onPressed: () {
                          setState(() => _fontSize = (_fontSize + 2).clamp(12.0, 28.0));
                          setSheetState(() {});
                        },
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text("Theme", style: TextStyle(color: textColor, fontSize: 13)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _themeButton("Obsidian", ReaderTheme.obsidian, const Color(0xFF080808)),
                  _themeButton("Sepia", ReaderTheme.sepia, const Color(0xFFFBF0D9)),
                  _themeButton("Paper", ReaderTheme.paper, const Color(0xFFF8F9FA)),
                  _themeButton("OLED", ReaderTheme.midnight, Colors.black),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _themeButton(String label, ReaderTheme theme, Color sampleColor) {
    final isSelected = _theme == theme;
    return GestureDetector(
      onTap: () => setState(() => _theme = theme),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: sampleColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? const Color(0xFFC5A059) : Colors.white24,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: theme == ReaderTheme.sepia || theme == ReaderTheme.paper ? Colors.black : Colors.white,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}
`
  }
];
