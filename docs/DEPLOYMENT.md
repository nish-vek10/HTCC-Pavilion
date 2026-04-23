# Pavilion HTCC — Deployment Guide

> **Project root:** `C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app`  
> **Expo account:** `nishvek10`  
> **Bundle ID (iOS):** `com.htcc.pavilion`  
> **Package name (Android):** `com.htcc.pavilion`  
> **App Store name:** `Pavilion HTCC`  
> **EAS Project ID:** `839c48f3-c7a2-4fbd-a9c8-98e76daef60e`

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Pre-Build Checklist](#2-pre-build-checklist)
3. [iOS — App Store Build & Submission](#3-ios--app-store-build--submission)
   - 3.1 [Run the iOS Production Build](#31-run-the-ios-production-build)
   - 3.2 [App Store Connect Setup](#32-app-store-connect-setup)
   - 3.3 [Submit to App Store](#33-submit-to-app-store)
   - 3.4 [After Submission](#34-after-submission)
4. [Android — APK Build (Internal Testing)](#4-android--apk-build-internal-testing)
   - 4.1 [Run the Android Preview Build](#41-run-the-android-preview-build)
   - 4.2 [Install APK on Device](#42-install-apk-on-device)
5. [Android — Google Play Store Build & Submission](#5-android--google-play-store-build--submission)
   - 5.1 [Run the Android Production Build](#51-run-the-android-production-build)
   - 5.2 [Google Play Console Setup](#52-google-play-console-setup)
   - 5.3 [Submit to Google Play](#53-submit-to-google-play)
6. [Publishing Updates After Launch](#6-publishing-updates-after-launch)
   - 6.1 [Version Bump](#61-version-bump)
   - 6.2 [iOS Update](#62-ios-update)
   - 6.3 [Android Update](#63-android-update)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

These only need to be done once. Skip if already set up.

### Install EAS CLI globally

```powershell
npm install -g eas-cli
```

Verify installation:

```powershell
eas --version
```

### Log into Expo

```powershell
eas login
```

- Username: `nishvek10`
- Enter your Expo password when prompted

### Accounts required

| Account | URL | Purpose |
|---|---|---|
| Expo | expo.dev | Build servers and EAS |
| Apple Developer | developer.apple.com | iOS certificates and App Store |
| Google Play Console | play.google.com/console | Android Play Store |

---

## 2. Pre-Build Checklist

Run through this before every build to avoid rejected submissions.

### `app.json` version bump

Every new build requires a version increment. Open `app.json` and update:

```json
{
  "expo": {
    "version": "1.2.0",
    "ios": {
      "buildNumber": "3"
    },
    "android": {
      "versionCode": 3
    }
  }
}
```

**Rules:**
- `version` — user-facing version shown in stores (e.g. `1.2.0` → `1.3.0`)
- `ios.buildNumber` — must increment with every iOS build submitted (e.g. `"3"` → `"4"`)
- `android.versionCode` — must increment with every Android build submitted (integer, e.g. `3` → `4`)

### Environment variables

Confirm `.env` file exists at project root with:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

### Test account for App Store review

Create a test user account in the app and approve it as admin before submitting. Apple reviewers need working credentials to test the app.

---

## 3. iOS — App Store Build & Submission

### 3.1 Run the iOS Production Build

**From:**
```
C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
```

**Command:**
```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform ios --profile production
```

**Prompts you will see:**

| Prompt | Answer |
|---|---|
| iOS app only uses standard/exempt encryption? | `Y` |
| Do you want to log in to your Apple account? | `Y` |
| Apple ID | `anish.vek10@gmail.com` |
| Password | your Apple Developer password |
| Two-factor code | check your iPhone for the 6-digit code |
| Generate a new Apple Distribution Certificate? | `Y` (first time only) |
| Generate a new Apple Provisioning Profile? | `Y` (first time only) |
| Set up Push Notifications? | `Y` (first time only) |
| Generate a new Apple Push Notifications key? | `Y` (first time only) |

> **Note:** After the first build, certificates are saved. Subsequent builds only ask for the encryption question.

**Track build progress:**
```
https://expo.dev/accounts/nishvek10/projects/pavilion-htcc/builds
```

Build takes approximately **15–25 minutes** once it starts. Free tier queue can add up to **3–5 hours** waiting time.

You can safely press `Ctrl+C` — the build continues on Expo's servers.

---

### 3.2 App Store Connect Setup

Go to **appstoreconnect.apple.com**

#### Create the app (first time only)

1. Apps → `+` → **New App**
2. Fill in:

| Field | Value |
|---|---|
| Platform | iOS |
| Name | `Pavilion HTCC` |
| Primary Language | English (UK) |
| Bundle ID | `com.htcc.pavilion` |
| SKU | `pavilion-htcc` |
| User Access | Full Access |

3. Click **Create**

#### Fill in all required fields

**App Information (left sidebar):**

| Field | Value |
|---|---|
| Subtitle | `Harrow Town Cricket Club` |
| Category | Sports |
| Content Rights | This app does not contain third-party content |
| Copyright | `2026 Harrow Town Cricket Club` |

**Version Information (main area):**

| Field | Value |
|---|---|
| Description | See description template below |
| Keywords | `cricket,htcc,harrow,club,fixtures,availability,squad,stats,team,pavilion` |
| Support URL | `https://pavilion-htcc.netlify.app` |
| Marketing URL | `https://pavilion-htcc.netlify.app` |
| What's New | `Bug fixes and performance improvements` (or describe changes) |
| Version | `1.2.0` (match `app.json`) |

**Description template:**
```
Pavilion is the official club management app for Harrow Town Cricket Club.

Set your availability for Saturday and Sunday fixtures, view your Playing XI 
the moment your captain publishes the squad, and track live batting, bowling 
and fielding stats synced from PlayCricket across all five HTCC teams.

FEATURES
• Set availability for upcoming fixtures in one tap
• Get notified instantly when you're selected in the Playing XI
• View full season stats — batting, bowling and fielding
• Player of the Match leaderboards across all five teams
• Training session attendance
• Push notifications for squad selection and announcements
• Admin and captain management tools
• Real-time fixture and squad updates

Pavilion is exclusively for Harrow Town Cricket Club members. 
New accounts require admin approval from the club committee.
```

**Screenshots:**

Required sizes — upload at least 3 screenshots per size slot:

| Slot | Resolution | Covers |
|---|---|---|
| 6.9" Display | 1320 × 2868 px | iPhone 16 Pro Max |
| 6.5" Display | 1284 × 2778 px | iPhone 14/15 Plus, 13/12/11 Pro Max |

> **Tip:** Screenshots taken on iPhone 15 Pro are 1179 × 2556 px — resize to 1284 × 2778 using Canva (canva.com) before uploading.

**App Privacy (left sidebar):**

1. Click **Get Started**
2. Do you collect data? → **Yes**
3. Select:
   - Contact Info → Email Address, Name, Phone Number
   - Identifiers → User ID
4. For each: Used for **App Functionality**, linked to identity → **Yes**, tracking → **No**
5. Click **Publish**

**Privacy Policy URL:**
Host your privacy policy as a public GitHub Gist and use the Raw URL.

**Age Rating (left sidebar):**
- Click **Set Age Rating**
- Answer **None/No** to all questions → sets to **4+**

**Pricing (left sidebar):**
- Price: **Free**
- Availability: All territories or UK only

**App Review Information (scroll down on version page):**

| Field | Value |
|---|---|
| First Name | Anish |
| Last Name | Vekaria |
| Phone | your phone number |
| Email | anish.vek10@gmail.com |
| Notes | See review notes template below |
| Sign-in required | Yes |
| Username | your test account email |
| Password | your test account password |

**Review notes template:**
```
Pavilion is a private club app for Harrow Town Cricket Club members.
Account access requires admin approval.

We have pre-approved a test account for your review:

Email: [test email]
Password: [test password]

Upon logging in you will have full member access including fixtures,
stats, notifications and squad selection.
```

---

### 3.3 Submit to App Store

Once the EAS build shows **Finished**, run:

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas submit --platform ios
```

This automatically uploads the `.ipa` to App Store Connect.

Then in App Store Connect:
1. Go to your app → version page
2. Scroll to **Build** section → click **Add Build**
3. Select the uploaded build from the list
4. Click **Save**
5. Click **Submit for Review** (top right)
6. Answer the export compliance question → **No** (uses standard encryption only)
7. Confirm submission

---

### 3.4 After Submission

- Apple review typically takes **24–48 hours** for first submissions
- You will receive an email when approved or if changes are required
- Track status at **appstoreconnect.apple.com** → your app → **Activity** tab
- If rejected, Apple will explain the reason — fix the issue and resubmit

---

## 4. Android — APK Build (Internal Testing)

Use this for testing the app on a physical Android device without the Play Store.

### 4.1 Run the Android Preview Build

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform android --profile preview
```

No prompts required — EAS uses the existing Android keystore automatically.

Track progress:
```
https://expo.dev/accounts/nishvek10/projects/pavilion-htcc/builds
```

Build takes approximately **10–15 minutes** once it starts.

### 4.2 Install APK on Device

1. When build finishes, open the build page and click **Download**
2. Transfer the `.apk` file to your Android phone (email it to yourself or use USB)
3. On the Android phone, open the file
4. If prompted — go to **Settings → Install unknown apps** → allow your browser or file manager
5. Tap **Install**

> **Note:** APK builds are for internal testing only. Do not distribute to users via APK. Use the Play Store for public distribution.

---

## 5. Android — Google Play Store Build & Submission

### 5.1 Run the Android Production Build

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform android --profile production
```

This creates an **AAB** (Android App Bundle) which is required for Play Store submission.

### 5.2 Google Play Console Setup

Go to **play.google.com/console**

> **Note:** Google Play requires a one-time $25 USD developer registration fee.

#### Create the app (first time only)

1. **All apps** → **Create app**
2. Fill in:

| Field | Value |
|---|---|
| App name | `Pavilion HTCC` |
| Default language | English (United Kingdom) |
| App or game | App |
| Free or paid | Free |

3. Accept policies → **Create app**

#### Fill in store listing

**Main store listing:**

| Field | Value |
|---|---|
| Short description (80 chars) | `Official club app for Harrow Town Cricket Club` |
| Full description | Same as iOS description above |

**Graphics:**

| Asset | Size |
|---|---|
| App icon | 512 × 512 px PNG |
| Feature graphic | 1024 × 500 px PNG |
| Screenshots | Minimum 2, phone screenshots at least 320px wide |

**Categorisation:**

| Field | Value |
|---|---|
| App category | Sports |
| Tags | Cricket, Club Management |
| Email address | `anish.vek10@gmail.com` |
| Privacy policy URL | your GitHub Gist raw URL |

#### Content rating

1. Go to **Policy → App content → Content rating**
2. Click **Start questionnaire**
3. Category: **Utility**
4. Answer **No** to all questions
5. Submit → rating assigned automatically

#### App access

1. Go to **Policy → App content → App access**
2. Select **All or some functionality is restricted**
3. Add instructions:
```
Login required. Use these test credentials:
Email: [test email]
Password: [test password]
```

#### Target audience

1. Go to **Policy → App content → Target audience**
2. Select **18 and over**

### 5.3 Submit to Google Play

Once the AAB build is finished, run:

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas submit --platform android
```

Then in Google Play Console:
1. Go to **Release → Production**
2. Click **Create new release**
3. The AAB should already be uploaded — if not, upload it manually
4. Add release notes:
```
Initial release of Pavilion for Harrow Town Cricket Club.
```
5. Click **Save** → **Review release** → **Start rollout to Production**

Google Play review takes **1–3 days** for first submissions.

---

## 6. Publishing Updates After Launch

### 6.1 Version Bump

Every update requires a version increment in `app.json`:

```json
{
  "expo": {
    "version": "1.3.0",
    "ios": {
      "buildNumber": "4"
    },
    "android": {
      "versionCode": 4
    }
  }
}
```

**Rules:**
- Always increment `buildNumber` and `versionCode` — even for small fixes
- Use semantic versioning for `version`:
  - `1.2.0` → `1.2.1` for bug fixes
  - `1.2.0` → `1.3.0` for new features
  - `1.2.0` → `2.0.0` for major changes

### 6.2 iOS Update

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform ios --profile production
```

Then once built:
```powershell
eas submit --platform ios
```

In App Store Connect:
1. Go to your app → click **+** next to the version number (left sidebar)
2. Enter new version number
3. Fill in **What's New** with the changes
4. Select the new build
5. Submit for review

### 6.3 Android Update

```powershell
cd C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
eas build --platform android --profile production
```

Then once built:
```powershell
eas submit --platform android
```

In Google Play Console:
1. **Release → Production → Create new release**
2. Upload the new AAB
3. Add release notes
4. Roll out

---

## 7. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Build fails with certificate error | Expired or invalid certificate | Run `eas credentials` to reset |
| `eas: command not found` | EAS CLI not installed | Run `npm install -g eas-cli` |
| Build queued for hours | Free tier queue | Wait, or upgrade at expo.dev/billing |
| App rejected — Guideline 4.0 | App crashes on review device | Test on a clean device before submitting |
| App rejected — login required | No test credentials provided | Add credentials in Review Notes |
| `versionCode` already used | Forgot to increment | Bump `versionCode` in `app.json` and rebuild |
| Push notifications not working | APNs key not set up | Run `eas credentials` and add push key |
| Expo Go warning on build | Normal warning, not an error | Suppress with `EAS_BUILD_NO_EXPO_GO_WARNING=true` |

---

## Quick Reference — Commands

All commands run from:
```
C:\Users\ravil\PycharmProjects\HTCC-Pavilion\pavilion-app
```

| Action | Command |
|---|---|
| Login to EAS | `eas login` |
| iOS production build | `eas build --platform ios --profile production` |
| Android preview APK | `eas build --platform android --profile preview` |
| Android production AAB | `eas build --platform android --profile production` |
| Submit iOS to App Store | `eas submit --platform ios` |
| Submit Android to Play Store | `eas submit --platform android` |
| View all builds | `eas build:list` |
| Manage credentials | `eas credentials` |
| Check EAS version | `eas --version` |

---

*Last updated: March 2026 — Pavilion v1.2.0*
