import 'package:dio/dio.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;

  // Base endpoints for LibriVox and Internet Archive
  static const String librivoxBaseUrl = 'https://librivox.org/api/feed/audiobooks';
  static const String internetArchiveBaseUrl = 'https://archive.org/advancedsearch.php';
  static const String internetArchiveMetadataUrl = 'https://archive.org/metadata';

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LibriAudioApp/1.0.0 (https://github.com/libriaudio/app)',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          // You can attach logging or trace tokens here
          return handler.next(options);
        },
        onResponse: (response, handler) {
          return handler.next(response);
        },
        onError: (DioException e, handler) {
          // Custom unified error normalization
          return handler.next(e);
        },
      ),
    );
  }

  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      final response = await dio.get(
        path,
        queryParameters: queryParameters,
        options: options,
      );
      return response;
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Exception _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return TimeoutException('Connection timed out. Please check your internet connection.');
      case DioExceptionType.badResponse:
        return ServerException('Server error [${error.response?.statusCode}]: ${error.response?.statusMessage}');
      case DioExceptionType.connectionError:
        return NetworkException('No internet connection. Please verify your network.');
      default:
        return AppException('Unexpected error occurred: ${error.message}');
    }
  }
}

class AppException implements Exception {
  final String message;
  AppException(this.message);
  @override
  String toString() => message;
}

class NetworkException extends AppException {
  NetworkException(super.message);
}

class TimeoutException extends AppException {
  TimeoutException(super.message);
}

class ServerException extends AppException {
  ServerException(super.message);
}
