import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/utils/media_url.dart';
import 'package:flutter/material.dart';

class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    required this.imageUrl,
    this.radius = 26,
    this.backgroundColor = Colors.white,
  });

  final String? imageUrl;
  final double radius;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    final resolved = MediaUrl.resolve(imageUrl);
    ImageProvider imageProvider;

    if (resolved.isNotEmpty) {
      imageProvider = NetworkImage(resolved);
    } else {
      imageProvider = AssetImage(Assets.assetsImagesUserFolanAlfolani);
    }

    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor,
      backgroundImage: imageProvider,
      onBackgroundImageError: (_, __) {},
    );
  }
}
