// lib/features/map/presentation/screens/map_test_screen.dart
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/widgets/map_pin_pulse.dart';
import 'package:cms/core/widgets/safe_google_map.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class MapTestScreen extends StatefulWidget {
  static const routeName = '/map-test';
  final Clinic? clinic;

  const MapTestScreen({super.key, this.clinic});

  @override
  State<MapTestScreen> createState() => _MapTestScreenState();
}

class _MapTestScreenState extends State<MapTestScreen> {
  static const _careBlue = Color(0xFF0B74FA);

  GoogleMapController? _mapController;
  late LatLng _initialPosition;
  final Set<Marker> _markers = {};
  final Set<Circle> _circles = {};
  Offset? _pulseOffset;

  @override
  void initState() {
    super.initState();

    if (widget.clinic != null && widget.clinic!.hasCoordinates) {
      _initialPosition = LatLng(
        widget.clinic!.latitude!,
        widget.clinic!.longitude!,
      );
      _addClinicMarker(widget.clinic!);
      _addClinicCircle(widget.clinic!);
    } else {
      _initialPosition = const LatLng(33.5138, 36.2765);
      if (widget.clinic != null) {
        _addClinicMarker(widget.clinic!);
      } else {
        _addSampleMarkers();
      }
    }
  }

  void _addClinicCircle(Clinic clinic) {
    if (!clinic.hasCoordinates) return;
    _circles.add(
      Circle(
        circleId: CircleId('clinic_${clinic.id}'),
        center: LatLng(clinic.latitude!, clinic.longitude!),
        radius: 500,
        fillColor: _careBlue.withValues(alpha: 0.12),
        strokeColor: _careBlue.withValues(alpha: 0.85),
        strokeWidth: 2,
      ),
    );
  }

  void _addClinicMarker(Clinic clinic) {
    if (!clinic.hasCoordinates) return;
    final marker = Marker(
      markerId: MarkerId(clinic.id),
      position: LatLng(clinic.latitude!, clinic.longitude!),
      infoWindow: InfoWindow(
        title: clinic.name,
        snippet: '${clinic.specialty} - ${clinic.location}',
      ),
      icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
    );
    setState(() {
      _markers.add(marker);
    });
  }

  void _addSampleMarkers() {
    final sampleClinics = [
      {
        'id': '1',
        'name': 'Al-Mazzeh Medical Center',
        'lat': 33.5138,
        'lng': 36.2765,
        'snippet': 'General Medicine - Damascus, Al-Mazzeh',
      },
      {
        'id': '2',
        'name': 'Heart Care Clinic',
        'lat': 33.5200,
        'lng': 36.2800,
        'snippet': 'Cardiology - Damascus, Al-Muhafaza',
      },
      {
        'id': '3',
        'name': 'Al-Mazzeh Dental Center',
        'lat': 33.5160,
        'lng': 36.2780,
        'snippet': 'Dentist - Damascus, Al-Mazzeh',
      },
    ];

    for (var c in sampleClinics) {
      final lat = c['lat'] as double;
      final lng = c['lng'] as double;
      final marker = Marker(
        markerId: MarkerId(c['id'] as String),
        position: LatLng(lat, lng),
        infoWindow: InfoWindow(
          title: c['name'] as String?,
          snippet: c['snippet'] as String?,
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
      );
      _markers.add(marker);
      _circles.add(
        Circle(
          circleId: CircleId('sample_${c['id']}'),
          center: LatLng(lat, lng),
          radius: 350,
          fillColor: _careBlue.withValues(alpha: 0.10),
          strokeColor: _careBlue.withValues(alpha: 0.7),
          strokeWidth: 2,
        ),
      );
    }
  }

  Future<void> _syncPulse() async {
    final clinic = widget.clinic;
    final controller = _mapController;
    if (clinic == null || !clinic.hasCoordinates || controller == null) return;
    try {
      final screen = await controller.getScreenCoordinate(
        LatLng(clinic.latitude!, clinic.longitude!),
      );
      if (!mounted) return;
      setState(() {
        _pulseOffset = Offset(screen.x.toDouble(), screen.y.toDouble());
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Clinic Location',
          style: TextStyle(color: Colors.black),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back, color: Colors.black),
        ),
      ),
      body: Stack(
        children: [
          SafeGoogleMap(
            onMapCreated: (controller) {
              _mapController = controller;
              _syncPulse();
            },
            initialCameraPosition: CameraPosition(
              target: _initialPosition,
              zoom: widget.clinic != null ? 15.0 : 12.0,
            ),
            markers: _markers,
            circles: _circles,
            onCameraIdle: _syncPulse,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            zoomControlsEnabled: true,
            mapType: MapType.normal,
          ),
          if (_pulseOffset != null)
            Positioned(
              left: _pulseOffset!.dx - 28,
              top: _pulseOffset!.dy - 28,
              child: const IgnorePointer(child: MapPinPulse(size: 56)),
            ),
        ],
      ),
    );
  }
}
