import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';

/// Download status for a single chapter.
enum DownloadStatus {
  queued,
  downloading,
  paused,
  completed,
  failed,
  cancelled,
}

/// Real-time progress snapshot for a chapter download.
class DownloadProgress {
  final String bookId;
  final String chapterId;
  final DownloadStatus status;
  final double percent;
  final int downloadedBytes;
  final int totalBytes;
  final String? error;

  const DownloadProgress({
    required this.bookId,
    required this.chapterId,
    required this.status,
    required this.percent,
    required this.downloadedBytes,
    required this.totalBytes,
    this.error,
  });
}

/// Resilient audio download manager for offline playback.
///
/// Files are stored at: `{documents}/audiobooks/{bookId}/{chapterId}.mp3`
class AudioDownloadService {
  AudioDownloadService._();
  static final AudioDownloadService instance = AudioDownloadService._();

  final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(minutes: 30),
      followRedirects: false,
      validateStatus: (code) => code != null && code < 500,
      headers: {
        'User-Agent': 'LibreAudio/1.0 (+https://libriaudio.app)',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://archive.org/',
      },
    ),
  );

  String? _downloadsRoot;
  final _progressController = StreamController<DownloadProgress>.broadcast();
  final Map<String, _ActiveJob> _jobs = {};

  /// Stream of real-time download progress events.
  Stream<DownloadProgress> get progressStream => _progressController.stream;

  String _jobKey(String bookId, String chapterId) => '$bookId/$chapterId';

  /// Request and verify local storage permissions, then resolve downloads dir.
  Future<String> initialize() async {
    if (_downloadsRoot != null) return _downloadsRoot!;

    if (Platform.isAndroid) {
      final storage = await Permission.storage.status;
      if (!storage.isGranted) {
        final result = await Permission.storage.request();
        if (!result.isGranted) {
          // App-scoped storage on Android 10+ does not require permission.
          final manage = await Permission.manageExternalStorage.status;
          if (!manage.isGranted && !result.isGranted) {
            // Continue — internal app documents dir is always writable.
          }
        }
      }
    }

    final docs = await getApplicationDocumentsDirectory();
    _downloadsRoot = '${docs.path}/audiobooks';
    await Directory(_downloadsRoot!).create(recursive: true);
    return _downloadsRoot!;
  }

  /// Absolute path for a chapter file.
  Future<String> chapterFilePath(String bookId, String chapterId) async {
    final root = await initialize();
    final dir = Directory('$root/$bookId');
    await dir.create(recursive: true);
    return '${dir.path}/$chapterId.mp3';
  }

  /// Whether the local chapter file exists and is large enough to be valid.
  Future<bool> isDownloaded(String bookId, String chapterId) async {
    final path = await chapterFilePath(bookId, chapterId);
    final file = File(path);
    return file.existsSync() && file.lengthSync() > 2048;
  }

  /// Returns `file://` URI when local file exists, otherwise the remote URL.
  Future<String> getPlayableUri(
    String bookId,
    String chapterId,
    String remoteUrl,
  ) async {
    final path = await chapterFilePath(bookId, chapterId);
    final file = File(path);
    if (file.existsSync() && file.lengthSync() > 2048) {
      return Uri.file(path).toString();
    }
    return remoteUrl.startsWith('http://')
        ? remoteUrl.replaceFirst('http://', 'https://')
        : remoteUrl;
  }

  /// Queue and start downloading a chapter.
  Future<void> downloadChapter({
    required String bookId,
    required String chapterId,
    required String remoteUrl,
  }) async {
    final key = _jobKey(bookId, chapterId);
    if (_jobs[key]?.status == DownloadStatus.downloading) return;

    final job = _ActiveJob(bookId: bookId, chapterId: chapterId);
    _jobs[key] = job;

    _emit(DownloadProgress(
      bookId: bookId,
      chapterId: chapterId,
      status: DownloadStatus.queued,
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    ));

    job.task = _runDownload(job, remoteUrl);
  }

  Future<void> pauseDownload(String bookId, String chapterId) async {
    final job = _jobs[_jobKey(bookId, chapterId)];
    if (job == null) return;
    job.paused = true;
    job.cancelToken?.cancel('paused');
    _emit(job.progress(DownloadStatus.paused));
  }

  Future<void> resumeDownload(
    String bookId,
    String chapterId,
    String remoteUrl,
  ) async {
    final job = _jobs[_jobKey(bookId, chapterId)];
    if (job == null || job.status == DownloadStatus.completed) return;
    job.paused = false;
    job.cancelToken = CancelToken();
    job.task = _runDownload(job, remoteUrl);
  }

  Future<void> cancelDownload(String bookId, String chapterId) async {
    final key = _jobKey(bookId, chapterId);
    final job = _jobs[key];
    if (job == null) return;
    job.cancelled = true;
    job.cancelToken?.cancel('cancelled');
    _jobs.remove(key);
    _emit(DownloadProgress(
      bookId: bookId,
      chapterId: chapterId,
      status: DownloadStatus.cancelled,
      percent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    ));
  }

  Future<void> deleteDownloadedChapter(String bookId, String chapterId) async {
    await cancelDownload(bookId, chapterId);
    final path = await chapterFilePath(bookId, chapterId);
    final file = File(path);
    if (file.existsSync()) await file.delete();
    final tmp = File('$path.tmp');
    if (tmp.existsSync()) await tmp.delete();
  }

  Future<void> _runDownload(_ActiveJob job, String remoteUrl) async {
    final path = await chapterFilePath(job.bookId, job.chapterId);
    final tmpPath = '$path.tmp';
    final tmpFile = File(tmpPath);

    job.status = DownloadStatus.downloading;
    job.cancelToken = CancelToken();
    _emit(job.progress(DownloadStatus.downloading));

    try {
      final resolvedUrl = await _resolveUrl(remoteUrl);
      final existingBytes = tmpFile.existsSync() ? tmpFile.lengthSync() : 0;

      await _dio.download(
        resolvedUrl,
        tmpPath,
        cancelToken: job.cancelToken,
        options: Options(
          headers: {
            if (existingBytes > 0) 'Range': 'bytes=$existingBytes-',
          },
          responseType: ResponseType.stream,
        ),
        onReceiveProgress: (received, total) {
          if (job.cancelled || job.paused) return;
          final base = existingBytes;
          final loaded = base + received;
          final fullTotal = total > 0 ? base + total : 0;
          job.downloadedBytes = loaded;
          job.totalBytes = fullTotal;
          job.percent = fullTotal > 0 ? (loaded / fullTotal) * 100 : 0;
          _emit(job.progress(DownloadStatus.downloading));
        },
      );

      if (job.cancelled) return;
      if (job.paused) return;

      final finalFile = File(path);
      if (finalFile.existsSync()) await finalFile.delete();
      await tmpFile.rename(path);

      job.status = DownloadStatus.completed;
      job.percent = 100;
      _emit(job.progress(DownloadStatus.completed));
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        if (job.paused) {
          _emit(job.progress(DownloadStatus.paused));
        } else if (job.cancelled) {
          _emit(job.progress(DownloadStatus.cancelled));
        }
        return;
      }
      job.status = DownloadStatus.failed;
      _emit(job.progress(DownloadStatus.failed, error: e.message));
    } catch (e) {
      job.status = DownloadStatus.failed;
      _emit(job.progress(DownloadStatus.failed, error: e.toString()));
    }
  }

  /// Follow 301/302 redirects manually, upgrading http → https.
  Future<String> _resolveUrl(String url, {int depth = 0}) async {
    if (depth > 8) throw Exception('Too many redirects');
    final normalized = url.startsWith('http://')
        ? url.replaceFirst('http://', 'https://')
        : url;

    final response = await _dio.head(
      normalized,
      options: Options(followRedirects: false),
    );

    final code = response.statusCode ?? 0;
    if (code >= 300 && code < 400) {
      final location = response.headers.value('location');
      if (location == null || location.isEmpty) {
        throw Exception('Redirect without Location header');
      }
      final next = location.startsWith('http')
          ? location
          : Uri.parse(normalized).resolve(location).toString();
      return _resolveUrl(next, depth: depth + 1);
    }

    return normalized;
  }

  void _emit(DownloadProgress progress) {
    if (!_progressController.isClosed) {
      _progressController.add(progress);
    }
  }

  void dispose() {
    _progressController.close();
  }
}

class _ActiveJob {
  _ActiveJob({required this.bookId, required this.chapterId});

  final String bookId;
  final String chapterId;
  DownloadStatus status = DownloadStatus.queued;
  double percent = 0;
  int downloadedBytes = 0;
  int totalBytes = 0;
  bool paused = false;
  bool cancelled = false;
  CancelToken? cancelToken;
  Future<void>? task;

  DownloadProgress progress(DownloadStatus s, {String? error}) => DownloadProgress(
        bookId: bookId,
        chapterId: chapterId,
        status: s,
        percent: percent,
        downloadedBytes: downloadedBytes,
        totalBytes: totalBytes,
        error: error,
      );
}
