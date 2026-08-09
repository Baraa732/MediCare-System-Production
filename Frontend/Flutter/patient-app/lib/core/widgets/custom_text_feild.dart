import 'package:cms/core/constants/font_heading.dart';
import 'package:cms/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class CustomTextField extends StatefulWidget {
  final String label;
  final String hint;
  final TextInputType keyboardType;
  final TextEditingController? controller;
  final IconData? prefixIcon;
  final String? errorText;
  final Function(String)? onChanged; // receives raw digits
  final bool isPhoneNumber; // ⭐ new flag
  final bool obscureText; // ✅ New
  final Widget? suffixIcon; // ✅ New

  const CustomTextField({
    super.key,
    required this.label,
    required this.hint,
    this.keyboardType = TextInputType.text,
    this.controller,
    this.prefixIcon,
    this.errorText,
    this.onChanged,
    this.isPhoneNumber = false, // default false
     this.obscureText = false, // ✅ New
    this.suffixIcon, // ✅ New
  });

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  final FocusNode _focusNode = FocusNode();
  bool _isFocused = false;

  // Internal controller for phone number masking
  late TextEditingController _internalController;
  bool _isInternalController = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() => _isFocused = _focusNode.hasFocus);
    });

    // If phone number, use our own controller to format
    if (widget.isPhoneNumber) {
      _internalController = TextEditingController();
      _isInternalController = true;
      _internalController.addListener(_formatPhoneNumber);
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    if (_isInternalController) {
      _internalController.removeListener(_formatPhoneNumber);
      _internalController.dispose();
    }
    super.dispose();
  }

  void _formatPhoneNumber() {
    final text = _internalController.text;
    final raw = text.replaceAll(RegExp(r'[^0-9]'), '');
    final formatted = _applyPhoneMask(raw);
    if (text != formatted) {
      final selection = _internalController.selection;
      _internalController.value = TextEditingValue(
        text: formatted,
        selection: selection.copyWith(
          baseOffset: selection.baseOffset + (formatted.length - text.length),
          extentOffset: selection.extentOffset + (formatted.length - text.length),
        ),
      );
    }
    // Notify parent with raw digits
    if (widget.onChanged != null) {
      widget.onChanged!(raw);
    }
  }

  String _applyPhoneMask(String digits) {
    if (digits.isEmpty) return '';
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return '${digits.substring(0, 4)} ${digits.substring(4)}';
    return '${digits.substring(0, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}';
  }

  @override
  Widget build(BuildContext context) {
    final bool hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    Color labelColor;
    if (hasError) {
      labelColor = Colors.red;
    } else if (_isFocused) {
      labelColor = AppColors.main_background_blue;
    } else {
      labelColor = AppColors.customGray;
    }

    Color iconColor = (hasError) ? AppColors.customGray : ( _isFocused ? AppColors.main_background_blue : AppColors.customGray );

    // Decide which controller to use
    final controller = widget.isPhoneNumber ? _internalController : widget.controller;

    return TextFormField(
      focusNode: _focusNode,
      controller: controller,
      keyboardType: widget.keyboardType,
      onChanged: widget.isPhoneNumber ? null : widget.onChanged, // handled internally for phone
      inputFormatters: widget.isPhoneNumber
          ? [FilteringTextInputFormatter.digitsOnly] // only digits allowed
          : null,
          obscureText: widget.obscureText, // ✅ Add this
      decoration: InputDecoration(
         suffixIcon: widget.suffixIcon, // ✅ Add this
        focusedBorder: OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.main_background_blue, width: 2.0),
          borderRadius: BorderRadius.circular(8.0),
        ),
        enabledBorder: OutlineInputBorder(
          borderSide: BorderSide(color: AppColors.customGray, width: 1.0),
          borderRadius: BorderRadius.circular(8.0),
        ),
        errorBorder: OutlineInputBorder(
          borderSide: BorderSide(color: Colors.red, width: 1.0),
          borderRadius: BorderRadius.circular(8.0),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderSide: BorderSide(color: Colors.red, width: 2.0),
          borderRadius: BorderRadius.circular(8.0),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8.0),
        ),
        labelText: widget.label,
        labelStyle: FontHeading.body.copyWith(color: labelColor),
        floatingLabelStyle: FontHeading.body.copyWith(color: labelColor),
        floatingLabelBehavior: FloatingLabelBehavior.always,
        hintText: widget.hint,
        hintStyle: FontHeading.body.copyWith(color: AppColors.customGray),
        prefixIcon: widget.prefixIcon != null ? Icon(widget.prefixIcon) : null,
        prefixIconColor: iconColor,
        errorText: widget.errorText,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 18,
        ),
      ),
    );
  }
}