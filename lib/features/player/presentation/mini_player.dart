import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:audio_service/audio_service.dart';
import '../providers/player_providers.dart';
import 'player_screen.dart';

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Only rebuild when currentBook or currentTrack changes
    final playerState = ref.watch(playerControllerProvider.select(
      (s) => PlayerStateModel(
        currentBook: s.currentBook,
        currentTrack: s.currentTrack,
      ),
    ));
    final playerNotifier = ref.read(playerControllerProvider.notifier);

    if (playerState.currentBook == null) {
      return const SizedBox.shrink();
    }

    final book = playerState.currentBook!;
    final track = playerState.currentTrack;

    return GestureDetector(
      onTap: () {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          backgroundColor: Colors.transparent,
          builder: (context) => const PlayerScreen(),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(
            color: Colors.white.withOpacity(0.08),
            width: 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: Row(
                children: [
                  Hero(
                    tag: 'player_cover_${book.id}',
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: book.coverImageUrl,
                        width: 46,
                        height: 46,
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => Container(
                          width: 46,
                          height: 46,
                          color: const Color(0xFF334155),
                          child: const Icon(
                            Icons.menu_book_rounded,
                            color: Colors.white70,
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          track?.title ?? book.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          book.author,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.6),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.replay_10_rounded,
                      color: Colors.white70,
                      size: 22,
                    ),
                    onPressed: () => playerNotifier.rewind15(),
                    visualDensity: VisualDensity.compact,
                  ),
                  // Play/Pause button — isolated StreamBuilder leaf
                  const _MiniPlayPauseLeaf(),
                ],
              ),
            ),
            // Progress bar — isolated StreamBuilder leaf
            const _MiniPlayerProgressLeaf(),
          ],
        ),
      ),
    );
  }
}

class _MiniPlayPauseLeaf extends ConsumerWidget {
  const _MiniPlayPauseLeaf();

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

        return IconButton(
          icon: isBuffering
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Color(0xFF6366F1),
                  ),
                )
              : Icon(
                  isPlaying
                      ? Icons.pause_circle_filled_rounded
                      : Icons.play_circle_fill_rounded,
                  color: const Color(0xFF6366F1),
                  size: 36,
                ),
          onPressed: () =>
              ref.read(playerControllerProvider.notifier).togglePlayPause(),
        );
      },
    );
  }
}

class _MiniPlayerProgressLeaf extends ConsumerWidget {
  const _MiniPlayerProgressLeaf();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final audioHandler = ref.watch(audioHandlerProvider);

    return StreamBuilder<Duration>(
      stream: audioHandler.player.positionStream,
      builder: (context, snapshot) {
        final position = snapshot.data ?? Duration.zero;
        final duration = audioHandler.player.duration ?? Duration.zero;
        final progress = duration.inMilliseconds > 0
            ? (position.inMilliseconds / duration.inMilliseconds)
                .clamp(0.0, 1.0)
            : 0.0;

        return ClipRRect(
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(16),
          ),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 3,
            backgroundColor: Colors.white.withOpacity(0.06),
            valueColor:
                const AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
          ),
        );
      },
    );
  }
}
