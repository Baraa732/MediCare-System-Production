import 'package:cms/core/config/maps_config.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Renders [GoogleMap] only when a Maps API key is configured at build time.
class SafeGoogleMap extends StatelessWidget {
  const SafeGoogleMap({
    super.key,
    required this.initialCameraPosition,
    this.onMapCreated,
    this.markers = const {},
    this.circles = const {},
    this.onCameraMove,
    this.onCameraIdle,
    this.onTap,
    this.myLocationEnabled = false,
    this.myLocationButtonEnabled = false,
    this.zoomControlsEnabled = false,
    this.scrollGesturesEnabled = true,
    this.rotateGesturesEnabled = true,
    this.tiltGesturesEnabled = true,
    this.zoomGesturesEnabled = true,
    this.mapType = MapType.normal,
  });

  final CameraPosition initialCameraPosition;
  final void Function(GoogleMapController controller)? onMapCreated;
  final Set<Marker> markers;
  final Set<Circle> circles;
  final void Function(CameraPosition position)? onCameraMove;
  final VoidCallback? onCameraIdle;
  final void Function(LatLng position)? onTap;
  final bool myLocationEnabled;
  final bool myLocationButtonEnabled;
  final bool zoomControlsEnabled;
  final bool scrollGesturesEnabled;
  final bool rotateGesturesEnabled;
  final bool tiltGesturesEnabled;
  final bool zoomGesturesEnabled;
  final MapType mapType;

  @override
  Widget build(BuildContext context) {
    if (!MapsConfig.isConfigured) {
      return Container(
        color: Colors.grey.shade200,
        alignment: Alignment.center,
        child: Icon(Icons.map_outlined, size: 48, color: Colors.grey.shade500),
      );
    }

    return GoogleMap(
      onMapCreated: onMapCreated,
      initialCameraPosition: initialCameraPosition,
      markers: markers,
      circles: circles,
      onCameraMove: onCameraMove,
      onCameraIdle: onCameraIdle,
      onTap: onTap,
      myLocationEnabled: myLocationEnabled,
      myLocationButtonEnabled: myLocationButtonEnabled,
      zoomControlsEnabled: zoomControlsEnabled,
      scrollGesturesEnabled: scrollGesturesEnabled,
      rotateGesturesEnabled: rotateGesturesEnabled,
      tiltGesturesEnabled: tiltGesturesEnabled,
      zoomGesturesEnabled: zoomGesturesEnabled,
      mapType: mapType,
    );
  }
}
