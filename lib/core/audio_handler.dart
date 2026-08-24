import 'dart:async';
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
      androidShowNotificationBadge: true,
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
    _initPlayerEventForwarding();
  }

  void _initPlayerEventForwarding() {
    // Forward playback state from just_audio to audio_service
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
    });

    // Listen to track completion and automatically advance
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        skipToNext();
      }
    });
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
              duration: Duration(seconds: book.totalTimeSecs),
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
        extras: {'audioUrl': track.audioUrl, 'bookId': book.id},
      );
    }).toList();

    queue.add(queueMediaItems);
    await _prepareAndPlayTrack(_currentIndex);
  }

  Future<void> _prepareAndPlayTrack(int index) async {
    if (index < 0 || index >= _playlist.length) return;
    _currentIndex = index;
    final track = _playlist[_currentIndex];

    // Update mediaItem for lock-screen / notification controls
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

    try {
      if (track.audioUrl.isNotEmpty) {
        await _player.setUrl(track.audioUrl);
        await _player.play();
      }
    } catch (e) {
      // Audio load error handled gracefully
    }
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> seek(Duration position) => _player.seek(position);

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
    await _player.setSpeed(speed);
  }

  Future<void> seekRelative(int seconds) async {
    final current = _player.position;
    final target = current + Duration(seconds: seconds);
    final clamped = target < Duration.zero ? Duration.zero : target;
    await _player.seek(clamped);
  }
}
