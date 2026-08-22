import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/utils/auth_media_headers.dart';
import 'package:cms/core/utils/media_url.dart';
import 'package:flutter/material.dart';

class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholderAsset = Assets.assetsImagesClinicPlaceholder,
    this.placeholderIcon,
  });

  final String? imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final String placeholderAsset;
  final IconData? placeholderIcon;

  /// Doctor photo with branded doctor default.
  const AppNetworkImage.doctor({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholderIcon,
  }) : placeholderAsset = Assets.assetsImagesDefaultDoctor;

  /// Clinic photo with branded clinic default.
  const AppNetworkImage.clinic({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.placeholderIcon,
  }) : placeholderAsset = Assets.assetsImagesClinicPlaceholder;

  @override
  Widget build(BuildContext context) {
    final resolved = MediaUrl.resolve(imageUrl);
    Widget child;

    if (resolved.isEmpty) {
      child = _placeholder();
    } else {
      child = Image.network(
        resolved,
        width: width,
        height: height,
        fit: fit,
        headers: AuthMediaHeaders.bearer(),
        errorBuilder: (_, __, ___) => _placeholder(),
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return SizedBox(
            width: width,
            height: height,
            child: const Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        },
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: child);
    }
    return child;
  }

  Widget _placeholder() {
    return Image.asset(
      placeholderAsset,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, __, ___) {
        if (placeholderIcon != null) {
          return Container(
            width: width,
            height: height,
            color: Colors.grey.shade200,
            child: Icon(placeholderIcon, color: Colors.grey.shade500, size: 32),
          );
        }
        return Container(
          width: width,
          height: height,
          color: Colors.grey.shade200,
          child: Icon(Icons.image_outlined, color: Colors.grey.shade500),
        );
      },
    );
  }
}
