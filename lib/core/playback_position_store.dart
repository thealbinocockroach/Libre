import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PlaybackPositionStore {
  static const String _keyBookId = 'playback_book_id';
  static const String _keyTrackId = 'playback_track_id';
  static const String _keyPositionMs = 'playback_position_ms';
  static const String _keySpeed = 'playback_speed';
  static const String _keySavedAt = 'playback_saved_at';

  static const Duration _debounceInterval = Duration(seconds: 3);
  static const Duration _saveCooldown = Duration(seconds: 10);
  static const Duration _maxStaleAge = Duration(hours: 24);

  Timer? _debounceTimer;
  DateTime? _lastSaveTime;
  SharedPreferences? _prefs;
  bool _isSaving = false;

  Future<void> _ensurePrefs() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  Future<void> savePosition({
    required String bookId,
    required String trackId,
    required Duration position,
    double speed = 1.0,
  }) async {
    if (bookId.isEmpty || trackId.isEmpty) return;
    if (position.isNegative) return;

    _debounceTimer?.cancel();

    _debounceTimer = Timer(_debounceInterval, () async {
      await _persistPosition(
        bookId: bookId,
        trackId: trackId,
        position: position,
        speed: speed,
      );
    });
  }

  Future<void> savePositionImmediate({
    required String bookId,
    required String trackId,
    required Duration position,
    double speed = 1.0,
  }) async {
    if (bookId.isEmpty || trackId.isEmpty) return;
    if (position.isNegative) return;

    _debounceTimer?.cancel();

    await _persistPosition(
      bookId: bookId,
      trackId: trackId,
      position: position,
      speed: speed,
    );
  }

  Future<void> _persistPosition({
    required String bookId,
    required String trackId,
    required Duration position,
    required double speed,
  }) async {
    if (_isSaving) return;

    final now = DateTime.now();
    if (_lastSaveTime != null &&
        now.difference(_lastSaveTime!) < _saveCooldown) {
      return;
    }

    _isSaving = true;
    try {
      await _ensurePrefs();
      await Future.wait([
        _prefs!.setString(_keyBookId, bookId),
        _prefs!.setString(_keyTrackId, trackId),
        _prefs!.setInt(_keyPositionMs, position.inMilliseconds),
        _prefs!.setDouble(_keySpeed, speed.clamp(0.5, 3.0)),
        _prefs!.setInt(_keySavedAt, now.millisecondsSinceEpoch),
      ]);
      _lastSaveTime = now;
    } catch (e) {
      debugPrint('[PlaybackPositionStore] Error persisting position: $e');
    } finally {
      _isSaving = false;
    }
  }

  Future<PlaybackSnapshot?> restorePosition() async {
    await _ensurePrefs();

    final savedAtMs = _prefs!.getInt(_keySavedAt);
    if (savedAtMs != null) {
      final savedAt = DateTime.fromMillisecondsSinceEpoch(savedAtMs);
      if (DateTime.now().difference(savedAt) > _maxStaleAge) {
        await clear();
        return null;
      }
    }

    final bookId = _prefs!.getString(_keyBookId);
    final trackId = _prefs!.getString(_keyTrackId);
    final positionMs = _prefs!.getInt(_keyPositionMs);
    final speed = _prefs!.getDouble(_keySpeed);

    if (bookId == null ||
        bookId.isEmpty ||
        trackId == null ||
        trackId.isEmpty ||
        positionMs == null) {
      return null;
    }

    return PlaybackSnapshot(
      bookId: bookId,
      trackId: trackId,
      position: Duration(milliseconds: positionMs),
      speed: speed ?? 1.0,
    );
  }

  Future<void> clear() async {
    _debounceTimer?.cancel();
    _lastSaveTime = null;
    await _ensurePrefs();
    await Future.wait([
      _prefs!.remove(_keyBookId),
      _prefs!.remove(_keyTrackId),
      _prefs!.remove(_keyPositionMs),
      _prefs!.remove(_keySpeed),
      _prefs!.remove(_keySavedAt),
    ]);
  }

  void dispose() {
    _debounceTimer?.cancel();
    _debounceTimer = null;
  }
}

class PlaybackSnapshot {
  final String bookId;
  final String trackId;
  final Duration position;
  final double speed;

  const PlaybackSnapshot({
    required this.bookId,
    required this.trackId,
    required this.position,
    required this.speed,
  });

  @override
  String toString() =>
      'PlaybackSnapshot(book: $bookId, track: $trackId, '
      'pos: ${position.inSeconds}s, speed: ${speed}x)';
}
