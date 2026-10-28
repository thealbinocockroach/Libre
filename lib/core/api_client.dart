import 'dart:async';
import 'dart:math' as math;
import 'package:dio/dio.dart';

class RateLimitInterceptor extends Interceptor {
  final Duration minimumInterval;
  DateTime _lastRequestTime = DateTime.fromMillisecondsSinceEpoch(0);

  RateLimitInterceptor({
    this.minimumInterval = const Duration(milliseconds: 800),
  });

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final now = DateTime.now();
    final elapsed = now.difference(_lastRequestTime);
    if (elapsed < minimumInterval) {
      await Future<void>.delayed(minimumInterval - elapsed);
    }
    _lastRequestTime = DateTime.now();
    handler.next(options);
  }
}

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;

  static const String librivoxBaseUrl =
      'https://librivox.org/api/feed/audiobooks';
  static const String internetArchiveBaseUrl =
      'https://archive.org/advancedsearch.php';
  static const String internetArchiveMetadataUrl =
      'https://archive.org/metadata';

  static const String _appName = 'LibriAudio';
  static const String _appVersion = '1.0.0';
  static const String _appUrl =
      'https://github.com/thealbinocockroach/Libre';

  static const int _maxRetries = 3;
  static const Duration _baseRetryDelay = Duration(seconds: 1);
  static const Duration _maxRetryDelay = Duration(seconds: 30);

  static const Map<String, String> _baseHeaders = {
    'User-Agent':
        '$_appName/$_appVersion (Flutter; Android/iOS; +$_appUrl) '
        'librivox-api-client/$_appVersion',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };

  static const Map<String, String> _librivoxHeaders = {
    'Referer': 'https://librivox.org/',
    'Origin': 'https://librivox.org',
  };

  static const Map<String, String> _archiveHeaders = {
    'Referer': 'https://archive.org/',
    'Origin': 'https://archive.org',
  };

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: Map<String, String>.of(_baseHeaders),
      ),
    );

    dio.interceptors.addAll([
      RateLimitInterceptor(
        minimumInterval: const Duration(milliseconds: 800),
      ),
      _buildWafDetectionInterceptor(),
      _buildLoggingInterceptor(),
    ]);
  }

  Interceptor _buildWafDetectionInterceptor() {
    return InterceptorsWrapper(
      onError: (DioException e, ErrorInterceptorHandler handler) {
        final response = e.response;
        if (response != null && _isWafBlocked(response)) {
          handler.next(
            DioException(
              requestOptions: e.requestOptions,
              response: response,
              type: DioExceptionType.badResponse,
              error: WafBlockedException(
                'Request blocked by server security (WAF/IP filter). '
                'HTTP ${response.statusCode} on ${e.requestOptions.uri}. '
                'Try again later or check your network.',
                uri: e.requestOptions.uri.toString(),
                statusCode: response.statusCode,
              ),
            ),
          );
          return;
        }
        handler.next(e);
      },
    );
  }

  Interceptor _buildLoggingInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) {
        return handler.next(options);
      },
      onResponse: (response, handler) {
        return handler.next(response);
      },
    );
  }

  bool _isWafBlocked(Response response) {
    final code = response.statusCode;
    if (code == null) return false;

    if (code == 403 || code == 429 || code == 503) {
      final server =
          response.headers.value('server')?.toLowerCase() ?? '';
      final via = response.headers.value('via')?.toLowerCase() ?? '';
      final cfRay = response.headers.value('cf-ray');
      final xAmzCfId = response.headers.value('x-amz-cf-id');
      final xSucuriId = response.headers.value('x-sucuri-id');

      final hasWafHeader =
          cfRay != null || xAmzCfId != null || xSucuriId != null;
      final hasWafServer = server.contains('cloudflare') ||
          server.contains('awselb') ||
          server.contains('sucuri') ||
          server.contains('akamaighost');
      final hasWafVia =
          via.contains('cloudflare') || via.contains('varnish');

      return hasWafHeader || hasWafServer || hasWafVia;
    }
    return false;
  }

  Map<String, String> _headersForHost(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return {};

    final host = uri.host;
    if (host.contains('librivox.org')) {
      return Map<String, String>.of(_librivoxHeaders);
    }
    if (host.contains('archive.org')) {
      return Map<String, String>.of(_archiveHeaders);
    }
    if (host.contains('gutenberg.org')) {
      return {
        'Referer': 'https://www.gutenberg.org/',
        'Origin': 'https://www.gutenberg.org',
      };
    }
    return {};
  }

  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    Duration? connectTimeout,
    Duration? receiveTimeout,
    int? maxRetries,
    String? authToken,
  }) async {
    final retries = maxRetries ?? _maxRetries;
    DioException? lastException;
    final requestTag =
        '[${DateTime.now().millisecondsSinceEpoch}] ${Uri.tryParse(path)?.path ?? path}';

    for (int attempt = 0; attempt <= retries; attempt++) {
      try {
        final mergedOptions = options ?? Options();
        final hostHeaders = _headersForHost(path);
        final mergedHeaders =
            Map<String, dynamic>.from(hostHeaders);

        if (mergedOptions.headers != null) {
          mergedHeaders.addAll(mergedOptions.headers!);
        }

        if (authToken != null && authToken.isNotEmpty) {
          final uri = Uri.tryParse(path);
          if (uri != null && uri.host.contains('gutenberg.org')) {
            mergedHeaders['Authorization'] = 'Token $authToken';
          }
        }

        mergedOptions.headers = mergedHeaders;

        if (connectTimeout != null) {
          mergedOptions.connectTimeout = connectTimeout;
        }
        if (receiveTimeout != null) {
          mergedOptions.receiveTimeout = receiveTimeout;
        }

        final response = await dio.get(
          path,
          queryParameters: queryParameters,
          options: mergedOptions,
        );
        return response;
      } on DioException catch (e) {
        lastException = e;

        if (e.error is WafBlockedException) {
          throw e.error as WafBlockedException;
        }

        if (attempt < retries && _isRetryable(e)) {
          final delay = _computeRetryDelay(attempt, e);
          debugPrint(
            '$requestTag Attempt ${attempt + 1}/$retries failed '
            '(${_dioExceptionLabel(e.type)}). '
            'Retrying in ${delay.inMilliseconds}ms...',
          );
          await Future<void>.delayed(delay);
          continue;
        }

        throw _handleDioError(e);
      }
    }

    throw _handleDioError(lastException!);
  }

  Duration _computeRetryDelay(int attempt, DioException error) {
    final jitter = math.Random().nextDouble();
    final exponential = _baseRetryDelay * (1 << attempt);
    final capped = exponential > _maxRetryDelay ? _maxRetryDelay : exponential;
    return Duration(
      milliseconds:
          (capped.inMilliseconds * (0.5 + jitter * 0.5)).toInt(),
    );
  }

  bool _isRetryable(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        if (statusCode == null) return false;
        return statusCode == 429 || statusCode >= 500;
      case DioExceptionType.badCertificate:
      default:
        return false;
    }
  }

  String _dioExceptionLabel(DioExceptionType type) {
    switch (type) {
      case DioExceptionType.connectionTimeout:
        return 'connection timeout';
      case DioExceptionType.sendTimeout:
        return 'send timeout';
      case DioExceptionType.receiveTimeout:
        return 'receive timeout';
      case DioExceptionType.badResponse:
        return 'bad response';
      case DioExceptionType.connectionError:
        return 'connection error';
      case DioExceptionType.cancel:
        return 'request cancelled';
      case DioExceptionType.unknown:
        return 'unknown error';
      case DioExceptionType.badCertificate:
        return 'bad certificate';
      default:
        return 'unknown error';
    }
  }

  AppException _handleDioError(DioException error) {
    final uri = error.requestOptions.uri;
    final method = error.requestOptions.method.toUpperCase();
    final statusCode = error.response?.statusCode;
    final timestamp = DateTime.now().toUtc().toIso8601String();

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        final timeoutSecs = error.type == DioExceptionType.connectionTimeout
            ? error.requestOptions.connectTimeout?.inSeconds ?? 15
            : error.requestOptions.receiveTimeout?.inSeconds ?? 20;
        return TimeoutException(
          '[$timestamp] $method $uri timed out after ${timeoutSecs}s. '
          'Check your internet connection and try again.',
          uri: uri.toString(),
          statusCode: statusCode,
        );
      case DioExceptionType.badResponse:
        if (statusCode == 403) {
          return WafBlockedException(
            '[$timestamp] Access denied (HTTP 403) at $uri. '
            'The server may be blocking automated requests.',
            uri: uri.toString(),
            statusCode: statusCode,
          );
        }
        if (statusCode == 429) {
          final retryAfter =
              error.response?.headers.value('retry-after');
          return RateLimitException(
            '[$timestamp] Rate limited (HTTP 429) at $uri.'
            '${retryAfter != null ? " Retry after ${retryAfter}s." : ""}',
            uri: uri.toString(),
            statusCode: statusCode,
          );
        }
        if (statusCode == 503) {
          return ServiceUnavailableException(
            '[$timestamp] Service temporarily unavailable (HTTP 503) at $uri. '
            'The server is overloaded or undergoing maintenance.',
            uri: uri.toString(),
            statusCode: statusCode,
          );
        }
        return ServerException(
          '[$timestamp] $method $uri returned HTTP $statusCode: '
          '${error.response?.statusMessage ?? "Unknown error"}',
          uri: uri.toString(),
          statusCode: statusCode,
        );
      case DioExceptionType.connectionError:
        return NetworkException(
          '[$timestamp] $method $uri failed — no internet connection. '
          'Please check your network settings.',
          uri: uri.toString(),
          statusCode: statusCode,
        );
      case DioExceptionType.cancel:
        return AppException(
          '[$timestamp] Request to $uri was cancelled.',
          uri: uri.toString(),
          statusCode: statusCode,
        );
      default:
        return AppException(
          '[$timestamp] $method $uri failed unexpectedly: '
          '${error.message ?? "No details available"}',
          uri: uri.toString(),
          statusCode: statusCode,
        );
    }
  }

  void debugPrint(String message) {
    // ignore in production; useful during development
  }
}

class AppException implements Exception {
  final String message;
  final String? uri;
  final int? statusCode;

  AppException(this.message, {this.uri, this.statusCode});

  @override
  String toString() {
    final parts = <String>[message];
    if (uri != null) parts.add('URI: $uri');
    if (statusCode != null) parts.add('Status: $statusCode');
    return parts.join('\n');
  }
}

class NetworkException extends AppException {
  NetworkException(super.message, {super.uri, super.statusCode});
}

class TimeoutException extends AppException {
  TimeoutException(super.message, {super.uri, super.statusCode});
}

class ServerException extends AppException {
  ServerException(super.message, {super.uri, super.statusCode});
}

class WafBlockedException extends AppException {
  WafBlockedException(super.message, {super.uri, super.statusCode});
}

class RateLimitException extends AppException {
  RateLimitException(super.message, {super.uri, super.statusCode});
}

class ServiceUnavailableException extends AppException {
  ServiceUnavailableException(super.message, {super.uri, super.statusCode});
}
