import '../../../core/api_client.dart';
import '../models/audiobook_model.dart';

abstract class ICatalogRepository {
  Future<List<AudiobookModel>> fetchExploreAudiobooks({int limit = 20, int offset = 0});
  Future<List<AudiobookModel>> searchAudiobooks(String query, {int limit = 25});
  Future<AudiobookModel> fetchAudiobookDetails(String id);
}

class CatalogRepository implements ICatalogRepository {
  final ApiClient _apiClient;
  String? _gutenbergToken;

  CatalogRepository({ApiClient? apiClient, String? gutenbergToken})
      : _apiClient = apiClient ?? ApiClient(),
        _gutenbergToken = gutenbergToken;

  set gutenbergToken(String? token) => _gutenbergToken = token;

  String? _tokenForEndpoint(String endpoint) {
    if (endpoint.contains('gutenberg.org') && _gutenbergToken != null && _gutenbergToken!.isNotEmpty) {
      return _gutenbergToken;
    }
    return null;
  }

  static const List<String> _librivoxEndpoints = [
    'https://librivox.org/api/feed/audiobooks',
    'https://www.gutenberg.org/ebooks/search/?query=audiobook&format=json',
    'https://archive.org/advancedsearch.php',
  ];

  @override
  Future<List<AudiobookModel>> fetchExploreAudiobooks({int limit = 20, int offset = 0}) async {
    for (int i = 0; i < _librivoxEndpoints.length; i++) {
      try {
        final endpoint = _librivoxEndpoints[i];
        final response = await _apiClient.get(
          endpoint,
          queryParameters: _buildExploreParams(endpoint, limit, offset),
          maxRetries: i == 0 ? 2 : 1,
          authToken: _tokenForEndpoint(endpoint),
        );

        if (response.statusCode == 200 && response.data != null) {
          final books = _parseBooksFromResponse(response.data, endpoint);
          if (books.isNotEmpty) return books;
        }
      } on WafBlockedException {
        continue;
      } on RateLimitException {
        continue;
      } on TimeoutException {
        continue;
      } on NetworkException {
        continue;
      } on ServerException {
        continue;
      } catch (e) {
        continue;
      }
    }

    return _getCuratedFallbackBooks();
  }

  @override
  Future<List<AudiobookModel>> searchAudiobooks(String query, {int limit = 25}) async {
    if (query.trim().isEmpty) return [];

    for (int i = 0; i < _librivoxEndpoints.length; i++) {
      try {
        final endpoint = _librivoxEndpoints[i];
        final response = await _apiClient.get(
          endpoint,
          queryParameters: _buildSearchParams(endpoint, query, limit),
          maxRetries: i == 0 ? 2 : 1,
          authToken: _tokenForEndpoint(endpoint),
        );

        if (response.statusCode == 200 && response.data != null) {
          final results = _parseBooksFromResponse(response.data, endpoint);
          if (results.isNotEmpty) {
            if (results.length < 5 && i < _librivoxEndpoints.length - 1) {
              final moreResults = await _tryAuthorSearch(query, limit);
              return _mergeResults(results, moreResults);
            }
            return results;
          }
        }
      } on WafBlockedException {
        continue;
      } on RateLimitException {
        continue;
      } on TimeoutException {
        continue;
      } on NetworkException {
        continue;
      } on ServerException {
        continue;
      } catch (e) {
        continue;
      }
    }

    return _getCuratedFallbackBooks()
        .where((book) =>
            book.title.toLowerCase().contains(query.toLowerCase()) ||
            book.author.toLowerCase().contains(query.toLowerCase()))
        .toList();
  }

  @override
  Future<AudiobookModel> fetchAudiobookDetails(String id) async {
    for (int i = 0; i < _librivoxEndpoints.length; i++) {
      try {
        final endpoint = _librivoxEndpoints[i];
        final response = await _apiClient.get(
          endpoint,
          queryParameters: _buildDetailParams(endpoint, id),
          maxRetries: i == 0 ? 2 : 1,
          authToken: _tokenForEndpoint(endpoint),
        );

        if (response.statusCode == 200 && response.data != null) {
          final books = _parseBooksFromResponse(response.data, endpoint);
          if (books.isNotEmpty) return books.first;
        }
      } on WafBlockedException {
        continue;
      } on RateLimitException {
        continue;
      } on TimeoutException {
        continue;
      } on NetworkException {
        continue;
      } on ServerException {
        continue;
      } catch (e) {
        continue;
      }
    }

    final fallback = _getCuratedFallbackBooks().firstWhere(
      (b) => b.id == id,
      orElse: () => _getCuratedFallbackBooks().first,
    );
    return fallback;
  }

  Map<String, dynamic> _buildExploreParams(String endpoint, int limit, int offset) {
    if (endpoint.contains('gutenberg.org')) {
      return {'page': (offset ~/ limit) + 1};
    }
    if (endpoint.contains('archive.org')) {
      return {
        'q': 'mediatype:audio AND collection:librivox',
        'fl[]': 'identifier,title,creator',
        'rows': limit,
        'page': (offset ~/ limit) + 1,
        'output': 'json',
      };
    }
    return {
      'format': 'json',
      'limit': limit,
      'offset': offset,
      'extended': '1',
    };
  }

  Map<String, dynamic> _buildSearchParams(String endpoint, String query, int limit) {
    if (endpoint.contains('gutenberg.org')) {
      return {'query': query};
    }
    if (endpoint.contains('archive.org')) {
      return {
        'q': '$query AND mediatype:audio AND collection:librivox',
        'fl[]': 'identifier,title,creator',
        'rows': limit,
        'output': 'json',
      };
    }
    return {
      'format': 'json',
      'title': '^$query',
      'limit': limit,
      'extended': '1',
    };
  }

  Map<String, dynamic> _buildDetailParams(String endpoint, String id) {
    if (endpoint.contains('gutenberg.org')) {
      return {};
    }
    if (endpoint.contains('archive.org')) {
      return {
        'q': 'identifier:$id',
        'output': 'json',
      };
    }
    return {
      'format': 'json',
      'id': id,
      'extended': '1',
    };
  }

  List<AudiobookModel> _parseBooksFromResponse(dynamic data, String endpoint) {
    try {
      if (endpoint.contains('archive.org') && data is Map<String, dynamic>) {
        return _parseArchiveResponse(data);
      }
      if (data is Map<String, dynamic> && data['books'] != null) {
        final booksList = data['books'] as List;
        return booksList
            .whereType<Map<String, dynamic>>()
            .map((item) => AudiobookModel.fromLibriVoxJson(item))
            .toList();
      }
    } catch (_) {}
    return [];
  }

  List<AudiobookModel> _parseArchiveResponse(Map<String, dynamic> data) {
    final response = data['response'];
    if (response == null) return [];
    final docs = response['docs'];
    if (docs is! List) return [];

    return docs.map<AudiobookModel>((doc) {
      if (doc is! Map<String, dynamic>) {
        return const AudiobookModel(
          id: '',
          title: 'Untitled',
          author: 'Unknown Author',
          description: '',
          coverImageUrl: '',
          language: 'English',
          tracks: [],
        );
      }
      return AudiobookModel.fromArchiveJson(doc);
    }).whereType<AudiobookModel>().toList();
  }

  Future<List<AudiobookModel>> _tryAuthorSearch(String query, int limit) async {
    try {
      final response = await _apiClient.get(
        ApiClient.librivoxBaseUrl,
        queryParameters: {
          'format': 'json',
          'author': query,
          'limit': limit,
          'extended': '1',
        },
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map<String, dynamic> && data['books'] != null) {
          return (data['books'] as List)
              .whereType<Map<String, dynamic>>()
              .map((item) => AudiobookModel.fromLibriVoxJson(item))
              .toList();
        }
      }
    } catch (_) {}
    return [];
  }

  List<AudiobookModel> _mergeResults(List<AudiobookModel> a, List<AudiobookModel> b) {
    final existingIds = a.map((e) => e.id).toSet();
    final merged = List<AudiobookModel>.from(a);
    for (final book in b) {
      if (!existingIds.contains(book.id)) {
        merged.add(book);
      }
    }
    return merged;
  }

  List<AudiobookModel> _getCuratedFallbackBooks() {
    return [
      AudiobookModel(
        id: '47',
        title: 'The Adventures of Sherlock Holmes',
        author: 'Arthur Conan Doyle',
        description: 'A collection of twelve short stories featuring Sherlock Holmes and Dr. John Watson, solving bewildering mysteries in Victorian London.',
        coverImageUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=800',
        language: 'English',
        totalTimeSecs: 39120,
        tracks: [
          AudioTrack(
            id: 'sh_01',
            title: 'A Scandal in Bohemia',
            audioUrl: 'https://www.archive.org/download/adventures_sherlock_holmes_1012_librivox/adventuresholmes_01_doyle_64kb.mp3',
            duration: Duration(minutes: 54, seconds: 12),
            trackNumber: 1,
          ),
          AudioTrack(
            id: 'sh_02',
            title: 'The Red-Headed League',
            audioUrl: 'https://www.archive.org/download/adventures_sherlock_holmes_1012_librivox/adventuresholmes_02_doyle_64kb.mp3',
            duration: Duration(minutes: 57, seconds: 45),
            trackNumber: 2,
          ),
          AudioTrack(
            id: 'sh_03',
            title: 'A Case of Identity',
            audioUrl: 'https://www.archive.org/download/adventures_sherlock_holmes_1012_librivox/adventuresholmes_03_doyle_64kb.mp3',
            duration: Duration(minutes: 42, seconds: 18),
            trackNumber: 3,
          ),
        ],
      ),
      AudiobookModel(
        id: '12',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        description: 'A classic romantic novel following Elizabeth Bennet and Fitzwilliam Darcy as they navigate pride, class prejudice, and courtship in rural England.',
        coverImageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800',
        language: 'English',
        totalTimeSecs: 37440,
        tracks: [
          AudioTrack(
            id: 'pp_01',
            title: 'Chapters 1-3',
            audioUrl: 'https://www.archive.org/download/pride_and_prejudice_librivox/prideandprejudice_01_austen_64kb.mp3',
            duration: Duration(minutes: 24, seconds: 50),
            trackNumber: 1,
          ),
          AudioTrack(
            id: 'pp_02',
            title: 'Chapters 4-6',
            audioUrl: 'https://www.archive.org/download/pride_and_prejudice_librivox/prideandprejudice_02_austen_64kb.mp3',
            duration: Duration(minutes: 28, seconds: 15),
            trackNumber: 2,
          ),
        ],
      ),
      AudiobookModel(
        id: '52',
        title: 'Frankenstein, or The Modern Prometheus',
        author: 'Mary Wollstonecraft Shelley',
        description: 'The iconic gothic masterpiece detailing Victor Frankenstein\'s scientific creation of a sapient being and the devastating consequences that follow.',
        coverImageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=800',
        language: 'English',
        totalTimeSecs: 28800,
        tracks: [
          AudioTrack(
            id: 'frank_01',
            title: 'Letters 1-4',
            audioUrl: 'https://www.archive.org/download/frankenstein_shelley_librivox/frankenstein_01_shelley_64kb.mp3',
            duration: Duration(minutes: 32, seconds: 10),
            trackNumber: 1,
          ),
          AudioTrack(
            id: 'frank_02',
            title: 'Chapter 1 & 2',
            audioUrl: 'https://www.archive.org/download/frankenstein_shelley_librivox/frankenstein_02_shelley_64kb.mp3',
            duration: Duration(minutes: 34, seconds: 40),
            trackNumber: 2,
          ),
        ],
      ),
    ];
  }
}
