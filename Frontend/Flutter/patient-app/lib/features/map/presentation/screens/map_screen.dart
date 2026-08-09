// lib/features/map/presentation/screens/map_screen.dart
import 'dart:async';
import 'dart:math';

import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/utils/geocode_service.dart';
import 'package:cms/core/widgets/modern_clinic_card.dart';
import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/widgets/map_pin_pulse.dart';
import 'package:cms/features/clinic/presentation/screens/clinic_detail_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/safe_google_map.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class MapScreen extends StatefulWidget {
  static const routeName = '/map';
  final Clinic? clinic;

  const MapScreen({super.key, this.clinic});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  static const _careBlue = Color(0xFF0B74FA);

  GoogleMapController? _mapController;
  late LatLng _initialPosition = const LatLng(33.5138, 36.2765); // fallback
  final Set<Marker> _markers = {};
  final Set<Circle> _circles = {};

  Position? _userLocation;
  List<Clinic> _allClinics = [];
  List<Clinic> _filteredClinics = [];
  /// `null` = show every clinic; otherwise filter by km from the user.
  double? _radiusKm;
  bool _loadingClinics = true;
  String? _clinicLoadError;
  Clinic? _selectedClinic;
  Offset? _pulseScreenOffset;
  Timer? _staggerTimer;
  int _staggerIndex = 0;
  bool _mapReady = false;

  // ---- Lifecycle ----
  @override
  void initState() {
    super.initState();
    _loadClinicsFromApi();
    _loadLocationAndClinics();
  }

  @override
  void dispose() {
    _staggerTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadClinicsFromApi() async {
    try {
      var clinics = await getIt<ClinicApiService>().listClinics();
      clinics = await _resolveClinicCoordinates(clinics);
      if (!mounted) return;
      setState(() {
        _allClinics = clinics;
        _loadingClinics = false;
        _clinicLoadError = null;
      });
      _applyClinicFilter();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingClinics = false;
        _clinicLoadError = 'Could not load clinics from server.';
      });
    }
  }

  Future<List<Clinic>> _resolveClinicCoordinates(List<Clinic> clinics) async {
    final geocoder = GeocodeService();
    final resolved = <Clinic>[];

    for (final clinic in clinics) {
      if (clinic.hasCoordinates) {
        resolved.add(clinic);
        continue;
      }

      final query = [
        clinic.address,
        clinic.city,
        clinic.governorate,
        clinic.location,
        clinic.name,
      ].where((part) => part.trim().isNotEmpty).join(', ');

      final coords = await geocoder.geocode(query);
      if (coords != null) {
        resolved.add(
          clinic.copyWith(latitude: coords.lat, longitude: coords.lng),
        );
      } else {
        resolved.add(clinic);
      }
    }

    return resolved;
  }

  void _applyClinicFilter() {
    if (_allClinics.isEmpty) {
      setState(() {
        _filteredClinics = [];
        _selectedClinic = null;
        _pulseScreenOffset = null;
      });
      _startStaggeredMarkers();
      _updateCircles();
      return;
    }

    setState(() {
      // Default: all clinics. Radius filter only when user picks a km limit.
      if (_radiusKm != null && _userLocation != null) {
        _filteredClinics = filterClinicsByRadius(
          allClinics: _allClinics,
          userLocation: _userLocation!,
          radiusInKm: _radiusKm!,
        );
      } else {
        _filteredClinics = List.from(_allClinics);
      }
      if (_selectedClinic != null &&
          !_filteredClinics.any((c) => c.id == _selectedClinic!.id)) {
        _selectedClinic = null;
        _pulseScreenOffset = null;
      }
    });
    _startStaggeredMarkers();
    _updateCircles();
    _fitCameraToContent();
  }

  // ---- Load location and filter clinics ----
  Future<void> _loadLocationAndClinics() async {
    bool hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      // Use default location
      _useDefaultLocation();
      return;
    }

    Position? position = await getCurrentLocation();
    if (position == null) {
      // Use default location
      _useDefaultLocation();
      return;
    }

    setState(() {
      _userLocation = position;
      _initialPosition = LatLng(position.latitude, position.longitude);
    });
    _applyClinicFilter();
    _moveCameraToUser();
  }

  void _useDefaultLocation() {
    const double defaultLat = 33.5138;
    const double defaultLon = 36.2765;
    setState(() {
      _initialPosition = LatLng(defaultLat, defaultLon);
    });
    _applyClinicFilter();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _mapController?.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: LatLng(defaultLat, defaultLon), zoom: 12.0),
        ),
      );
    });
  }

  void _moveCameraToUser() {
    if (_userLocation == null || _mapController == null) return;
    _mapController!.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(
          target: LatLng(_userLocation!.latitude, _userLocation!.longitude),
          zoom: 14.0,
        ),
      ),
    );
  }

  void _updateCircles() {
    final next = <Circle>{};

    if (_radiusKm != null) {
      final center = _userLocation != null
          ? LatLng(_userLocation!.latitude, _userLocation!.longitude)
          : _initialPosition;
      next.add(
        Circle(
          circleId: const CircleId('service_radius'),
          center: center,
          radius: _radiusKm! * 1000,
          fillColor: _careBlue.withValues(alpha: 0.12),
          strokeColor: _careBlue.withValues(alpha: 0.85),
          strokeWidth: 2,
        ),
      );
    }

    if (_selectedClinic?.hasCoordinates == true) {
      next.add(
        Circle(
          circleId: const CircleId('selected_clinic'),
          center: LatLng(
            _selectedClinic!.latitude!,
            _selectedClinic!.longitude!,
          ),
          radius: 180,
          fillColor: _careBlue.withValues(alpha: 0.18),
          strokeColor: _careBlue,
          strokeWidth: 2,
        ),
      );
    }

    setState(() {
      _circles
        ..clear()
        ..addAll(next);
    });
  }

  void _startStaggeredMarkers() {
    _staggerTimer?.cancel();
    _staggerIndex = 0;
    _markers.clear();
    final withCoords =
        _filteredClinics.where((c) => c.hasCoordinates).toList();
    if (withCoords.isEmpty) {
      setState(() {});
      return;
    }

    // Reveal first batch immediately, then stagger the rest.
    const batch = 3;
    void addBatch() {
      if (!mounted) return;
      final end = min(_staggerIndex + batch, withCoords.length);
      for (var i = _staggerIndex; i < end; i++) {
        _markers.add(_markerFor(withCoords[i]));
      }
      _staggerIndex = end;
      setState(() {});
      if (_staggerIndex < withCoords.length) {
        _staggerTimer = Timer(const Duration(milliseconds: 70), addBatch);
      }
    }

    addBatch();
  }

  Marker _markerFor(Clinic clinic) {
    final selected = _selectedClinic?.id == clinic.id;
    return Marker(
      markerId: MarkerId(clinic.id),
      position: LatLng(clinic.latitude!, clinic.longitude!),
      infoWindow: InfoWindow(
        title: clinic.name,
        snippet: '${clinic.specialty} - ${clinic.location}',
      ),
      icon: BitmapDescriptor.defaultMarkerWithHue(
        selected ? BitmapDescriptor.hueAzure : BitmapDescriptor.hueBlue,
      ),
      zIndexInt: selected ? 2 : 1,
      onTap: () => _selectClinic(clinic),
    );
  }

  Future<void> _selectClinic(Clinic clinic) async {
    setState(() => _selectedClinic = clinic);
    _updateCircles();
    // Refresh marker hues
    _markers
      ..clear()
      ..addAll(
        _filteredClinics
            .where((c) => c.hasCoordinates)
            .map(_markerFor),
      );
    setState(() {});
    if (clinic.hasCoordinates && _mapController != null) {
      await _mapController!.animateCamera(
        CameraUpdate.newLatLng(
          LatLng(clinic.latitude!, clinic.longitude!),
        ),
      );
    }
    await _syncPulseOverlay();
  }

  Future<void> _syncPulseOverlay() async {
    final clinic = _selectedClinic;
    final controller = _mapController;
    if (clinic == null || !clinic.hasCoordinates || controller == null) {
      if (mounted) setState(() => _pulseScreenOffset = null);
      return;
    }
    try {
      final screen = await controller.getScreenCoordinate(
        LatLng(clinic.latitude!, clinic.longitude!),
      );
      if (!mounted) return;
      setState(() {
        _pulseScreenOffset = Offset(screen.x.toDouble(), screen.y.toDouble());
      });
    } catch (_) {
      if (mounted) setState(() => _pulseScreenOffset = null);
    }
  }

  Future<void> _fitCameraToContent() async {
    final controller = _mapController;
    if (controller == null || !_mapReady) return;

    final points = <LatLng>[];
    if (_userLocation != null) {
      points.add(LatLng(_userLocation!.latitude, _userLocation!.longitude));
    }
    for (final clinic in _filteredClinics) {
      if (clinic.hasCoordinates) {
        points.add(LatLng(clinic.latitude!, clinic.longitude!));
      }
    }
    if (points.isEmpty) return;
    if (points.length == 1) {
      await controller.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: points.first, zoom: 14),
        ),
      );
      return;
    }

    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final p in points.skip(1)) {
      minLat = min(minLat, p.latitude);
      maxLat = max(maxLat, p.latitude);
      minLng = min(minLng, p.longitude);
      maxLng = max(maxLng, p.longitude);
    }
    try {
      await controller.animateCamera(
        CameraUpdate.newLatLngBounds(
          LatLngBounds(
            southwest: LatLng(minLat, minLng),
            northeast: LatLng(maxLat, maxLng),
          ),
          72,
        ),
      );
    } catch (_) {
      await controller.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: points.first, zoom: 13),
        ),
      );
    }
  }

  // ---- Distance helpers ----
  double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double earthRadius = 6371; // km
    double dLat = _toRadians(lat2 - lat1);
    double dLon = _toRadians(lon2 - lon1);
    double a =
        _haversine(dLat) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) * _haversine(dLon);
    double c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  double _toRadians(double degrees) => degrees * pi / 180.0;
  double _haversine(double angle) => pow(sin(angle / 2), 2).toDouble();

  List<Clinic> filterClinicsByRadius({
    required List<Clinic> allClinics,
    required Position userLocation,
    required double radiusInKm,
  }) {
    return allClinics.where((clinic) {
      if (!clinic.hasCoordinates) return false;
      final distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        clinic.latitude!,
        clinic.longitude!,
      );
      return distance <= radiusInKm;
    }).toList();
  }

  // ---- Permissions & Location ----
  // Remove the permission_handler import and usage.
  // Use Geolocator for both permissions and location.

  Future<bool> requestLocationPermission() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return false;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        return false;
      }
      return true;
    } catch (e) {
      print('⚠️ Location permission error: $e');
      return false; // Fallback: assume permission is not granted
    }
  }

  Future<Position?> getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        print('⚠️ Location services disabled');
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return null;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        return null;
      }

      return await Geolocator.getCurrentPosition();
    } catch (e) {
      print('⚠️ Error getting location: $e');
      return null; // Return null so we can fall back to default
    }
  }

  // ---- UI ----
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // ---- Map ----
          SafeGoogleMap(
            onMapCreated: (controller) {
              _mapController = controller;
              _mapReady = true;
              _updateCircles();
              _fitCameraToContent();
            },
            initialCameraPosition: CameraPosition(
              target: _initialPosition,
              zoom: 15.0,
            ),
            markers: _markers,
            circles: _circles,
            onCameraIdle: _syncPulseOverlay,
            onTap: (_) {
              setState(() {
                _selectedClinic = null;
                _pulseScreenOffset = null;
              });
              _updateCircles();
              _startStaggeredMarkers();
            },
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            zoomControlsEnabled: false,
            mapType: MapType.normal,
          ),
          if (_pulseScreenOffset != null)
            Positioned(
              left: _pulseScreenOffset!.dx - 28,
              top: _pulseScreenOffset!.dy - 28,
              child: const IgnorePointer(
                child: MapPinPulse(size: 56),
              ),
            ),
          // ---- Blue Header ----
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _buildBlueHeader(context),
          ),
          // ---- Radius Chip (non‑intrusive) ----
          Positioned(
            bottom: 200, // just above the clinic slider
            right: 16,
            child: _buildRadiusChip(context),
          ),
          if (_loadingClinics)
            const Center(child: CircularProgressIndicator()),
          if (_clinicLoadError != null)
            Positioned(
              top: 110,
              left: 16,
              right: 16,
              child: Material(
                color: Colors.orange.shade50,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _clinicLoadError!,
                    style: FontHeading.bodySmall.copyWith(
                      color: Colors.orange.shade900,
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildFloatingSlider(context),
          ),
        ],
      ),
    );
  }

  // ---- Blue Header (Search + Filter) ----
  Widget _buildBlueHeader(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 100,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: AppColors.main_background_blue,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                // Navigate to SearchScreen
              },
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  children: [
                    Icon(Icons.search, color: AppColors.black, size: 24),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Search clinics, doctors...',
                        style: FontHeading.bodySmall.copyWith(
                          color: AppColors.customGray,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              splashColor: Colors.transparent,
              highlightColor: Colors.transparent,
              onPressed: () => print('Filter pressed'),
              icon: Icon(
                Icons.filter_list,
                color: AppColors.main_background_blue,
                size: 24,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---- Radius Chip (floating, shows current radius) ----
  Widget _buildRadiusChip(BuildContext context) {
    final label =
        _radiusKm == null ? 'All clinics' : '${_radiusKm!.toInt()} KM';
    return GestureDetector(
      onTap: () => _showRadiusBottomSheet(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(9),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.shade200,
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            FaIcon(
              FontAwesomeIcons.mapPin,
              color: AppColors.main_background_blue,
              size: 16,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: FontHeading.bodySmall.copyWith(
                color: Colors.black,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.keyboard_arrow_down,
              color: AppColors.customGray,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  // ---- Bottom sheet for radius / show-all ----
  void _showRadiusBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        bool showAll = _radiusKm == null;
        double localRadius = _radiusKm ?? 5;
        return StatefulBuilder(
          builder: (context, setStateSheet) {
            return Container(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.customGray,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Clinics on map',
                    style: FontHeading.heading4.copyWith(color: Colors.black),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      'Show all clinics',
                      style: FontHeading.body.copyWith(color: Colors.black),
                    ),
                    subtitle: Text(
                      'Turn off to filter by distance from you',
                      style: FontHeading.bodySmall.copyWith(
                        color: AppColors.CustomgrayDark,
                      ),
                    ),
                    activeThumbColor: AppColors.main_background_blue,
                    value: showAll,
                    onChanged: (value) {
                      setStateSheet(() => showAll = value);
                    },
                  ),
                  if (!showAll) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Slider(
                            min: 1,
                            max: 50,
                            divisions: 49,
                            value: localRadius.clamp(1, 50),
                            onChanged: (value) {
                              setStateSheet(() => localRadius = value);
                            },
                          ),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          '${localRadius.toInt()} KM',
                          style: FontHeading.body.copyWith(
                            color: AppColors.main_background_blue,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _radiusKm = showAll ? null : localRadius;
                        });
                        _applyClinicFilter();
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.main_background_blue,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Apply'),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ---- Floating Clinics Slider ----
  Widget _buildFloatingSlider(BuildContext context) {
    if (_filteredClinics.isEmpty) {
      if (_loadingClinics) return const SizedBox.shrink();
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                _allClinics.isEmpty
                    ? 'No clinics loaded yet.'
                    : _radiusKm != null
                        ? 'No clinics in this radius. Tap the chip and choose “Show all clinics”.'
                        : 'No clinics with map coordinates yet.',
                style: FontHeading.bodySmall.copyWith(color: Colors.black87),
              ),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 210,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _filteredClinics.length,
        itemBuilder: (context, index) {
          final clinic = _filteredClinics[index];
          final selected = _selectedClinic?.id == clinic.id;
          return Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ModernClinicCard(
              clinic: clinic,
              style: ModernClinicCardStyle.compact,
              width: 168,
              selected: selected,
              onTap: () {
                _selectClinic(clinic);
                Navigator.push(
                  context,
                  AppPageRoute(
                    builder: (context) => ClinicDetailScreen(clinic: clinic),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
