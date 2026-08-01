import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/api/services/schedule_api_service.dart';
import 'package:cms/core/constants/assets.dart';
import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/entities/doctor.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/app_network_image.dart';
import 'package:cms/features/booking/presentation/cubit/booking_cubit.dart';
import 'package:cms/features/booking/presentation/screens/booking_success_screen.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

/// Patient booking flow (clinic → doctor → date → available slot → confirm).
/// Aligned with common clinic apps: keep fields few, show real availability.
class BookingFormScreen extends StatefulWidget {
  static const routeName = '/booking-form';
  final Clinic? clinic;

  const BookingFormScreen({super.key, this.clinic});

  @override
  State<BookingFormScreen> createState() => _BookingFormScreenState();
}

class _BookingFormScreenState extends State<BookingFormScreen> {
  final _reasonController = TextEditingController();

  List<Doctor> _doctors = [];
  bool _loadingDoctors = true;
  String? _doctorsError;
  Doctor? _selectedDoctor;

  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  List<DateTime> _slots = [];
  bool _loadingSlots = false;
  String? _slotsError;
  DateTime? _selectedSlot;

  String? _visitType;
  final _visitTypes = const [
    'New visit',
    'Follow-up',
    'Consultation',
  ];

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadDoctors();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadDoctors() async {
    final clinicId = widget.clinic?.id;
    if (clinicId == null || clinicId.isEmpty) {
      setState(() {
        _loadingDoctors = false;
        _doctorsError = 'Open booking from a clinic to see its doctors.';
      });
      return;
    }

    setState(() {
      _loadingDoctors = true;
      _doctorsError = null;
    });

    try {
      final doctors = await getIt<ClinicApiService>().getClinicDoctors(clinicId);
      if (!mounted) return;
      setState(() {
        _doctors = doctors;
        _loadingDoctors = false;
        if (doctors.isEmpty) {
          _doctorsError = 'No doctors listed for this clinic yet.';
        } else if (doctors.length == 1) {
          _selectedDoctor = doctors.first;
        }
      });
      if (_selectedDoctor != null) {
        await _loadSlots();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingDoctors = false;
        _doctorsError = 'Could not load doctors. Check your connection and try again.';
      });
    }
  }

  Future<void> _loadSlots() async {
    final clinicId = widget.clinic?.id;
    final doctor = _selectedDoctor;
    if (clinicId == null || doctor == null) return;

    setState(() {
      _loadingSlots = true;
      _slotsError = null;
      _slots = [];
      _selectedSlot = null;
    });

    try {
      final slots = await getIt<ScheduleApiService>().getAvailableSlots(
        clinicId: clinicId,
        doctorId: doctor.id,
        date: _selectedDate,
      );
      if (!mounted) return;
      setState(() {
        _slots = slots;
        _loadingSlots = false;
        if (slots.isEmpty) {
          _slotsError = 'No open slots on this day. Try another date.';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingSlots = false;
        _slotsError = 'Could not load available times.';
      });
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate.isBefore(now)
          ? now.add(const Duration(days: 1))
          : _selectedDate,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked == null) return;
    setState(() => _selectedDate = picked);
    if (_selectedDoctor != null) {
      await _loadSlots();
    }
  }

  Future<void> _submit(BuildContext context) async {
    final clinic = widget.clinic;
    final doctor = _selectedDoctor;
    final slot = _selectedSlot;

    if (clinic == null || clinic.id.isEmpty) {
      _snack('Open booking from a clinic first.');
      return;
    }
    if (doctor == null) {
      _snack('Select a doctor.');
      return;
    }
    if (slot == null) {
      _snack('Select an available time slot.');
      return;
    }

    final reasonParts = [
      if (_visitType != null) _visitType!,
      _reasonController.text.trim(),
    ].where((s) => s.isNotEmpty).join(' · ');

    setState(() => _submitting = true);
    final cubit = context.read<BookingCubit>();
    final ok = await cubit.bookAppointment(
      clinicId: clinic.id,
      doctorId: doctor.id,
      scheduledAt: slot,
      reason: reasonParts.isNotEmpty ? reasonParts : null,
    );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (!mounted) return;
    if (ok) {
      Navigator.pushNamed(context, BookingSuccessScreen.routeName);
    } else {
      _snack(cubit.state.errorMessage ?? 'Booking failed. Please try again.');
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final clinic = widget.clinic;

    return BlocProvider(
      create: (_) => getIt<BookingCubit>(),
      child: Scaffold(
        backgroundColor: AppColors.main_background_white,
        body: Column(
          children: [
            _header(context),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('Clinic'),
                    const SizedBox(height: 8),
                    _clinicCard(clinic),
                    const SizedBox(height: 24),
                    _sectionLabel('Doctor'),
                    const SizedBox(height: 8),
                    _doctorPicker(),
                    const SizedBox(height: 24),
                    _sectionLabel('Date'),
                    const SizedBox(height: 8),
                    _dateButton(),
                    const SizedBox(height: 24),
                    _sectionLabel('Available times'),
                    const SizedBox(height: 8),
                    _slotsGrid(),
                    const SizedBox(height: 24),
                    _sectionLabel('Visit type'),
                    const SizedBox(height: 8),
                    _visitTypeField(),
                    const SizedBox(height: 24),
                    _sectionLabel('Reason for visit (optional)'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _reasonController,
                      maxLines: 3,
                      maxLength: 200,
                      decoration: InputDecoration(
                        hintText: 'e.g. chest pain follow-up, annual checkup…',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ),
            _bottomBar(context),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: AppColors.main_background_blue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 20),
      child: Row(
        children: [
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => Navigator.pop(context),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.arrow_back, color: Colors.black, size: 16),
                    SizedBox(width: 4),
                    Text('Back', style: TextStyle(color: Colors.black)),
                  ],
                ),
              ),
            ),
          ),
          const Spacer(),
          Text(
            'Book appointment',
            style: FontHeading.heading1.copyWith(color: Colors.white, fontSize: 18),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: FontHeading.heading4.copyWith(color: Colors.black),
    );
  }

  Widget _clinicCard(Clinic? clinic) {
    final name = clinic?.name.isNotEmpty == true ? clinic!.name : 'Clinic';
    final location = [
      clinic?.address,
      clinic?.city,
      clinic?.governorate,
    ].where((p) => p != null && p.trim().isNotEmpty).join(', ');

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.lightGray,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: clinic?.imageUrl.isNotEmpty == true
                ? AppNetworkImage(
                    imageUrl: clinic!.imageUrl,
                    width: 56,
                    height: 56,
                    borderRadius: BorderRadius.circular(8),
                    placeholderIcon: Icons.local_hospital,
                  )
                : Image.asset(
                    Assets.assetsImagesReception,
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: FontHeading.body.copyWith(
                    color: Colors.black,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (location.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    location,
                    style: FontHeading.bodySmall.copyWith(
                      color: AppColors.CustomgrayDark,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _doctorPicker() {
    if (_loadingDoctors) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_doctorsError != null && _doctors.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.lightGray,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_doctorsError!, style: FontHeading.body),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: _loadDoctors,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _doctors.map((doctor) {
        final selected = _selectedDoctor?.id == doctor.id;
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: selected
                ? AppColors.main_background_blue.withValues(alpha: 0.08)
                : AppColors.lightGray,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                setState(() => _selectedDoctor = doctor);
                await _loadSlots();
              },
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    AppNetworkImage(
                      imageUrl: doctor.imageUrl,
                      width: 52,
                      height: 52,
                      borderRadius: BorderRadius.circular(10),
                      placeholderIcon: Icons.person,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctor.name,
                            style: FontHeading.body.copyWith(
                              fontWeight: FontWeight.w600,
                              color: Colors.black,
                            ),
                          ),
                          Text(
                            '${doctor.specialty} · ${doctor.experience}',
                            style: FontHeading.bodySmall.copyWith(
                              color: AppColors.CustomgrayDark,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (selected)
                      const Icon(Icons.check_circle, color: AppColors.main_background_blue),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _dateButton() {
    return OutlinedButton.icon(
      onPressed: _selectedDoctor == null ? null : _pickDate,
      icon: const Icon(Icons.calendar_month_outlined),
      label: Text(DateFormat('EEE, d MMM yyyy').format(_selectedDate)),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(double.infinity, 48),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _slotsGrid() {
    if (_selectedDoctor == null) {
      return Text(
        'Select a doctor to see open times.',
        style: FontHeading.bodySmall.copyWith(color: AppColors.CustomgrayDark),
      );
    }
    if (_loadingSlots) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_slotsError != null) {
      return Text(_slotsError!, style: FontHeading.body);
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _slots.map((slot) {
        final selected = _selectedSlot == slot;
        final label = DateFormat('h:mm a').format(slot);
        return ChoiceChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => setState(() => _selectedSlot = slot),
          selectedColor: AppColors.main_background_blue,
          labelStyle: TextStyle(
            color: selected ? Colors.white : Colors.black,
            fontWeight: FontWeight.w600,
          ),
        );
      }).toList(),
    );
  }

  Widget _visitTypeField() {
    return DropdownButtonFormField<String>(
      // ignore: deprecated_member_use
      value: _visitType,
      isExpanded: true,
      decoration: InputDecoration(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      hint: const Text('Select visit type'),
      items: _visitTypes
          .map((t) => DropdownMenuItem(value: t, child: Text(t)))
          .toList(),
      onChanged: (v) => setState(() => _visitType = v),
    );
  }

  Widget _bottomBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade200,
            blurRadius: 8,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _submitting ? null : () => _submit(context),
          icon: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.calendar_today, color: Colors.white, size: 20),
          label: Text(
            _submitting ? 'Submitting…' : 'Request appointment',
            style: FontHeading.button,
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.main_background_blue,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
    );
  }
}
