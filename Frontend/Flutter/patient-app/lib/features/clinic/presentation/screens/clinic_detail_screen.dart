//lib/features/clinic/presentation/screens/clinic_detail_screen.dart
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/doctor.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/app_network_image.dart';
import 'package:cms/core/widgets/safe_google_map.dart';
import 'package:cms/features/booking/presentation/screens/booking_form_screen.dart';
import 'package:cms/features/clinic/presentation/cubit/clinic_detail_cubit.dart';
import 'package:cms/features/clinic/presentation/cubit/clinic_detail_state.dart';
import 'package:cms/features/map/presentation/screens/map_test_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:cms/core/animations/app_page_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class ClinicDetailScreen extends StatelessWidget {
  static const routeName = '/clinic-detail';
  final Clinic clinic;

  const ClinicDetailScreen({super.key, required this.clinic});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<ClinicDetailCubit>()..load(clinic.id, initialClinic: clinic),
      child: _ClinicDetailView(fallbackClinic: clinic),
    );
  }
}

class _ClinicDetailView extends StatelessWidget {
  const _ClinicDetailView({required this.fallbackClinic});

  final Clinic fallbackClinic;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ClinicDetailCubit, ClinicDetailState>(
      builder: (context, state) {
        final clinic = state.clinic ?? fallbackClinic;
        final aboutText = clinic.description.trim().isNotEmpty
            ? clinic.description.trim()
            : clinic.specialty.trim().isNotEmpty
                ? clinic.specialty
                : 'No description available for this clinic yet.';
        final phone =
            clinic.phone.trim().isNotEmpty ? clinic.phone.trim() : '—';
        final email =
            clinic.email.trim().isNotEmpty ? clinic.email.trim() : null;

        return Scaffold(
          bottomSheet: BottomSheet(
            enableDrag: false,
            onClosing: () {},
            builder: (context) => Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 50),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(8),
                  topRight: Radius.circular(8),
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.customGray,
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pushNamed(
                      context,
                      BookingFormScreen.routeName,
                      arguments: clinic,
                    );
                  },
                  icon: const Icon(Icons.calendar_today, color: Colors.white),
                  label: const Text(
                    'Book an appointment',
                    style: FontHeading.button,
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.main_background_blue,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
          ),
          backgroundColor: Colors.white,
          body: SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Stack(
                          children: [
                            AppNetworkImage.clinic(
                              imageUrl: clinic.imageUrl,
                              width: double.infinity,
                              height: 200,
                              fit: BoxFit.cover,
                              borderRadius: const BorderRadius.only(
                                bottomLeft: Radius.circular(16),
                                bottomRight: Radius.circular(16),
                              ),
                            ),
                            Positioned(
                              top: 30,
                              left: 10,
                              child: GestureDetector(
                                onTap: () => Navigator.pop(context),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.main_background_white,
                                    borderRadius: BorderRadius.circular(117),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.arrow_back,
                                        color: AppColors.black,
                                        size: 16,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Back',
                                        style: FontHeading.bodySmall.copyWith(
                                          color: AppColors.black,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            IgnorePointer(
                              child: Container(
                                height: 200,
                                alignment: Alignment.bottomLeft,
                                padding:
                                    const EdgeInsets.fromLTRB(16, 0, 12, 0),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.black.withValues(alpha: 0),
                                      Colors.black.withValues(alpha: 1),
                                    ],
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    stops: const [0.6, 1],
                                  ),
                                  borderRadius: const BorderRadius.all(
                                    Radius.circular(16),
                                  ),
                                ),
                                child: SizedBox(
                                  width: MediaQuery.of(context).size.width - 90,
                                  child: Text(
                                    clinic.name,
                                    style: FontHeading.heading2.copyWith(
                                      color: Colors.white,
                                    ),
                                    overflow: TextOverflow.fade,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              bottom: 14,
                              right: 16,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(117),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      clinic.rating.toString(),
                                      style: FontHeading.caption.copyWith(
                                        color: Colors.black,
                                      ),
                                    ),
                                    const SizedBox(width: 2),
                                    Icon(
                                      Icons.star,
                                      color: Colors.yellow.shade600,
                                      size: 16,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (state.errorMessage != null)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                            child: Text(
                              state.errorMessage!,
                              style: FontHeading.bodySmall.copyWith(
                                color: Colors.orange.shade800,
                              ),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 16, 24, 4),
                          child: Text(
                            'About',
                            style: FontHeading.heading3.copyWith(
                              color: AppColors.black,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Text(
                            aboutText,
                            style: FontHeading.caption.copyWith(
                              color: AppColors.CustomgrayDark,
                            ),
                          ),
                        ),
                        const SizedBox(height: 32),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Location',
                                      style: FontHeading.heading3.copyWith(
                                        color: Colors.black,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.location_on_outlined,
                                          color: AppColors.main_background_blue,
                                          size: 16,
                                        ),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            clinic.location,
                                            style: FontHeading.bodySmall
                                                .copyWith(
                                              color: AppColors.CustomgrayDark,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(8),
                                child: Container(
                                  width: 40,
                                  height: 40,
                                  decoration: const BoxDecoration(
                                    color: AppColors.main_background_blue,
                                    shape: BoxShape.circle,
                                  ),
                                  child: IconButton(
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        AppPageRoute(
                                          builder: (context) =>
                                              MapTestScreen(clinic: clinic),
                                        ),
                                      );
                                    },
                                    icon: const Icon(
                                      Icons.map_outlined,
                                      color: AppColors.main_background_white,
                                      size: 20,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (clinic.hasCoordinates) ...[
                          const SizedBox(height: 12),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: SizedBox(
                                height: 100,
                                width: double.infinity,
                                child: SafeGoogleMap(
                                  initialCameraPosition: CameraPosition(
                                    target: LatLng(
                                      clinic.latitude!,
                                      clinic.longitude!,
                                    ),
                                    zoom: 15,
                                  ),
                                  markers: {
                                    Marker(
                                      markerId: const MarkerId('clinic'),
                                      position: LatLng(
                                        clinic.latitude!,
                                        clinic.longitude!,
                                      ),
                                      infoWindow:
                                          InfoWindow(title: clinic.name),
                                      icon: BitmapDescriptor
                                          .defaultMarkerWithHue(
                                        BitmapDescriptor.hueBlue,
                                      ),
                                    ),
                                  },
                                  circles: {
                                    Circle(
                                      circleId: const CircleId('clinic_radius'),
                                      center: LatLng(
                                        clinic.latitude!,
                                        clinic.longitude!,
                                      ),
                                      radius: 400,
                                      fillColor: const Color(0xFF0B74FA)
                                          .withValues(alpha: 0.12),
                                      strokeColor: const Color(0xFF0B74FA)
                                          .withValues(alpha: 0.85),
                                      strokeWidth: 2,
                                    ),
                                  },
                                  myLocationEnabled: false,
                                  zoomControlsEnabled: false,
                                  scrollGesturesEnabled: false,
                                  rotateGesturesEnabled: false,
                                  tiltGesturesEnabled: false,
                                  zoomGesturesEnabled: false,
                                ),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 32),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 0, 24, 4),
                          child: Text(
                            'Contact info',
                            style: FontHeading.heading3.copyWith(
                              color: AppColors.black,
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            height: 50,
                            decoration: BoxDecoration(
                              color: AppColors.customGray.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.phone_outlined,
                                  color: AppColors.main_background_blue,
                                  size: 20,
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  phone,
                                  style: FontHeading.body.copyWith(
                                    color: AppColors.black,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (email != null) ...[
                          const SizedBox(height: 8),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Container(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              height: 50,
                              decoration: BoxDecoration(
                                color:
                                    AppColors.customGray.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.email_outlined,
                                    color: AppColors.main_background_blue,
                                    size: 20,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      email,
                                      style: FontHeading.body.copyWith(
                                        color: AppColors.black,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            height: 50,
                            decoration: BoxDecoration(
                              color: AppColors.main_background_white,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.access_time_outlined,
                                  color: AppColors.main_background_blue,
                                  size: 20,
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  clinic.hours,
                                  style: FontHeading.body.copyWith(
                                    color: AppColors.CustomgrayDark,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 16, 24, 4),
                          child: Text(
                            'Doctors',
                            style: FontHeading.heading3.copyWith(
                              color: AppColors.black,
                            ),
                          ),
                        ),
                        if (state.isLoading && state.doctors.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: Center(child: CircularProgressIndicator()),
                          )
                        else if (state.doctors.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  state.errorMessage?.isNotEmpty == true
                                      ? state.errorMessage!
                                      : 'No doctors listed for this clinic yet. Ask the clinic admin to add a doctor from the staff page.',
                                  style: FontHeading.bodySmall.copyWith(
                                    color: AppColors.CustomgrayDark,
                                  ),
                                ),
                                if (state.errorMessage?.isNotEmpty == true)
                                  TextButton(
                                    onPressed: () => context
                                        .read<ClinicDetailCubit>()
                                        .load(clinic.id, initialClinic: clinic),
                                    child: const Text('Retry'),
                                  ),
                              ],
                            ),
                          )
                        else
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: state.doctors.length,
                            itemBuilder: (context, index) {
                              return _DoctorCard(doctor: state.doctors[index]);
                            },
                          ),
                        const SizedBox(height: 150),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _DoctorCard extends StatelessWidget {
  const _DoctorCard({required this.doctor});

  final Doctor doctor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        height: 80,
        decoration: BoxDecoration(
          color: AppColors.customGray.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            AppNetworkImage.doctor(
              imageUrl: doctor.imageUrl,
              width: 62,
              height: 62,
              borderRadius: BorderRadius.circular(8),
            ),
            const SizedBox(width: 14),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    doctor.name,
                    style: FontHeading.heading4.copyWith(color: Colors.black),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${doctor.experience} · ${doctor.specialty}',
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.CustomgrayDark,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
