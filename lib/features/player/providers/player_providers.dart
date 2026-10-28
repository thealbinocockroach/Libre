import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audio_service/audio_service.dart';
import '../../../core/audio_handler.dart';
import '../../../core/playback_position_store.dart';
import '../../catalog/models/audiobook_model.dart';

final audioHandlerProvider = Provider<LibriAudioHandler>((ref) {
  throw UnimplementedError(
    'audioHandlerProvider must be overridden in ProviderScope',
  );
});

final playbackPositionStoreProvider = Provider<PlaybackPositionStore>((ref) {
  final store = PlaybackPositionStore();
  ref.onDispose(() => store.dispose());
  return store;
});

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
  final PlaybackPositionStore _positionStore;
  StreamSubscription<Duration>? _positionSubscription;

  PlayerNotifier(this._audioHandler, this._positionStore)
      : super(const PlayerStateModel()) {
    _listenToAudioService();
    _listenToPosition();
  }

  void _listenToAudioService() {
    _audioHandler.mediaItem.listen((item) {
      if (item != null) {
        final currentBook = _audioHandler.currentBook;
        final playlist = _audioHandler.playlist;
        final index = _audioHandler.currentIndex;
        final currentTrack =
            playlist.isNotEmpty && index < playlist.length
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

    _audioHandler.playbackState.listen((playbackState) {
      final isPlaying = playbackState.playing;
      final isBuffering =
          playbackState.processingState == AudioProcessingState.buffering ||
              playbackState.processingState == AudioProcessingState.loading;

      state = state.copyWith(
        isPlaying: isPlaying,
        isBuffering: isBuffering,
        speed: playbackState.speed,
      );
    });
  }

  void _listenToPosition() {
    _positionSubscription =
        _audioHandler.player.positionStream.listen((position) {
      state = state.copyWith(position: position);

      final book = state.currentBook;
      final track = state.currentTrack;
      if (book != null && track != null && position > Duration.zero) {
        _positionStore.savePosition(
          bookId: book.id,
          trackId: track.id,
          position: position,
          speed: state.speed,
        );
      }
    });
  }

  Future<void> playBook(AudiobookModel book, {int trackIndex = 0}) async {
    state = state.copyWith(currentBook: book);
    await _audioHandler.loadBook(book, initialTrackIndex: trackIndex);
  }

  Future<void> restoreSession() async {
    final snapshot = await _positionStore.restorePosition();
    if (snapshot == null) return;

    final currentBook = state.currentBook;
    if (currentBook == null || currentBook.id != snapshot.bookId) return;

    final trackIndex =
        state.playlist.indexWhere((t) => t.id == snapshot.trackId);
    if (trackIndex < 0) return;

    await _audioHandler.loadBook(currentBook, initialTrackIndex: trackIndex);
    await _audioHandler.seek(snapshot.position);
    await _audioHandler.setSpeed(snapshot.speed);
  }

  Future<void> play() => _audioHandler.play();

  Future<void> pause() async {
    await _audioHandler.pause();
    final book = state.currentBook;
    final track = state.currentTrack;
    if (book != null && track != null) {
      await _positionStore.savePositionImmediate(
        bookId: book.id,
        trackId: track.id,
        position: state.position,
        speed: state.speed,
      );
    }
  }

  Future<void> togglePlayPause() async {
    if (state.isPlaying) {
      await pause();
    } else {
      await play();
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
      await _audioHandler.loadBook(
        state.currentBook!,
        initialTrackIndex: index,
      );
    }
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    final book = state.currentBook;
    final track = state.currentTrack;
    if (book != null && track != null && state.position > Duration.zero) {
      _positionStore.savePositionImmediate(
        bookId: book.id,
        trackId: track.id,
        position: state.position,
        speed: state.speed,
      );
    }
    super.dispose();
  }
}

final playerControllerProvider =
    StateNotifierProvider<PlayerNotifier, PlayerStateModel>((ref) {
  final audioHandler = ref.watch(audioHandlerProvider);
  final positionStore = ref.watch(playbackPositionStoreProvider);
  return PlayerNotifier(audioHandler, positionStore);
});
