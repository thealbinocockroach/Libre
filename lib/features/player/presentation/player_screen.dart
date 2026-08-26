import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:audio_service/audio_service.dart';
import '../providers/player_providers.dart';
import '../../catalog/models/audiobook_model.dart';

class PlayerScreen extends ConsumerWidget {
  const PlayerScreen({super.key});

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    if (hours > 0) {
      return '$hours:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerState = ref.watch(playerControllerProvider.select(
      (s) => PlayerStateModel(
        currentBook: s.currentBook,
        currentTrack: s.currentTrack,
        playlist: s.playlist,
        currentTrackIndex: s.currentTrackIndex,
        duration: s.duration,
        isPlaying: s.isPlaying,
        isBuffering: s.isBuffering,
        speed: s.speed,
      ),
    ));
    final book = playerState.currentBook;

    if (book == null) {
      return const Scaffold(
        backgroundColor: Color(0xFF0B0F19),
        body: Center(
          child: Text(
            'No active audiobook session',
            style: TextStyle(color: Colors.white70),
          ),
        ),
      );
    }

    final totalDuration = playerState.duration > Duration.zero
        ? playerState.duration
        : Duration(
            seconds: book.totalTimeSecs > 0 ? book.totalTimeSecs : 1);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Colors.white,
                      size: 32,
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.queue_music_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                    onPressed: () =>
                        _showChapterList(context, ref, book, playerState),
                  ),
                ],
              ),
              const Spacer(flex: 1),

              // Cover art — only rebuilds when currentBook changes
              Center(
                child: _CoverArtLeaf(
                  coverUrl: book.coverImageUrl,
                  bookId: book.id,
                ),
              ),
              const Spacer(flex: 1),

              Text(
                playerState.currentTrack?.title ?? book.title,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                book.author,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.6),
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 24),

              // High-frequency position slider — isolated leaf node
              _PositionSliderLeaf(
                totalDuration: totalDuration,
                formatDuration: _formatDuration,
              ),
              const SizedBox(height: 20),

              // Controls row — play/pause is an isolated stream leaf
              const _ControlsRowLeaf(),

              const Spacer(flex: 1),
            ],
          ),
        ),
      ),
    );
  }

  void _showChapterList(
    BuildContext context,
    WidgetRef ref,
    AudiobookModel book,
    PlayerStateModel state,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Chapters & Tracks',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white70),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.separated(
                  itemCount: state.playlist.length,
                  separatorBuilder: (context, index) =>
                      Divider(color: Colors.white.withOpacity(0.06)),
                  itemBuilder: (context, index) {
                    final track = state.playlist[index];
                    final isCurrent = index == state.currentTrackIndex;
                    return ListTile(
                      dense: true,
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 8),
                      leading: Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isCurrent
                              ? const Color(0xFF6366F1)
                              : const Color(0xFF1E293B),
                        ),
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            color:
                                isCurrent ? Colors.white : Colors.white70,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      title: Text(
                        track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isCurrent
                              ? const Color(0xFF818CF8)
                              : Colors.white,
                          fontWeight: isCurrent
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                      subtitle: track.duration > Duration.zero
                          ? Text(
                              _formatDuration(track.duration),
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.4),
                                fontSize: 12,
                              ),
                            )
                          : null,
                      trailing: isCurrent
                          ? const Icon(
                              Icons.equalizer_rounded,
                              color: Color(0xFF818CF8),
                              size: 20,
                            )
                          : null,
                      onTap: () {
                        ref
                            .read(playerControllerProvider.notifier)
                            .selectTrack(index);
                        Navigator.pop(context);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CoverArtLeaf extends StatelessWidget {
  final String coverUrl;
  final String bookId;

  const _CoverArtLeaf({
    required this.coverUrl,
    required this.bookId,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: MediaQuery.of(context).size.width * 0.72,
      height: MediaQuery.of(context).size.width * 0.72,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6366F1).withOpacity(0.25),
            blurRadius: 36,
            spreadRadius: 4,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Hero(
        tag: 'player_cover_$bookId',
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: CachedNetworkImage(
            imageUrl: coverUrl,
            fit: BoxFit.cover,
            errorWidget: (context, url, error) => Container(
              color: const Color(0xFF1E293B),
              child: const Icon(
                Icons.menu_book_rounded,
                color: Colors.white54,
                size: 64,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PositionSliderLeaf extends ConsumerStatefulWidget {
  final Duration totalDuration;
  final String Function(Duration) formatDuration;

  const _PositionSliderLeaf({
    required this.totalDuration,
    required this.formatDuration,
  });

  @override
  ConsumerState<_PositionSliderLeaf> createState() =>
      _PositionSliderLeafState();
}

class _PositionSliderLeafState extends ConsumerState<_PositionSliderLeaf> {
  double _dragValue = -1.0;

  @override
  Widget build(BuildContext context) {
    final audioHandler = ref.watch(audioHandlerProvider);
    final sliderMax = widget.totalDuration.inMilliseconds.toDouble();

    return StreamBuilder<Duration>(
      stream: audioHandler.player.positionStream,
      builder: (context, snapshot) {
        final position = snapshot.data ?? Duration.zero;
        final currentPosition = _dragValue >= 0.0
            ? Duration(milliseconds: _dragValue.toInt())
            : position;
        final sliderValue = currentPosition.inMilliseconds
            .toDouble()
            .clamp(0.0, sliderMax > 0 ? sliderMax : 1.0);

        return Column(
          children: [
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 4,
                thumbShape:
                    const RoundSliderThumbShape(enabledThumbRadius: 6),
                overlayShape:
                    const RoundSliderOverlayShape(overlayRadius: 14),
                activeTrackColor: const Color(0xFF6366F1),
                inactiveTrackColor: Colors.white.withOpacity(0.12),
                thumbColor: const Color(0xFF818CF8),
                overlayColor:
                    const Color(0xFF6366F1).withOpacity(0.2),
              ),
              child: Slider(
                value: sliderValue,
                min: 0.0,
                max: sliderMax > 0 ? sliderMax : 1.0,
                onChanged: (value) {
                  setState(() {
                    _dragValue = value;
                  });
                },
                onChangeEnd: (value) {
                  ref
                      .read(playerControllerProvider.notifier)
                      .seek(Duration(milliseconds: value.toInt()));
                  setState(() {
                    _dragValue = -1.0;
                  });
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.formatDuration(currentPosition),
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.5),
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    '-${widget.formatDuration(widget.totalDuration - currentPosition)}',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.5),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ControlsRowLeaf extends ConsumerWidget {
  const _ControlsRowLeaf();

  void _cycleSpeed(WidgetRef ref, double currentSpeed) {
    final speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
    int nextIndex = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
    if (nextIndex >= speeds.length) nextIndex = 0;
    ref
        .read(playerControllerProvider.notifier)
        .setSpeed(speeds[nextIndex]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerState = ref.watch(playerControllerProvider);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        TextButton(
          onPressed: () => _cycleSpeed(ref, playerState.speed),
          style: TextButton.styleFrom(
            backgroundColor: Colors.white.withOpacity(0.06),
            padding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(
            '${playerState.speed}x',
            style: const TextStyle(
              color: Color(0xFF818CF8),
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ),
        IconButton(
          icon: const Icon(
            Icons.replay_10_rounded,
            color: Colors.white,
            size: 32,
          ),
          onPressed: () => ref
              .read(playerControllerProvider.notifier)
              .rewind15(),
        ),
        // Play/Pause button — isolated StreamBuilder leaf
        const _PlayPauseButtonLeaf(),
        IconButton(
          icon: const Icon(
            Icons.forward_30_rounded,
            color: Colors.white,
            size: 32,
          ),
          onPressed: () => ref
              .read(playerControllerProvider.notifier)
              .fastForward30(),
        ),
        IconButton(
          icon: const Icon(
            Icons.skip_next_rounded,
            color: Colors.white70,
            size: 28,
          ),
          onPressed: () => ref
              .read(playerControllerProvider.notifier)
              .skipNext(),
        ),
      ],
    );
  }
}

class _PlayPauseButtonLeaf extends ConsumerWidget {
  const _PlayPauseButtonLeaf();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final audioHandler = ref.watch(audioHandlerProvider);

    return StreamBuilder<PlaybackState>(
      stream: audioHandler.playbackState,
      builder: (context, snapshot) {
        final state = snapshot.data;
        final isPlaying = state?.playing ?? false;
        final isBuffering = state?.processingState ==
                AudioProcessingState.buffering ||
            state?.processingState == AudioProcessingState.loading;

        return Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFF6366F1), Color(0xFF4F46E5)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6366F1).withOpacity(0.4),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: isBuffering
              ? const Center(
                  child: SizedBox(
                    width: 30,
                    height: 30,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 3,
                    ),
                  ),
                )
              : IconButton(
                  icon: Icon(
                    isPlaying
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 40,
                  ),
                  onPressed: () => ref
                      .read(playerControllerProvider.notifier)
                      .togglePlayPause(),
                ),
        );
      },
    );
  }
}
