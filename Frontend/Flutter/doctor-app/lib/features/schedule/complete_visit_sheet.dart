import 'package:flutter/material.dart';

import '../../core/widgets/common_widgets.dart';
import 'models/appointment.dart';

class CompleteVisitSheet extends StatefulWidget {
  const CompleteVisitSheet({
    super.key,
    required this.appointmentTime,
    required this.patient,
    this.onCompleted,
  });

  final String appointmentTime;
  final String patient;
  final ValueChanged<String>? onCompleted;

  @override
  State<CompleteVisitSheet> createState() => _CompleteVisitSheetState();
}

class _CompleteVisitSheetState extends State<CompleteVisitSheet> {
  FollowUp _followUp = FollowUp.no;
  final _weeksCtrl = TextEditingController(text: '0');
  final _notesCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _weeksCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    if (_submitting) return;
    setState(() => _submitting = true);
    var notes = _notesCtrl.text.trim();
    if (_followUp == FollowUp.yes) {
      notes = notes.isEmpty ? 'Follow-up required' : '$notes\nFollow-up required';
    } else if (_followUp == FollowUp.yesIn) {
      final weeks = _weeksCtrl.text.trim();
      final follow =
          'Follow-up requested in ${weeks.isEmpty ? '0' : weeks} week(s)';
      notes = notes.isEmpty ? follow : '$notes\n$follow';
    }
    Navigator.pop(context);
    widget.onCompleted?.call(notes);
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Center(
              child: Text(
                'Complete visit?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1A1B1E),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(
                '${widget.patient} · ${widget.appointmentTime}',
                style: const TextStyle(fontSize: 14, color: Color(0xFF929296)),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Follow-up required?',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Color(0xFF1A1B1E),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _followUpBtn('No', FollowUp.no),
                const SizedBox(width: 8),
                _followUpBtn('Yes', FollowUp.yes),
                const SizedBox(width: 8),
                _followUpBtn('Yes, in...', FollowUp.yesIn),
              ],
            ),
            if (_followUp == FollowUp.yesIn) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  SizedBox(
                    width: 80,
                    child: TextField(
                      controller: _weeksCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        border: inputBorder(const Color(0xFFB6B7B9)),
                        enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                        focusedBorder:
                            inputBorder(const Color(0xFF0B74FA), width: 2),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    'Weeks from now',
                    style: TextStyle(fontSize: 14, color: Color(0xFF1A1B1E)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'Noted for the secretary to schedule follow-up',
                style: TextStyle(fontSize: 12, color: Color(0xFF0B74FA)),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                const Text(
                  'Clinical notes',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF1A1B1E),
                  ),
                ),
                const SizedBox(width: 8),
                const Text(
                  '(Optional)',
                  style: TextStyle(fontSize: 14, color: Color(0xFF929296)),
                ),
                const Spacer(),
                ListenableBuilder(
                  listenable: _notesCtrl,
                  builder: (_, __) => Text(
                    '${_notesCtrl.text.length}/200',
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF929296)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _notesCtrl,
              maxLength: 200,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Add any notes...',
                hintStyle: const TextStyle(color: Color(0xFFB6B7B9)),
                counterText: '',
                border: inputBorder(const Color(0xFFB6B7B9)),
                enabledBorder: inputBorder(const Color(0xFFB6B7B9)),
                focusedBorder: inputBorder(const Color(0xFF0B74FA), width: 2),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF0B74FA)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text(
                      'Cancel',
                      style: TextStyle(color: Color(0xFF0B74FA), fontSize: 16),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _complete,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B74FA),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Complete',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _followUpBtn(String label, FollowUp value) {
    final active = _followUp == value;
    return GestureDetector(
      onTap: () => setState(() => _followUp = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF0B74FA) : const Color(0xFFF2F2F2),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: active ? Colors.white : const Color(0xFF1A1B1E),
          ),
        ),
      ),
    );
  }
}
