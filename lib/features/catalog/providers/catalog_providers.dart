import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/audiobook_model.dart';
import '../repositories/catalog_repository.dart';

// Repository Provider
final catalogRepositoryProvider = Provider<ICatalogRepository>((ref) {
  return CatalogRepository();
});

// Explore Feed Provider (FutureProvider with auto-dispose and family/refresh support)
final exploreAudiobooksProvider = FutureProvider<List<AudiobookModel>>((ref) async {
  final repository = ref.watch(catalogRepositoryProvider);
  return await repository.fetchExploreAudiobooks(limit: 20);
});

// Search Query State Provider
final searchQueryProvider = StateProvider<String>((ref) => '');

// Search Results Provider reacting to debounced search query
final searchResultsProvider = FutureProvider<List<AudiobookModel>>((ref) async {
  final query = ref.watch(searchQueryProvider);
  if (query.trim().isEmpty) return [];
  final repository = ref.watch(catalogRepositoryProvider);
  return await repository.searchAudiobooks(query.trim());
});

// Audiobook Detail Provider
final audiobookDetailProvider = FutureProvider.family<AudiobookModel, String>((ref, id) async {
  final repository = ref.watch(catalogRepositoryProvider);
  return await repository.fetchAudiobookDetails(id);
});
