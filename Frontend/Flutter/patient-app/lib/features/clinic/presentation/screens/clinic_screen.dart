import 'package:cms/core/api/services/clinic_api_service.dart';
import 'package:cms/core/entities/clinic.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:cms/core/widgets/modern_clinic_card.dart';
import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';

/// Standalone clinic list from the live API (SM-provisioned ACTIVE clinics).
class ClinicScreen extends StatefulWidget {
  static const routeName = "/clinic";
  const ClinicScreen({super.key});

  @override
  State<ClinicScreen> createState() => _ClinicScreenState();
}

class _ClinicScreenState extends State<ClinicScreen> {
  List<Clinic> _clinics = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final clinics = await getIt<ClinicApiService>().listClinics();
      if (!mounted) return;
      setState(() {
        _clinics = clinics;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load clinics.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.main_background_white,
      appBar: AppBar(
        title: const Text('Clinics'),
        backgroundColor: AppColors.main_background_blue,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!),
                      TextButton(onPressed: _load, child: const Text('Try again')),
                    ],
                  ),
                )
              : _clinics.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'No active clinics yet. Clinics added by MediCare appear here after activation.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _clinics.length,
                        itemBuilder: (context, i) => ModernClinicCard(
                          clinic: _clinics[i],
                          style: ModernClinicCardStyle.list,
                        ),
                      ),
                    ),
    );
  }
}
