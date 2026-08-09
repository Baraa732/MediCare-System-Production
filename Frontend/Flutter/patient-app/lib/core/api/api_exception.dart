class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  ApiException(this.message, {this.statusCode, this.code});

  @override
  String toString() => message;
}

String messageFromResponse(dynamic data, {String fallback = 'Request failed'}) {
  if (data is Map) {
    final error = data['error'];
    if (error is Map) {
      final nestedMessage = error['message'];
      if (nestedMessage is String && nestedMessage.isNotEmpty) {
        final details = error['details'];
        if (details is List && details.isNotEmpty) {
          return '$nestedMessage\n${details.map((e) => e.toString()).join('\n')}';
        }
        final suggestion = error['suggestion'];
        if (suggestion is String && suggestion.isNotEmpty) {
          return '$nestedMessage $suggestion';
        }
        return nestedMessage;
      }
    }

    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) {
      return message.map((e) => e.toString()).join('\n');
    }

    final suggestion = data['suggestion'];
    if (suggestion is String && suggestion.isNotEmpty) return suggestion;
  }
  return fallback;
}
