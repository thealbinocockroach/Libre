import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/player_providers.dart';
import '../../catalog/models/audiobook_model.dart';

class PlayerScreen extends ConsumerStatefulWidget {
  const PlayerScreen({super.key});

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen> {
  double _dragValue = -1.0;

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

  void _showChapterList(BuildContext context, AudiobookModel book, PlayerStateModel state) {
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
                  separatorBuilder: (context, index) => Divider(color: Colors.white.withOpacity(0.06)),
                  itemBuilder: (context, index) {
                    final track = state.playlist[index];
                    final isCurrent = index == state.currentTrackIndex;
                    return ListTile(
                      dense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                      leading: Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isCurrent ? const Color(0xFF6366F1) : const Color(0xFF1E293B),
                        ),
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: isCurrent ? Colors.white : Colors.white70,
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
                          color: isCurrent ? const Color(0xFF818CF8) : Colors.white,
                          fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      subtitle: track.duration > Duration.zero
                          ? Text(
                              _formatDuration(track.duration),
                              style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                            )
                          : null,
                      trailing: isCurrent
                          ? const Icon(Icons.equalizer_rounded, color: Color(0xFF818CF8), size: 20)
                          : null,
                      onTap: () {
                        ref.read(playerControllerProvider.notifier).selectTrack(index);
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

  void _cycleSpeed(WidgetRef ref, double currentSpeed) {
    final speeds = [1.0, 1.25, 1.5, 1.75, 2.0];
    int nextIndex = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
    ref.read(playerControllerProvider.notifier).setSpeed(speeds[nextIndex]);
  }

  @override
  Widget build(BuildContext context) {
    final playerState = ref.watch(playerControllerProvider);
    final playerNotifier = ref.read(playerControllerProvider.notifier);
    final book = playerState.currentBook;

    if (book == null) {
      return const Scaffold(
        backgroundColor: Color(0xFF0B0F19),
        body: Center(
          child: Text('No active audiobook session', style: TextStyle(color: Colors.white70)),
        ),
      );
    }

    final currentPosition = _dragValue >= 0.0
        ? Duration(milliseconds: _dragValue.toInt())
        : playerState.position;
    final totalDuration = playerState.duration > Duration.zero
        ? playerState.duration
        : Duration(seconds: book.totalTimeSecs > 0 ? book.totalTimeSecs : 1);

    final sliderMax = totalDuration.inMilliseconds.toDouble();
    final sliderValue = currentPosition.inMilliseconds.toDouble().clamp(0.0, sliderMax);

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            children: [
              // Top Bar with Drag Handle / Dismiss & Chapter icon
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white, size: 32),
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
                    icon: const Icon(Icons.queue_music_rounded, color: Colors.white, size: 26),
                    onPressed: () => _showChapterList(context, book, playerState),
                  ),
                ],
              ),
              const Spacer(flex: 1),

              // Large Artwork Display with ambient glow
              Center(
                child: Container(
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
                    tag: 'player_cover_${book.id}',
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: CachedNetworkImage(
                        imageUrl: book.coverImageUrl,
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => Container(
                          color: const Color(0xFF1E293B),
                          child: const Icon(Icons.menu_book_rounded, color: Colors.white54, size: 64),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const Spacer(flex: 1),

              // Track & Audiobook Meta
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

              // Progress Timeline Slider
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 4,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                  activeTrackColor: const Color(0xFF6366F1),
                  inactiveTrackColor: Colors.white.withOpacity(0.12),
                  thumbColor: const Color(0xFF818CF8),
                  overlayColor: const Color(0xFF6366F1).withOpacity(0.2),
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
                    playerNotifier.seek(Duration(milliseconds: value.toInt()));
                    setState(() {
                      _dragValue = -1.0;
                    });
                  },
                ),
              ),

              // Timeline Timestamps
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatDuration(currentPosition),
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                    ),
                    Text(
                      '-${_formatDuration(totalDuration - currentPosition)}',
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Main Playback Controls
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Playback Speed Toggle
                  TextButton(
                    onPressed: () => _cycleSpeed(ref, playerState.speed),
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.white.withOpacity(0.06),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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

                  // 15s Rewind
                  IconButton(
                    icon: const Icon(Icons.replay_15_rounded, color: Colors.white, size: 32),
                    onPressed: () => playerNotifier.rewind15(),
                  ),

                  // Play / Pause Circle
                  Container(
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
                    child: playerState.isBuffering
                        ? const Center(
                            child: SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                            ),
                          )
                        : IconButton(
                            icon: Icon(
                              playerState.isPlaying
                                  ? Icons.pause_rounded
                                  : Icons.play_arrow_rounded,
                              color: Colors.white,
                              size: 40,
                            ),
                            onPressed: () => playerNotifier.togglePlayPause(),
                          ),
                  ),

                  // 30s Fast-Forward
                  IconButton(
                    icon: const Icon(Icons.forward_30_rounded, color: Colors.white, size: 32),
                    onPressed: () => playerNotifier.fastForward30(),
                  ),

                  // Next Chapter
                  IconButton(
                    icon: const Icon(Icons.skip_next_rounded, color: Colors.white70, size: 28),
                    onPressed: () => playerNotifier.skipNext(),
                  ),
                ],
              ),
              const Spacer(flex: 1),
            ],
          ),
        ),
      ),
    );
  }
}
