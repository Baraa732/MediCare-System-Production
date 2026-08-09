// lib/features/home/presentation/screens/home_screen.dart
// import 'package:cms/core/constants/font_heading.dart';
// import 'package:cms/core/theme/app_colors.dart';
// import 'package:cms/features/home/presentation/cubit/home_cubit.dart';
// import 'package:cms/features/home/presentation/cubit/home_state.dart';
// import 'package:cms/injection_container.dart';
import 'package:flutter/material.dart';
// import 'package:flutter_bloc/flutter_bloc.dart';

class HomeScreen extends StatelessWidget {
  static const routeName = '/home';

  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home Screen')),
      body: const Center(child: Text('Welcome to the Home Screen!')),
    );
  }
}
