import 'package:flutter_test/flutter_test.dart';

import 'package:cms_doctor_app/app.dart';

void main() {
  testWidgets('App launches with splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());

    expect(find.text('Project name'), findsOneWidget);

    await tester.pump(const Duration(seconds: 3));
  });
}
