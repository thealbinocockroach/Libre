import 'package:dio/dio.dart';
import '../../../core/api_client.dart';
import '../models/audiobook_model.dart';

abstract class ICatalogRepository {
  Future<List<AudiobookModel>> fetchExploreAudiobooks({int limit = 20, int offset = 0});
  Future<List<AudiobookModel>> searchAudiobooks(String query, {int limit = 25});
  Future<AudiobookModel> fetchAudiobookDetails(String id);
}

class CatalogRepository implements ICatalogRepository {
  final ApiClient _apiClient;

  CatalogRepository({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  @override
  Future<List<AudiobookModel>> fetchExploreAudiobooks({int limit = 20, int offset = 0}) async {
    try {
      final response = await _apiClient.get(
        ApiClient.librivoxBaseUrl,
        queryParameters: {
          'format': 'json',
          'limit': limit,
          'offset': offset,
          'extended': '1',
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map<String, dynamic> && data['books'] != null) {
          final booksList = data['books'] as List;
          return booksList.map((item) => AudiobookModel.fromLibriVoxJson(item as Map<String, dynamic>)).toList();
        }
      }
      return _getCuratedFallbackBooks();
    } catch (e) {
      // Return curated list if network fails or API format fluctuates
      return _getCuratedFallbackBooks();
    }
  }

  @override
  Future<List<AudiobookModel>> searchAudiobooks(String query, {int limit = 25}) async {
    if (query.trim().isEmpty) return [];

    try {
      // Query LibriVox API by title or author
      final response = await _apiClient.get(
        ApiClient.librivoxBaseUrl,
        queryParameters: {
          'format': 'json',
          'title': '^$query',
          'limit': limit,
          'extended': '1',
        },
      );

      List<AudiobookModel> results = [];
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map<String, dynamic> && data['books'] != null) {
          final booksList = data['books'] as List;
          results = booksList.map((item) => AudiobookModel.fromLibriVoxJson(item as Map<String, dynamic>)).toList();
        }
      }

      // If title search yielded few results, also query by author
      if (results.length < 5) {
        final authorResponse = await _apiClient.get(
          ApiClient.librivoxBaseUrl,
          queryParameters: {
            'format': 'json',
            'author': query,
            'limit': limit,
            'extended': '1',
          },
        );
        if (authorResponse.statusCode == 200 && authorResponse.data != null) {
          final data = authorResponse.data;
          if (data is Map<String, dynamic> && data['books'] != null) {
            final moreBooks = (data['books'] as List)
                .map((item) => AudiobookModel.fromLibriVoxJson(item as Map<String, dynamic>))
                .toList();
            final existingIds = results.map((e) => e.id).toSet();
            for (final book in moreBooks) {
              if (!existingIds.contains(book.id)) {
                results.add(book);
              }
            }
          }
        }
      }

      return results;
    } catch (e) {
      // Filter locally from fallback if offline
      return _getCuratedFallbackBooks()
          .where((book) =>
              book.title.toLowerCase().contains(query.toLowerCase()) ||
              book.author.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }
  }

  @override
  Future<AudiobookModel> fetchAudiobookDetails(String id) async {
    try {
      final response = await _apiClient.get(
        ApiClient.librivoxBaseUrl,
        queryParameters: {
          'format': 'json',
          'id': id,
          'extended': '1',
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map<String, dynamic> && data['books'] != null) {
          final list = data['books'] as List;
          if (list.isNotEmpty) {
            return AudiobookModel.fromLibriVoxJson(list.first as Map<String, dynamic>);
          }
        }
      }
      throw AppException('Audiobook details not found');
    } catch (e) {
      final fallback = _getCuratedFallbackBooks().firstWhere(
        (b) => b.id == id,
        orElse: () => _getCuratedFallbackBooks().first,
      );
      return fallback;
    }
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
