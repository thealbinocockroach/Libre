import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audio_service/audio_service.dart';
import '../../../core/audio_handler.dart';
import '../../catalog/models/audiobook_model.dart';

// Global Audio Handler Provider (initialized in main.dart)
final audioHandlerProvider = Provider<LibriAudioHandler>((ref) {
  throw UnimplementedError('audioHandlerProvider must be overridden in ProviderScope');
});

// Player State Representation
class PlayerStateModel {
  final AudiobookModel? currentBook;
  final AudioTrack? currentTrack;
  final bool isPlaying;
  final bool isBuffering;
  final Duration position;
  final Duration duration;
  final double speed;
  final int currentTrackIndex;
  final List<AudioTrack> playlist;

  const PlayerStateModel({
    this.currentBook,
    this.currentTrack,
    this.isPlaying = false,
    this.isBuffering = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.speed = 1.0,
    this.currentTrackIndex = 0,
    this.playlist = const [],
  });

  PlayerStateModel copyWith({
    AudiobookModel? currentBook,
    AudioTrack? currentTrack,
    bool? isPlaying,
    bool? isBuffering,
    Duration? position,
    Duration? duration,
    double? speed,
    int? currentTrackIndex,
    List<AudioTrack>? playlist,
  }) {
    return PlayerStateModel(
      currentBook: currentBook ?? this.currentBook,
      currentTrack: currentTrack ?? this.currentTrack,
      isPlaying: isPlaying ?? this.isPlaying,
      isBuffering: isBuffering ?? this.isBuffering,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      speed: speed ?? this.speed,
      currentTrackIndex: currentTrackIndex ?? this.currentTrackIndex,
      playlist: playlist ?? this.playlist,
    );
  }
}

class PlayerNotifier extends StateNotifier<PlayerStateModel> {
  final LibriAudioHandler _audioHandler;

  PlayerNotifier(this._audioHandler) : super(const PlayerStateModel()) {
    _listenToAudioService();
  }

  void _listenToAudioService() {
    // Listen to mediaItem changes
    _audioHandler.mediaItem.listen((item) {
      if (item != null) {
        final currentBook = _audioHandler.currentBook;
        final playlist = _audioHandler.playlist;
        final index = _audioHandler.currentIndex;
        final currentTrack = playlist.isNotEmpty && index < playlist.length
            ? playlist[index]
            : null;

        state = state.copyWith(
          currentBook: currentBook,
          currentTrack: currentTrack,
          duration: item.duration ?? Duration.zero,
          currentTrackIndex: index,
          playlist: playlist,
        );
      }
    });

    // Listen to PlaybackState updates
    _audioHandler.playbackState.listen((playbackState) {
      final isPlaying = playbackState.playing;
      final isBuffering = playbackState.processingState == AudioProcessingState.buffering ||
          playbackState.processingState == AudioProcessingState.loading;

      state = state.copyWith(
        isPlaying: isPlaying,
        isBuffering: isBuffering,
        speed: playbackState.speed,
      );
    });

    // Listen to position stream from player
    _audioHandler.player.positionStream.listen((position) {
      state = state.copyWith(position: position);
    });
  }

  Future<void> playBook(AudiobookModel book, {int trackIndex = 0}) async {
    state = state.copyWith(currentBook: book);
    await _audioHandler.loadBook(book, initialTrackIndex: trackIndex);
  }

  Future<void> play() => _audioHandler.play();

  Future<void> pause() => _audioHandler.pause();

  Future<void> togglePlayPause() async {
    if (state.isPlaying) {
      await _audioHandler.pause();
    } else {
      await _audioHandler.play();
    }
  }

  Future<void> seek(Duration position) => _audioHandler.seek(position);

  Future<void> rewind15() => _audioHandler.seekRelative(-15);

  Future<void> fastForward30() => _audioHandler.seekRelative(30);

  Future<void> skipNext() => _audioHandler.skipToNext();

  Future<void> skipPrevious() => _audioHandler.skipToPrevious();

  Future<void> setSpeed(double speed) => _audioHandler.setSpeed(speed);

  Future<void> selectTrack(int index) async {
    if (state.currentBook != null) {
      await _audioHandler.loadBook(state.currentBook!, initialTrackIndex: index);
    }
  }
}

// Global Player Controller Provider
final playerControllerProvider = StateNotifierProvider<PlayerNotifier, PlayerStateModel>((ref) {
  final audioHandler = ref.watch(audioHandlerProvider);
  return PlayerNotifier(audioHandler);
});
