import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/safe_google_map.dart';
import 'package:cms/features/map/presentation/screens/map_test_screen.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class AppointmentDetailScreen extends StatelessWidget {
  static const routeName = '/appointment-detail';
  final Appointment appointment;

  const AppointmentDetailScreen({super.key, required this.appointment});

  // Clinic location (hardcoded for demo – replace with real data)
  final LatLng _clinicLocation = const LatLng(33.5138, 36.2765);

  @override
  Widget build(BuildContext context) {
    final double offset =
        (appointment.status.toLowerCase().contains('cancelled') ||
            appointment.status.toLowerCase().contains('rescheduled'))
        ? -20
        : -40;
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // ============================================================
            //  SCROLLABLE CONTENT (fills remaining space)
            // ============================================================
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ============================================================
                    //  UPPER SHEET (Image + Status Badge)
                    // ============================================================
                    Stack(
                      children: [
                        // ---- Image (200 height) ----
                        Container(
                          height: 200,
                          width: double.infinity,
                          decoration: const BoxDecoration(
                            image: DecorationImage(
                              image: AssetImage(Assets.assetsImagesReception),
                              fit: BoxFit.cover,
                            ),
                            borderRadius: BorderRadius.only(
                              bottomLeft: Radius.circular(16),
                              bottomRight: Radius.circular(16),
                            ),
                          ),
                        ),
                        // ---- Status Badge (Top Right) ----
                        // ---- Status Badge (Top Right) ----
                        Positioned(
                          top: 30,
                          right: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 2.5,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.main_background_white,
                              borderRadius: BorderRadius.circular(117),
                            ),
                            child: Text(
                              appointment.status,
                              style: FontHeading.bodySmall.copyWith(
                                color: _getStatusColor(
                                  appointment.status,
                                ), // ✅ Dynamic color
                              ),
                            ),
                          ),
                        ),
                        // ---- Back Button (Top Left - NO PADDING) ----
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
                                  Icon(
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
                      ],
                    ),
                    // ============================================================
                    //  DOCTOR INFO CARD (Overlapping the sheet bottom)
                    // ============================================================
                    Transform.translate(
                      offset: Offset(0, offset),
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        height: 80,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.grey.shade200,
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // ---- Doctor Photo (SQUARE) ----
                            SizedBox(
                              width: 62,
                              height: 62,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(
                                  8,
                                ), // Keeps it perfectly square
                                child: Image.asset(
                                  Assets.assetsImagesDoctorFolanAlfolani,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            // ---- Doctor Name + Date/Time ----
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    appointment.doctorName,
                                    style: FontHeading.heading4.copyWith(
                                      color: Colors.black,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 8),
                                  if (appointment.status.toLowerCase().contains(
                                    'rescheduled',
                                  )) ...[
                                    // ---- Old Time (struck through) ----
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.calendar_today_outlined,
                                          color: AppColors.black,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          '7 / 7 / 2026',
                                          style: FontHeading.bodySmall.copyWith(
                                            color: AppColors.black,
                                            decoration:
                                                TextDecoration.lineThrough,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Icon(
                                          Icons.access_time_outlined,
                                          color: AppColors.black,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          '9:15 AM',
                                          style: FontHeading.bodySmall.copyWith(
                                            color: AppColors.black,
                                            decoration:
                                                TextDecoration.lineThrough,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ] else ...[
                                    // Normal date/time (no strikethrough)
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.calendar_today_outlined,
                                          color: AppColors.black,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          appointment.date,
                                          style: FontHeading.bodySmall.copyWith(
                                            color: AppColors.black,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Icon(
                                          Icons.access_time_outlined,
                                          color: AppColors.black,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          appointment.time,
                                          style: FontHeading.bodySmall.copyWith(
                                            color: AppColors.black,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // ============================================================
                    //  RESCHEDULED APPOINTMENT CARD (only if rescheduled)
                    // ============================================================
                    if (appointment.status.toLowerCase().contains(
                      'rescheduled',
                    )) ...[
                      _buildRescheduledCard(),
                    ],
                    // ============================================================
                    //  CANCELED APPOINTMENT CARD (only if canceled)
                    // ============================================================
                    if (appointment.status.toLowerCase().contains(
                          'cancelled',
                        ) ||
                        appointment.status.toLowerCase().contains(
                          'canceled',
                        )) ...[
                      _buildCanceledCard(),
                    ],

                    // ============================================================
                    //  CLINIC NAME + LOCATION + MAP BUTTON
                    // ============================================================
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  appointment.clinicName,
                                  style: FontHeading.heading3.copyWith(
                                    color: Colors.black,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.location_on_outlined,
                                      color: AppColors.main_background_blue,
                                      size: 16,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        'Damascus, Al-Mazzeh', // Replace with real location
                                        style: FontHeading.bodySmall.copyWith(
                                          color: AppColors.CustomgrayDark,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          // ---- Map Button ----
                          Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.main_background_blue,
                                shape: BoxShape.circle,
                              ),
                              child: IconButton(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => MapTestScreen(
                                        clinic:
                                            null, // Pass clinic if available
                                      ),
                                    ),
                                  );
                                },
                                icon: Icon(
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
                    const SizedBox(height: 12),

                    // ============================================================
                    //  MINI MAP (Static, no interaction)
                    // ============================================================
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: SizedBox(
                          height: 175,
                          width: double.infinity,
                          child: SafeGoogleMap(
                            initialCameraPosition: CameraPosition(
                              target: _clinicLocation,
                              zoom: 15.0,
                            ),
                            markers: {
                              Marker(
                                markerId: const MarkerId('clinic'),
                                position: _clinicLocation,
                                infoWindow: const InfoWindow(
                                  title: 'Clinic Location',
                                ),
                                icon: BitmapDescriptor.defaultMarkerWithHue(
                                  BitmapDescriptor.hueBlue,
                                ),
                              ),
                            },
                            myLocationEnabled: false,
                            zoomControlsEnabled: false,
                            scrollGesturesEnabled: false,
                            rotateGesturesEnabled: false,
                            tiltGesturesEnabled: false,
                            zoomGesturesEnabled: false,
                            mapType: MapType.normal,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ============================================================
                    //  DETAIL ROWS
                    // ============================================================
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: [
                          _buildDetailRow(
                            label: 'Visit type:',
                            value: appointment.followUp ?? 'Follow-up visit',
                            valueColor: AppColors.main_background_blue,
                          ),
                          const SizedBox(height: 16),
                          _buildDetailRow(
                            label: 'Complexity:',
                            value: 'Complex',
                            valueColor: AppColors.yellowDark,
                          ),
                          if (!((appointment.status.toLowerCase().contains(
                                    'cancelled',
                                  ) ||
                                  appointment.status.toLowerCase().contains(
                                    'canceled',
                                  )) ||
                              appointment.status.toLowerCase().contains(
                                'rescheduled',
                              )))
                            const SizedBox(height: 16),
                          if (!(appointment.status.toLowerCase().contains(
                                'cancelled',
                              ) ||
                              appointment.status.toLowerCase().contains(
                                'canceled',
                              ) ||
                              appointment.status.toLowerCase().contains(
                                'rescheduled',
                              )))
                            _buildDetailRow(
                              label: 'Status:',
                              value: appointment.status,
                              valueColor: _getStatusColor(
                                appointment.status,
                              ), // ✅ Dynamic color
                            ),
                        ],
                      ),
                    ),
                    appointment.status == 'Pending'
                        ? Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 4,
                            ),
                            child: Text(
                              "Your appointment request is being reviewed by the clinic.",
                              style: FontHeading.caption.copyWith(
                                color: AppColors.customGray,
                              ),
                            ),
                          )
                        : Text(""),
                    const SizedBox(
                      height: 20,
                    ), // extra padding at the bottom of scroll
                  ],
                ),
              ),
            ),
            // ============================================================
            //  BOTTOM BUTTONS
            // ============================================================
            Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 50),
              color: Colors.transparent,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ---- Conditional Buttons ----
                  if (appointment.status.toLowerCase().contains('cancelled') ||
                      appointment.status.toLowerCase().contains(
                        'canceled',
                      )) ...[
                    // ---- Book new appointment (Cancelled) ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Requesting new appointment'),
                            ),
                          );
                        },
                        icon: const Icon(
                          Icons.calendar_today,
                          color: Colors.white,
                        ),
                        label: const Text(
                          'Request new appointment',
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
                  ] else if (appointment.status.toLowerCase().contains(
                        'done',
                      ) ||
                      appointment.status.toLowerCase().contains(
                        'completed',
                      )) ...[
                    // ---- Book new appointment (Done) ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Open a clinic from Search or Home to book a new appointment.',
                              ),
                            ),
                          );
                        },
                        icon: const Icon(
                          Icons.calendar_today,
                          color: Colors.white,
                        ),
                        label: const Text(
                          'Book new appointment',
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
                    const SizedBox(height: 12),
                    // ---- Rate this appointment ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Rate this appointment'),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.main_background_blue
                              .withValues(alpha: 0.2),
                          foregroundColor: AppColors.main_background_blue,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          shadowColor: Colors.transparent,
                        ),
                        child: Text(
                          'Rate this appointment',
                          style: FontHeading.button.copyWith(
                            color: AppColors.main_background_blue,
                          ),
                        ),
                      ),
                    ),
                  ] else if (appointment.status.toLowerCase().contains(
                    'rescheduled',
                  )) ...[
                    // ---- Accept new appointment ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Accepted new appointment'),
                            ),
                          );
                        },
                        icon: const Icon(
                          Icons.calendar_today,
                          color: Colors.white,
                          size: 20,
                        ),
                        label: const Text(
                          'Accept new appointment',
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
                    const SizedBox(height: 12),
                    // ---- Request another time ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Open the clinic page to request another time.',
                              ),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.main_background_blue
                              .withValues(alpha: 0.1),
                          foregroundColor: AppColors.main_background_blue,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          shadowColor: Colors.transparent,
                        ),
                        child: Text(
                          'Request another time',
                          style: FontHeading.button.copyWith(
                            color: AppColors.main_background_blue,
                          ),
                        ),
                      ),
                    ),
                  ] else ...[
                    // ---- Add to Calendar (default) ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed:
                            appointment.status.toLowerCase().contains('pending')
                            ? null
                            : () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Added to calendar'),
                                  ),
                                );
                              },
                        icon: const Icon(
                          Icons.calendar_today,
                          color: Colors.white,
                        ),
                        label: const Text(
                          'Add to calendar',
                          style: FontHeading.button,
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.main_background_blue,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          disabledBackgroundColor: AppColors
                              .main_background_blue
                              .withOpacity(0.2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // ---- Cancel appointment ----
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => _showCancelDialog(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red.shade50,
                          foregroundColor: Colors.red,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'Cancel appointment',
                          style: FontHeading.button.copyWith(color: Colors.red),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---- Detail Row (Label: Value) ----
  Widget _buildDetailRow({
    required String label,
    required String value,
    Color valueColor = Colors.black,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: FontHeading.body.copyWith(color: AppColors.CustomgrayDark),
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2.5),
          decoration: BoxDecoration(
            color: valueColor.withOpacity(0.05),
            borderRadius: BorderRadius.circular(117),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2.5),
            child: Text(
              value,
              style: FontHeading.bodySmall.copyWith(color: valueColor),
            ),
          ),
        ),
      ],
    );
  }

  // ---- Cancel Dialog ----
  void _showCancelDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Appointment'),
        content: const Text(
          'Are you sure you want to cancel this appointment?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Appointment cancelled'),
                  backgroundColor: AppColors.red,
                ),
              );
            },
            child: const Text(
              'Yes, Cancel',
              style: TextStyle(color: AppColors.red),
            ),
          ),
        ],
      ),
    );
  }
}

Color _getStatusColor(String status) {
  final lowerStatus = status.toLowerCase();
  if (lowerStatus.contains('confirmed') || lowerStatus.contains('done')) {
    return AppColors.green; // Green for confirmed / done
  } else if (lowerStatus.contains('pending') ||
      lowerStatus.contains('rescheduled')) {
    return AppColors.red; // Orange for pending / rescheduled
  } else if (lowerStatus.contains('rescheduled')) {
    return AppColors.orange; // Orange for rescheduled
  } else if (lowerStatus.contains('cancelled') ||
      lowerStatus.contains('canceled')) {
    return AppColors.red; // Red for cancelled
  } else {
    return AppColors.customGray; // Default fallback
  }
}

Widget _buildCanceledCard() {
  return Container(
    height: 80, // ✅ increased to fit larger avatar
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: AppColors.alertRedBackground,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.center, // ✅ vertically center
      children: [
        // ---- Avatar (Larger) ----
        CircleAvatar(
          radius: 28, // ✅ bigger than before (was 46? that was too big)
          backgroundColor: AppColors.red.withOpacity(0.15),
          child: const Icon(Icons.close, color: AppColors.red, size: 24),
        ),
        const SizedBox(width: 13),
        // ---- Text Column ----
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Appointment cancelled',
                style: FontHeading.caption.copyWith(
                  color: AppColors.alertRedSmallText,
                ),
              ),
              Text(
                'Doctor not available',
                style: FontHeading.bodySmall.copyWith(
                  color: AppColors.alertRedBigText,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

Widget _buildRescheduledCard() {
  return Container(
    height: 112,
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      color: AppColors.orange.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Column(
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: AppColors.orange.withValues(alpha: 0.1),
              child: const Icon(Icons.close, color: AppColors.orange, size: 24),
            ),
            Spacer(),
          ],
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Appointment Rescheduled',
                style: FontHeading.caption.copyWith(
                  color: AppColors.orangeSmallText,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Your appointment has rescheduled From \n 7 / 7 / 2026 at 9:15 AM\n to 7 / 7 / 2026 at 9:30 AM',
                style: FontHeading.bodySmall.copyWith(
                  color: AppColors.orangeBigText,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
