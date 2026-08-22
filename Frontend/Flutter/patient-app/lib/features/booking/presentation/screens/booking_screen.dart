import 'package:cms/core/animations/app_page_route.dart';
import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/appointment.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/app_avatar.dart';
import 'package:cms/core/widgets/app_network_image.dart';
import 'package:cms/features/appointment/presentation/screens/appointment_detail_screen.dart';
import 'package:cms/features/booking/presentation/cubit/booking_cubit.dart';
import 'package:cms/features/booking/presentation/cubit/booking_state.dart';
import 'package:cms/features/emr/presentation/screens/emr_screen.dart';
import 'package:cms/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

class BookingScreen extends StatelessWidget {
  static const routeName = '/booking';

  const BookingScreen({super.key});

  final List<String> statuses = const [
    'All',
    'Confirmed',
    'Pending',
    'Cancelled',
    'Done',
    'Rescheduled',
  ];

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => getIt<BookingCubit>()..loadAppointments(),
      child: Scaffold(
        backgroundColor: AppColors.main_background_white,
        body: Column(
          children: [
            _buildBlueHeader(context),
            const SizedBox(height: 16),
            _buildStatusFilter(context),
            const SizedBox(height: 16),
            Expanded(
              child: BlocBuilder<BookingCubit, BookingState>(
                builder: (context, state) {
                  if (state.isLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (state.errorMessage != null &&
                      state.allAppointments.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              state.errorMessage!,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 12),
                            TextButton(
                              onPressed: () => context
                                  .read<BookingCubit>()
                                  .loadAppointments(),
                              child: const Text('Try again'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  if (state.filteredAppointments.isEmpty) {
                    return Center(
                      child: Text(
                        state.selectedStatus == 'All'
                            ? 'No appointments yet. Book from a clinic.'
                            : 'No appointments with this status',
                      ),
                    );
                  }

                  return FadeSlideIn(
                    child: RefreshIndicator(
                      onRefresh: () =>
                          context.read<BookingCubit>().loadAppointments(),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: state.filteredAppointments.length,
                        itemBuilder: (context, index) {
                          final appointment = state.filteredAppointments[index];
                          return _buildAppointmentCard(context, appointment);
                        },
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---- Blue Header (exactly as you had) ----
  Widget _buildBlueHeader(BuildContext context) {
    return BlocBuilder<BookingCubit, BookingState>(
      builder: (context, state) {
        return RepaintBoundary(
          child: Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.main_background_blue,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(20, 30, 30, 30),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    AppAvatar(
                      imageUrl: state.patientAvatarUrl,
                      radius: 26,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          Navigator.pushNamed(context, EmrScreen.routeName);
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.patientName?.trim().isNotEmpty == true
                                  ? state.patientName!
                                  : 'My appointments',
                              style: FontHeading.heading1.copyWith(
                                fontSize: 18,
                                color: Colors.white,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'View my records',
                              style: FontHeading.bodySmall.copyWith(
                                color: Colors.white70,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      width: 40,
                      height: 40,
                      padding: EdgeInsets.zero,
                      decoration: const BoxDecoration(
                        color: AppColors.main_background_white,
                        borderRadius: BorderRadius.all(Radius.circular(8)),
                      ),
                      child: IconButton(
                        splashColor: Colors.transparent,
                        highlightColor: Colors.transparent,
                        padding: EdgeInsets.zero,
                        onPressed: () {
                          Navigator.pushNamed(
                            context,
                            NotificationsScreen.routeName,
                          );
                        },
                        icon: const Icon(
                          Icons.notifications_outlined,
                          color: AppColors.main_background_blue,
                          size: 28,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ---- Status Filter (Horizontal Scroll) ----
  Widget _buildStatusFilter(BuildContext context) {
    return BlocBuilder<BookingCubit, BookingState>(
      builder: (context, state) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SizedBox(
            height: 48,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: statuses.length,
              itemBuilder: (context, index) {
                final status = statuses[index];
                final bool isSelected = state.selectedStatus == status;
                return GestureDetector(
                  onTap: () {
                    context.read<BookingCubit>().selectStatus(status);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.main_background_blue
                          : AppColors.main_background_blue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(117),
                    ),
                    child: Center(
                      child: Text(
                        status,
                        style: FontHeading.bodySmall.copyWith(
                          color: isSelected
                              ? Colors.white
                              : AppColors.main_background_blue,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  // ---- Appointment Card (keeps your exact style, but with appointment data) ----
  Widget _buildAppointmentCard(BuildContext context, Appointment appointment) {
    return GestureDetector(
      onTap: () async {
        final changed = await Navigator.push<bool>(
          context,
          AppPageRoute(
            builder: (_) => AppointmentDetailScreen(appointment: appointment),
          ),
        );
        if (changed == true && context.mounted) {
          context.read<BookingCubit>().loadAppointments();
        }
      },
      child: Container(
      padding: const EdgeInsets.all(4),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade200,
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ---- Photo (87 x 87) with Status Badge ----
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AppNetworkImage.doctor(
                  imageUrl: appointment.doctorImageUrl,
                  width: 87,
                  height: 87,
                ),
              ),
              // ---- Bookmark Icon (Top Left) ----
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  width: 24,
                  height: 24,
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.all(Radius.circular(4)),
                  ),
                  child: Icon(
                    Icons.bookmark,
                    color: appointment.id.hashCode % 2 == 0
                        ? AppColors.main_background_blue
                        : AppColors.CustomgrayDark,
                    size: 16,
                  ),
                ),
              ),
              // ---- Status Badge (Bottom Right) ----
              Positioned(
                bottom: 2,
                right: 2,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(117),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.grey.shade200,
                        blurRadius: 2,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Text(
                    appointment.status,
                    style: FontHeading.caption.copyWith(
                      color: _getStatusColor(appointment.status),
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          // ---- Text Column ----
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                Text(
                  appointment.clinicName,
                  style: FontHeading.body.copyWith(
                    color: Colors.black,
                    fontSize: 20,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                // ---- Clinic Name ----
                Row(
                  children: [
                    FaIcon(
                      FontAwesomeIcons.userDoctor,
                      color: AppColors.CustomgrayDark,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        appointment.doctorName,
                        style: FontHeading.bodySmall.copyWith(
                          color: AppColors.CustomgrayDark,
                          fontSize: 18,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                // ---- Date & Time ----
                Row(
                  children: [
                    Icon(
                      Icons.access_time_outlined,
                      color: AppColors.CustomgrayDark,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      appointment.date + ' | ' + appointment.time,
                      style: FontHeading.bodySmall.copyWith(
                        color: AppColors.CustomgrayDark,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    );
  }

  // ---- Status Color Helper (unchanged) ----
  Color _getStatusColor(String status) {
    final lowerStatus = status.toLowerCase();
    if (lowerStatus.contains('confirmed') || lowerStatus.contains('done')) {
      return AppColors.green;
    } else if (lowerStatus.contains('pending')) {
      return AppColors.main_background_blue;
    } else if (lowerStatus.contains('rescheduled')) {
      return AppColors.orange;
    } else if (lowerStatus.contains('cancelled') ||
        lowerStatus.contains('canceled')) {
      return AppColors.red;
    } else {
      return AppColors.customGray;
    }
  }
}
