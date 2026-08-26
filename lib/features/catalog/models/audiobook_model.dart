const _fallbackCoverUrl =
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800';

String _safeString(dynamic value, {String fallback = ''}) {
  if (value is String) return value;
  if (value != null) return value.toString();
  return fallback;
}

int _safeInt(dynamic value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

class AudioTrack {
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
    final title = _safeString(json['title'],
        fallback: 'Chapter ${index + 1}');

    String url = '';
    if (json['listen_url'] is String && (json['listen_url'] as String).isNotEmpty) {
      url = json['listen_url'] as String;
    } else if (json['url'] is String && (json['url'] as String).isNotEmpty) {
      url = json['url'] as String;
    } else if (json['download_url'] is String && (json['download_url'] as String).isNotEmpty) {
      url = json['download_url'] as String;
    }

    Duration trackDuration = Duration.zero;
    final playtime = json['playtime'] ?? json['length'] ?? json['duration'];
    if (playtime is num) {
      trackDuration = Duration(seconds: playtime.toInt());
    } else if (playtime is String) {
      trackDuration = _parseDurationString(playtime);
    }

    return AudioTrack(
      id: _safeString(json['id'], fallback: 'track_$index'),
      title: title,
      audioUrl: url,
      duration: trackDuration,
      trackNumber: index + 1,
    );
  }

  static Duration _parseDurationString(String timeStr) {
    if (timeStr.trim().isEmpty) return Duration.zero;
    try {
      final parts = timeStr
          .split(':')
          .map((e) => int.tryParse(e.trim()) ?? 0)
          .toList();
      if (parts.length == 3) {
        return Duration(
          hours: parts[0],
          minutes: parts[1],
          seconds: parts[2],
        );
      } else if (parts.length == 2) {
        return Duration(minutes: parts[0], seconds: parts[1]);
      } else if (parts.length == 1) {
        return Duration(seconds: parts[0]);
      }
    } catch (_) {}
    return Duration.zero;
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'audioUrl': audioUrl,
        'durationSeconds': duration.inSeconds,
        'trackNumber': trackNumber,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AudioTrack &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          trackNumber == other.trackNumber;

  @override
  int get hashCode => id.hashCode ^ trackNumber.hashCode;
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
  final String? urlLibrivox;
  final String? urlArchive;

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
    this.urlLibrivox,
    this.urlArchive,
  });

  factory AudiobookModel.fromLibriVoxJson(Map<String, dynamic> json) {
    String authorName = 'Unknown Author';
    if (json['authors'] is List) {
      final authorsList = json['authors'] as List;
      if (authorsList.isNotEmpty && authorsList.first is Map) {
        final firstAuthor = authorsList.first as Map<String, dynamic>;
        final firstName = _safeString(firstAuthor['first_name']);
        final lastName = _safeString(firstAuthor['last_name']);
        final combined = '$firstName $lastName'.trim();
        if (combined.isNotEmpty) authorName = combined;
      }
    }

    String rawDesc = _safeString(json['description'],
        fallback: 'No description available.');
    final cleanDesc = rawDesc
        .replaceAll(RegExp(r'<[^>]*>|&[^;]+;'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final description =
        cleanDesc.isNotEmpty ? cleanDesc : 'No description available.';

    String cover = _safeString(json['coverart_jpg']);
    if (cover.isEmpty && json['url_iarchive'] is String) {
      final archiveUrl = json['url_iarchive'] as String;
      final archiveId = archiveUrl
          .split('/')
          .lastWhere((e) => e.isNotEmpty, orElse: () => '');
      if (archiveId.isNotEmpty) {
        cover = 'https://archive.org/services/img/$archiveId';
      }
    }
    if (cover.isEmpty) cover = _fallbackCoverUrl;

    List<AudioTrack> parsedTracks = [];
    if (json['sections'] is List) {
      final sections = json['sections'] as List;
      for (int i = 0; i < sections.length; i++) {
        if (sections[i] is Map<String, dynamic>) {
          parsedTracks.add(
            AudioTrack.fromJson(sections[i] as Map<String, dynamic>, i),
          );
        }
      }
    }

    final id = _safeString(json['id']);
    final title = _safeString(json['title'], fallback: 'Untitled Audiobook');

    String? readerName;
    if (parsedTracks.isNotEmpty) {
      final sections = json['sections'] as List;
      if (sections.isNotEmpty && sections.first is Map) {
        final firstSection = sections.first as Map<String, dynamic>;
        final readers = firstSection['readers'];
        if (readers is List && readers.isNotEmpty && readers.first is Map) {
          final firstReader = readers.first as Map<String, dynamic>;
          final displayName = _safeString(firstReader['display_name']);
          if (displayName.isNotEmpty) readerName = displayName;
        }
      }
    }

    final language = _safeString(json['language'], fallback: 'English');
    final totalTime = _safeInt(json['totaltimesecs']);

    return AudiobookModel(
      id: id,
      title: title,
      author: authorName,
      description: description,
      coverImageUrl: cover,
      reader: readerName,
      language: language,
      totalTimeSecs: totalTime,
      tracks: parsedTracks,
      urlLibrivox: json['url_librivox'] is String
          ? json['url_librivox'] as String
          : null,
      urlArchive: json['url_iarchive'] is String
          ? json['url_iarchive'] as String
          : null,
    );
  }

  factory AudiobookModel.fromArchiveJson(Map<String, dynamic> json) {
    final id = _safeString(json['identifier']);
    final title = _safeString(json['title'], fallback: 'Untitled');
    final creator =
        _safeString(json['creator'], fallback: 'Unknown Author');

    return AudiobookModel(
      id: id,
      title: title,
      author: creator,
      description:
          'Audiobook from the Internet Archive LibriVox collection.',
      coverImageUrl: id.isNotEmpty
          ? 'https://archive.org/services/img/$id'
          : _fallbackCoverUrl,
      language: _safeString(json['language'], fallback: 'English'),
      tracks: [],
    );
  }

  String get formattedTotalDuration {
    if (totalTimeSecs <= 0) return 'Duration varies';
    final hours = totalTimeSecs ~/ 3600;
    final minutes = (totalTimeSecs % 3600) ~/ 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  AudiobookModel copyWith({
    String? id,
    String? title,
    String? author,
    String? description,
    String? coverImageUrl,
    String? reader,
    String? language,
    int? totalTimeSecs,
    List<AudioTrack>? tracks,
    String? urlLibrivox,
    String? urlArchive,
  }) {
    return AudiobookModel(
      id: id ?? this.id,
      title: title ?? this.title,
      author: author ?? this.author,
      description: description ?? this.description,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      reader: reader ?? this.reader,
      language: language ?? this.language,
      totalTimeSecs: totalTimeSecs ?? this.totalTimeSecs,
      tracks: tracks ?? this.tracks,
      urlLibrivox: urlLibrivox ?? this.urlLibrivox,
      urlArchive: urlArchive ?? this.urlArchive,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AudiobookModel &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}
