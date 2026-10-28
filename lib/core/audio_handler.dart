import 'dart:async';
import 'package:flutter/material.dart';
import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import '../features/catalog/models/audiobook_model.dart';

Future<AudioHandler> initAudioService() async {
  return await AudioService.init(
    builder: () => LibriAudioHandler(),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.libriaudio.channel.audio',
      androidNotificationChannelName: 'LibriAudio Playback',
      androidNotificationChannelDescription: 'Manages audiobook playback controls in background',
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
      androidShowNotificationBadge: true,
      notificationColor: Color(0xFF1E293B),
      androidNotificationIcon: 'mipmap/ic_launcher',
      fastForwardInterval: Duration(seconds: 30),
      rewindInterval: Duration(seconds: 15),
    ),
  );
}

class LibriAudioHandler extends BaseAudioHandler with SeekHandler {
  final AudioPlayer _player = AudioPlayer();
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  AudiobookModel? _currentBook;
  List<AudioTrack> _playlist = [];
  int _currentIndex = 0;
  bool _isDisposed = false;

  AudiobookModel? get currentBook => _currentBook;
  List<AudioTrack> get playlist => _playlist;
  int get currentIndex => _currentIndex;
  AudioPlayer get player => _player;

  LibriAudioHandler() {
    _initPlayerEventForwarding();
  }

  void _initPlayerEventForwarding() {
    _subscriptions.add(
      _player.playbackEventStream.listen(
        (PlaybackEvent event) {
          if (_isDisposed) return;
          final playing = _player.playing;
          playbackState.add(
            playbackState.value.copyWith(
              controls: [
                MediaControl.skipToPrevious,
                if (playing) MediaControl.pause else MediaControl.play,
                MediaControl.skipToNext,
                MediaControl.stop,
              ],
              systemActions: const {
                MediaAction.seek,
                MediaAction.seekForward,
                MediaAction.seekBackward,
              },
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
        },
        onError: (Object e, StackTrace st) {
          debugPrint('[LibriAudioHandler] Playback event stream error: $e');
          if (_isDisposed) return;
          playbackState.add(
            playbackState.value.copyWith(
              processingState: AudioProcessingState.idle,
              playing: false,
            ),
          );
        },
      ),
    );

    _subscriptions.add(
      _player.playerStateStream.listen((state) {
        if (_isDisposed) return;
        if (state.processingState == ProcessingState.completed) {
          skipToNext();
        }
      }),
    );

    _subscriptions.add(
      _player.sequenceStateStream.listen((sequenceState) {
        if (_isDisposed) return;
        final source = sequenceState?.currentSource;
        final tag = source?.tag;
        if (tag is MediaItem) {
          final extras = tag.extras;
          if (extras != null && extras.containsKey('audioUrl')) {
            debugPrint('[LibriAudioHandler] Sequence updated: ${extras['audioUrl']}');
          }
        }
      }),
    );
  }

  Future<void> loadBook(AudiobookModel book, {int initialTrackIndex = 0}) async {
    _currentBook = book;
    _playlist = book.tracks.isNotEmpty
        ? book.tracks
        : [
            AudioTrack(
              id: 'single_${book.id}',
              title: book.title,
              audioUrl: '',
              duration: Duration(seconds: book.totalTimeSecs > 0 ? book.totalTimeSecs : 1),
              trackNumber: 1,
            )
          ];
    _currentIndex = initialTrackIndex.clamp(0, _playlist.length - 1);

    final queueMediaItems = _playlist.map((track) {
      return MediaItem(
        id: track.id,
        album: book.title,
        title: track.title,
        artist: book.author,
        duration: track.duration,
        artUri: Uri.tryParse(book.coverImageUrl),
        extras: {
          'audioUrl': track.audioUrl,
          'bookId': book.id,
          'trackNumber': track.trackNumber,
        },
      );
    }).toList();

    queue.add(queueMediaItems);
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
        artUri: _currentBook != null
            ? Uri.tryParse(_currentBook!.coverImageUrl)
            : null,
      ),
    );

    try {
      if (track.audioUrl.isNotEmpty) {
        final duration = await _player.setUrl(track.audioUrl);
        if (duration == null) {
          debugPrint('[LibriAudioHandler] Warning: setUrl returned null duration');
        }
        await _player.play();
      }
    } on TimeoutException catch (e) {
      debugPrint('[LibriAudioHandler] Timeout loading track: $e');
      if (!_isDisposed) {
        playbackState.add(
          playbackState.value.copyWith(
            processingState: AudioProcessingState.idle,
            playing: false,
          ),
        );
      }
    } on PlayerException catch (e) {
      debugPrint('[LibriAudioHandler] Player error: ${e.code} — ${e.message}');
      if (!_isDisposed) {
        playbackState.add(
          playbackState.value.copyWith(
            processingState: AudioProcessingState.idle,
            playing: false,
          ),
        );
      }
    } catch (e, st) {
      debugPrint('[LibriAudioHandler] Unexpected error loading track: $e\n$st');
      if (!_isDisposed) {
        playbackState.add(
          playbackState.value.copyWith(
            processingState: AudioProcessingState.idle,
            playing: false,
          ),
        );
      }
    }
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> seek(Duration position) {
    final clamped = position < Duration.zero ? Duration.zero : position;
    return _player.seek(clamped);
  }

  @override
  Future<void> stop() async {
    await _player.stop();
    await super.stop();
  }

  @override
  Future<void> skipToNext() async {
    if (_currentIndex < _playlist.length - 1) {
      await _prepareAndPlayTrack(_currentIndex + 1);
    }
  }

  @override
  Future<void> skipToPrevious() async {
    if (_player.position.inSeconds > 4) {
      await _player.seek(Duration.zero);
    } else if (_currentIndex > 0) {
      await _prepareAndPlayTrack(_currentIndex - 1);
    } else {
      await _player.seek(Duration.zero);
    }
  }

  @override
  Future<void> setSpeed(double speed) async {
    final clampedSpeed = speed.clamp(0.5, 3.0);
    await _player.setSpeed(clampedSpeed);
  }

  Future<void> seekRelative(int seconds) async {
    final current = _player.position;
    final target = current + Duration(seconds: seconds);
    final clamped = target < Duration.zero ? Duration.zero : target;
    await _player.seek(clamped);
  }

  @override
  Future<void> onTaskRemoved() async {
    await _savePositionBeforeStop();
    await stop();
    await _dispose();
  }

  Future<void> _savePositionBeforeStop() async {
    final book = _currentBook;
    final track = _playlist.isNotEmpty && _currentIndex < _playlist.length
        ? _playlist[_currentIndex]
        : null;
    if (book != null && track != null && _player.position > Duration.zero) {
      mediaItem.add(
        mediaItem.value?.copyWith(
          duration: _player.duration,
          extras: {
            ...?mediaItem.value?.extras,
            'lastPositionMs': _player.position.inMilliseconds,
            'savedAt': DateTime.now().millisecondsSinceEpoch,
          },
        ),
      );
    }
  }

  Future<void> onNotificationAction(String action, Map<String, dynamic>? extras) async {
    switch (action) {
      case 'rewind':
        await seekRelative(-15);
        break;
      case 'fastForward':
        await seekRelative(30);
        break;
    }
  }

  Future<void> _dispose() async {
    _isDisposed = true;
    for (final sub in _subscriptions) {
      await sub.cancel();
    }
    _subscriptions.clear();
    await _player.dispose();
  }
}
