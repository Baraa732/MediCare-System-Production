import 'package:cms/core/animations/fade_slide_in.dart';
import 'package:cms/core/api/api_exception.dart';
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

/// Clinic booking: doctor → day strip → visible time slots → request.
class BookingFormScreen extends StatefulWidget {
  static const routeName = '/booking-form';
  final Clinic? clinic;

  const BookingFormScreen({super.key, this.clinic});

  @override
  State<BookingFormScreen> createState() => _BookingFormScreenState();
}

class _BookingFormScreenState extends State<BookingFormScreen> {
  static const _careBlue = Color(0xFF0B74FA);
  static const _surface = Color(0xFFF3F7FB);
  static const _ink = Color(0xFF12263A);

  final _reasonController = TextEditingController();

  List<Doctor> _doctors = [];
  bool _loadingDoctors = true;
  String? _doctorsError;
  Doctor? _selectedDoctor;

  late DateTime _selectedDate;
  late final List<DateTime> _dayOptions;

  List<DateTime> _slots = [];
  bool _loadingSlots = false;
  String? _slotsError;
  DateTime? _selectedSlot;

  String _visitType = 'New visit';
  final _visitTypes = const ['New visit', 'Follow-up', 'Consultation'];

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    _dayOptions = List.generate(14, (i) => start.add(Duration(days: i + 1)));
    _selectedDate = _dayOptions.first;
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
        } else {
          _selectedDoctor = doctors.first;
        }
      });
      if (_selectedDoctor != null) await _loadSlots();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingDoctors = false;
        _doctorsError = e is ApiException
            ? e.message
            : 'Could not load doctors. Check your connection and try again.';
      });
    }
  }

  Future<void> _loadSlots() async {
    final clinicId = widget.clinic?.id;
    final doctor = _selectedDoctor;
    if (clinicId == null || doctor == null || doctor.id.isEmpty) return;

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
        _slotsError = slots.isEmpty
            ? 'No open times on this day. Pick another date.'
            : null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingSlots = false;
        _slotsError = e is ApiException
            ? e.message
            : 'Could not load available times.';
      });
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
      _snack('Select an available time.');
      return;
    }

    final reason = [
      _visitType,
      _reasonController.text.trim(),
    ].where((s) => s.isNotEmpty).join(' · ');

    setState(() => _submitting = true);
    try {
      final cubit = context.read<BookingCubit>();
      final ok = await cubit.bookAppointment(
        clinicId: clinic.id,
        doctorId: doctor.id,
        scheduledAt: slot,
        reason: reason,
      );
      if (!mounted) return;
      setState(() => _submitting = false);
      if (!mounted) return;

      if (ok) {
        Navigator.pushReplacementNamed(
          context,
          BookingSuccessScreen.routeName,
        );
      } else {
        _snack(cubit.state.errorMessage ?? 'Booking failed. Please try again.');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _snack(e.toString().contains('BookingCubit')
          ? 'Booking is unavailable. Please reopen this screen.'
          : 'Booking failed. Please try again.');
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  List<DateTime> get _morningSlots =>
      _slots.where((s) => s.hour < 12).toList();
  List<DateTime> get _afternoonSlots =>
      _slots.where((s) => s.hour >= 12 && s.hour < 17).toList();
  List<DateTime> get _eveningSlots =>
      _slots.where((s) => s.hour >= 17).toList();

  @override
  Widget build(BuildContext context) {
    final clinic = widget.clinic;
    final topPad = MediaQuery.paddingOf(context).top;

    return BlocProvider(
      create: (_) => getIt<BookingCubit>(),
      child: Builder(
        builder: (context) {
          return Scaffold(
            backgroundColor: _surface,
            body: Column(
              children: [
                _header(context, topPad),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                    children: [
                      _clinicBanner(clinic),
                      const SizedBox(height: 18),
                      _stepTitle(1, 'Choose your doctor'),
                      const SizedBox(height: 10),
                      _doctorPicker(),
                      const SizedBox(height: 22),
                      _stepTitle(2, 'Pick a day'),
                      const SizedBox(height: 10),
                      _dayStrip(),
                      const SizedBox(height: 22),
                      _stepTitle(3, 'Available times'),
                      const SizedBox(height: 10),
                      _timesPanel(),
                      const SizedBox(height: 22),
                      _stepTitle(4, 'Visit details'),
                      const SizedBox(height: 10),
                      _visitDetailsCard(),
                      const SizedBox(height: 88),
                    ],
                  ),
                ),
                _bottomBar(context),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _header(BuildContext context, double topPad) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, topPad + 10, 16, 18),
      decoration: const BoxDecoration(
        color: _careBlue,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(22),
          bottomRight: Radius.circular(22),
        ),
      ),
      child: Row(
        children: [
          Material(
            color: Colors.white.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(20),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => Navigator.pop(context),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.arrow_back_rounded, size: 18, color: _ink),
                    SizedBox(width: 4),
                    Text('Back', style: TextStyle(color: _ink, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Book a visit',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const Icon(Icons.medical_services_outlined, color: Colors.white70),
        ],
      ),
    );
  }

  Widget _stepTitle(int step, String title) {
    return Row(
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _careBlue.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            '$step',
            style: const TextStyle(
              color: _careBlue,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: FontHeading.heading4.copyWith(color: _ink, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _clinicBanner(Clinic? clinic) {
    final name = clinic?.name.isNotEmpty == true ? clinic!.name : 'Clinic';
    final location = [
      clinic?.city,
      clinic?.governorate,
    ].where((p) => p != null && p.trim().isNotEmpty).join(', ');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2EAF2)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: clinic?.imageUrl.isNotEmpty == true
                ? AppNetworkImage(
                    imageUrl: clinic!.imageUrl,
                    width: 58,
                    height: 58,
                    borderRadius: BorderRadius.circular(12),
                    placeholderIcon: Icons.local_hospital,
                  )
                : Image.asset(
                    Assets.assetsImagesReception,
                    width: 58,
                    height: 58,
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
                    color: _ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (location.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.place_outlined, size: 14, color: _careBlue),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          location,
                          style: FontHeading.bodySmall.copyWith(color: AppColors.CustomgrayDark),
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
    );
  }

  Widget _doctorPicker() {
    if (_loadingDoctors) {
      return const _Panel(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: CircularProgressIndicator(color: _careBlue),
          ),
        ),
      );
    }
    if (_doctorsError != null && _doctors.isEmpty) {
      return _Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_doctorsError!, style: FontHeading.body.copyWith(color: _ink)),
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
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () async {
                setState(() => _selectedDoctor = doctor);
                await _loadSlots();
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: selected ? _careBlue : const Color(0xFFE2EAF2),
                    width: selected ? 1.8 : 1,
                  ),
                  color: selected ? _careBlue.withValues(alpha: 0.06) : Colors.white,
                ),
                child: Row(
                  children: [
                    AppNetworkImage(
                      imageUrl: doctor.imageUrl,
                      width: 52,
                      height: 52,
                      borderRadius: BorderRadius.circular(12),
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
                              fontWeight: FontWeight.w700,
                              color: _ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            doctor.specialty,
                            style: FontHeading.bodySmall.copyWith(color: _careBlue),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      selected ? Icons.check_circle : Icons.circle_outlined,
                      color: selected ? _careBlue : AppColors.customGray,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _dayStrip() {
    final enabled = _selectedDoctor != null;
    return SizedBox(
      height: 84,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _dayOptions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final day = _dayOptions[index];
          final selected = day.year == _selectedDate.year &&
              day.month == _selectedDate.month &&
              day.day == _selectedDate.day;
          return Opacity(
            opacity: enabled ? 1 : 0.45,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: !enabled
                    ? null
                    : () async {
                        setState(() => _selectedDate = day);
                        await _loadSlots();
                      },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 68,
                  decoration: BoxDecoration(
                    color: selected ? _careBlue : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected ? _careBlue : const Color(0xFFE2EAF2),
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        DateFormat('EEE').format(day),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: selected ? Colors.white70 : AppColors.CustomgrayDark,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${day.day}',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: selected ? Colors.white : _ink,
                        ),
                      ),
                      Text(
                        DateFormat('MMM').format(day),
                        style: TextStyle(
                          fontSize: 11,
                          color: selected ? Colors.white70 : AppColors.CustomgrayDark,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _timesPanel() {
    final slotsKey = Object.hash(
      _selectedDoctor?.id,
      _selectedDate.millisecondsSinceEpoch,
      _loadingSlots,
      _slots.length,
      _slotsError,
    );
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 18, color: _careBlue),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _selectedDoctor == null
                      ? 'Select a doctor to see open times'
                      : DateFormat('EEEE, d MMM').format(_selectedDate),
                  style: FontHeading.body.copyWith(
                    color: _ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (_selectedDoctor != null)
                IconButton(
                  tooltip: 'Refresh times',
                  onPressed: _loadingSlots ? null : _loadSlots,
                  icon: const Icon(Icons.refresh_rounded, color: _careBlue),
                ),
            ],
          ),
          const SizedBox(height: 12),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            child: KeyedSubtree(
              key: ValueKey(slotsKey),
              child: _selectedDoctor == null
                  ? _hintBox(
                      'Choose a doctor above to load available appointment times.',
                    )
                  : _loadingSlots
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: 28),
                          child: Center(
                            child: CircularProgressIndicator(color: _careBlue),
                          ),
                        )
                      : _slotsError != null
                          ? _hintBox(_slotsError!, isError: true)
                          : FadeSlideIn(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (_morningSlots.isNotEmpty) ...[
                                    _periodLabel('Morning'),
                                    const SizedBox(height: 8),
                                    _slotWrap(_morningSlots),
                                    const SizedBox(height: 14),
                                  ],
                                  if (_afternoonSlots.isNotEmpty) ...[
                                    _periodLabel('Afternoon'),
                                    const SizedBox(height: 8),
                                    _slotWrap(_afternoonSlots),
                                    const SizedBox(height: 14),
                                  ],
                                  if (_eveningSlots.isNotEmpty) ...[
                                    _periodLabel('Evening'),
                                    const SizedBox(height: 8),
                                    _slotWrap(_eveningSlots),
                                  ],
                                ],
                              ),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _periodLabel(String text) {
    return Text(
      text,
      style: FontHeading.bodySmall.copyWith(
        color: AppColors.CustomgrayDark,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
      ),
    );
  }

  Widget _slotWrap(List<DateTime> slots) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: slots.map((slot) {
        final selected = _selectedSlot == slot;
        final label = DateFormat('h:mm a').format(slot);
        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _selectedSlot = slot),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              constraints: const BoxConstraints(minWidth: 92),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: selected ? _careBlue : const Color(0xFFECF5FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: selected ? _careBlue : const Color(0xFFB7D4F8),
                  width: 1.4,
                ),
              ),
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: selected ? Colors.white : _ink,
                  fontWeight: FontWeight.w700,
                  fontSize: 13.5,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _hintBox(String text, {bool isError = false}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isError ? const Color(0xFFFFF1F0) : const Color(0xFFECF5FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isError ? const Color(0xFFF3C1BC) : const Color(0xFFB7D4F8),
        ),
      ),
      child: Text(
        text,
        style: FontHeading.body.copyWith(
          color: isError ? const Color(0xFF8A2B22) : _ink,
        ),
      ),
    );
  }

  Widget _visitDetailsCard() {
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Visit type',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.CustomgrayDark,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _visitTypes.map((type) {
              final selected = _visitType == type;
              return ChoiceChip(
                label: Text(type),
                selected: selected,
                onSelected: (_) => setState(() => _visitType = type),
                selectedColor: _careBlue,
                backgroundColor: const Color(0xFFECF5FF),
                side: BorderSide(
                  color: selected ? _careBlue : const Color(0xFFB7D4F8),
                ),
                labelStyle: TextStyle(
                  color: selected ? Colors.white : _ink,
                  fontWeight: FontWeight.w600,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Text(
            'Reason (optional)',
            style: FontHeading.bodySmall.copyWith(
              color: AppColors.CustomgrayDark,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _reasonController,
            maxLines: 3,
            maxLength: 200,
            style: FontHeading.body.copyWith(color: _ink),
            decoration: InputDecoration(
              hintText: 'Briefly describe why you need this visit…',
              filled: true,
              fillColor: const Color(0xFFF8FBFE),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2EAF2)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2EAF2)),
              ),
            ),
          ),
          if (_selectedSlot != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFECF5FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Selected: ${DateFormat('EEE d MMM · h:mm a').format(_selectedSlot!)}'
                '${_selectedDoctor != null ? ' with ${_selectedDoctor!.name}' : ''}',
                style: FontHeading.bodySmall.copyWith(
                  color: _careBlue,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _bottomBar(BuildContext context) {
    final canSubmit = !_submitting &&
        _selectedDoctor != null &&
        _selectedSlot != null &&
        widget.clinic?.id.isNotEmpty == true;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: canSubmit ? () => _submit(context) : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: _careBlue,
            disabledBackgroundColor: const Color(0xFFB7D4F8),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 15),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: _submitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                )
              : const Text(
                  'Request appointment',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2EAF2)),
      ),
      child: child,
    );
  }
}
