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
    // Handling LibriVox / Internet Archive structure
    final title = json['title'] as String? ?? 'Chapter ${index + 1}';
    final url = json['listen_url'] as String? ?? 
                json['url'] as String? ?? 
                json['download_url'] as String? ?? '';
    
    // Parse duration either in seconds string or HH:MM:SS format
    Duration trackDuration = Duration.zero;
    final playtime = json['playtime'] ?? json['length'] ?? json['duration'];
    if (playtime is num) {
      trackDuration = Duration(seconds: playtime.toInt());
    } else if (playtime is String) {
      trackDuration = _parseDurationString(playtime);
    }

    return AudioTrack(
      id: json['id']?.toString() ?? 'track_$index',
      title: title,
      audioUrl: url,
      duration: trackDuration,
      trackNumber: index + 1,
    );
  }

  static Duration _parseDurationString(String timeStr) {
    try {
      final parts = timeStr.split(':').map((e) => int.tryParse(e) ?? 0).toList();
      if (parts.length == 3) {
        return Duration(hours: parts[0], minutes: parts[1], seconds: parts[2]);
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
    // Extract authors array safely
    String authorName = 'Unknown Author';
    if (json['authors'] != null && json['authors'] is List && (json['authors'] as List).isNotEmpty) {
      final firstAuthor = (json['authors'] as List).first;
      final firstName = firstAuthor['first_name'] ?? '';
      final lastName = firstAuthor['last_name'] ?? '';
      authorName = '$firstName $lastName'.trim();
      if (authorName.isEmpty) authorName = 'Unknown Author';
    }

    // Clean HTML tags from description if present
    String rawDesc = json['description'] as String? ?? 'No description available.';
    final cleanDesc = rawDesc
        .replaceAll(RegExp(r'<[^>]*>|&[^;]+;'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    // Cover image resolution
    // LibriVox books on Internet Archive usually have identifier like librivoxaudio_<id> or book title
    String cover = json['coverart_jpg'] as String? ?? '';
    if (cover.isEmpty && json['url_iarchive'] != null) {
      final archiveId = (json['url_iarchive'] as String).split('/').lastWhere((e) => e.isNotEmpty, orElse: () => '');
      if (archiveId.isNotEmpty) {
        cover = 'https://archive.org/services/img/$archiveId';
      }
    }
    if (cover.isEmpty) {
      // High quality curated fallback book cover aesthetic
      cover = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800';
    }

    // Parse sections/tracks
    List<AudioTrack> parsedTracks = [];
    if (json['sections'] != null && json['sections'] is List) {
      final sections = json['sections'] as List;
      for (int i = 0; i < sections.length; i++) {
        parsedTracks.add(AudioTrack.fromJson(sections[i] as Map<String, dynamic>, i));
      }
    }

    return AudiobookModel(
      id: json['id']?.toString() ?? '',
      title: json['title'] as String? ?? 'Untitled Audiobook',
      author: authorName,
      description: cleanDesc,
      coverImageUrl: cover,
      reader: (json['sections'] != null && (json['sections'] as List).isNotEmpty)
          ? (json['sections'] as List).first['readers']?[0]?['display_name']
          : null,
      language: json['language'] as String? ?? 'English',
      totalTimeSecs: (json['totaltimesecs'] is num)
          ? (json['totaltimesecs'] as num).toInt()
          : int.tryParse(json['totaltimesecs']?.toString() ?? '0') ?? 0,
      tracks: parsedTracks,
      urlLibrivox: json['url_librivox'] as String?,
      urlArchive: json['url_iarchive'] as String?,
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
}
