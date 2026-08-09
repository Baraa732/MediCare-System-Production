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
        return nestedMessage;
      }
    }
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) {
      return message.map((e) => e.toString()).join('\n');
    }
  }
  return fallback;
}
