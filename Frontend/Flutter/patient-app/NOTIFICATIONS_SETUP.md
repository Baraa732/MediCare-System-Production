# MediCare Patient App — Advanced Notifications

Production-ready notifications cover **app open**, **app closed/background**, and **offline** scenarios.

## Architecture

| Scenario | Behavior |
|----------|----------|
| App open (foreground) | FCM → heads-up local notification + inbox update |
| App background | FCM system tray (OS) + background cache |
| App killed / closed | FCM system tray (OS); tap opens Notifications |
| Offline | Cached inbox from device storage; read actions queued |
| Back online | Auto-sync inbox + flush pending read states to API |
| Data-only FCM | Background isolate draws local tray notification |

### Required for tray push (BeeOrder-style)

Without Firebase Android config, inbox still works but **phone tray push will not**.

1. Firebase Console → add Android app with package `com.example.cms`
2. Download `google-services.json` → place in `android/app/google-services.json`
3. Rebuild the app (`flutter run` / release build)
4. Login as patient → allow notification permission when prompted
5. Optional backend env: `FIREBASE_ANDROID_APP_ID` (and API key) so `/notifications/push/mobile-config` can bootstrap Flutter without the JSON file

## Backend endpoints (patient)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications/me` | Inbox with `title`, `body`, `readAt`, `unreadCount` |
| PATCH | `/notifications/me/:id/read` | Mark one notification read |
| PATCH | `/notifications/me/read-all` | Mark all read |
| POST | `/notifications/patient/push/register` | Register FCM token |
| DELETE | `/notifications/patient/push/register` | Unregister FCM token |

Appointment events (confirm, cancel, reschedule, reminder) create inbox rows and send FCM with channel `medicare_patient`.

## Flutter setup

### 1. Generate platform folders (required once)

The repo may not include `android/` / `ios/` yet. From `Frontend/Flutter/patient-app`:

```bash
flutter create .
flutter pub get
```

### 2. Firebase project

1. Create a Firebase project and add **Android** + **iOS** apps for the patient bundle ID.
2. Run FlutterFire (recommended):

```bash
dart pub global activate flutterfire_cli
flutterfire configure
```

This generates `lib/firebase_options.dart`. You can replace the placeholder at `lib/core/notifications/firebase_options.dart` or merge values.

**Alternative:** pass build-time defines:

```bash
flutter run \
  --dart-define=FIREBASE_API_KEY=... \
  --dart-define=FIREBASE_APP_ID=... \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
  --dart-define=FIREBASE_PROJECT_ID=...
```

Without Firebase, **inbox + offline cache still work**; push delivery is disabled until configured.

### 3. Android configuration

After `flutter create .`, ensure:

**`android/app/src/main/AndroidManifest.xml`** — inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

Inside `<application>`:

```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="medicare_patient" />
```

Place `google-services.json` in `android/app/`.

**`android/app/build.gradle`** — apply Google services plugin and add Firebase BOM per [FlutterFire docs](https://firebase.flutter.dev/docs/overview).

### 4. iOS configuration

- Enable **Push Notifications** capability in Xcode.
- Add `GoogleService-Info.plist` to the Runner target.
- Upload APNs key/certificate in Firebase Console.

### 5. Run

```bash
flutter run --dart-define=API_BASE_URL=https://medicare-system-production-production.up.railway.app/api
```

Log in as a patient — the app registers the FCM token automatically.

## Deploy backend changes

The notification-service needs the new `patient_inbox_notifications` table. Run migrations on Railway or set `DB_BOOTSTRAP=true` once in dev.

Ensure these env vars exist on notification-service:

- `JWT_SECRET`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (for FCM send)

## Testing checklist

- [ ] Book appointment → patient receives inbox item + push (if Firebase configured)
- [ ] Cancel/reschedule → updated notification
- [ ] Open app → foreground banner for new push
- [ ] Kill app → push appears in system tray
- [ ] Airplane mode → cached inbox visible; mark read queued
- [ ] Reconnect → reads synced; inbox refreshed
