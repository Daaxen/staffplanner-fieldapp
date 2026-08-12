# iOS TestFlight Build Guide

This guide covers building the native iOS app from the Capacitor wrapper and uploading it to TestFlight for internal testing.

## Prerequisites

- A Mac running macOS (Xcode requires macOS).
- [Xcode](https://apps.apple.com/us/app/xcode/id497799835) installed from the Mac App Store or Apple Developer site.
- An active [Apple Developer Program](https://developer.apple.com/programs/) membership (required for TestFlight).
- The project cloned and dependencies installed locally:

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
```

## 1. Add the iOS platform

If this is the first time building for iOS, add the platform and sync native dependencies:

```sh
npx cap add ios
npx cap update ios
```

If `ios/` already exists, just update:

```sh
npx cap update ios
```

## 2. Build web assets and sync to Xcode

The native app loads the files in `dist/`. Build them and copy them into the iOS project:

```sh
npm run build
npx cap sync ios
```

## 3. Open the iOS workspace in Xcode

```sh
npx cap open ios
```

This opens `ios/App/App.xcworkspace` in Xcode.

## 4. Configure signing in Xcode

Before archiving, set up code signing:

1. In the Project navigator, select the top-level `App` project.
2. Select the `App` target → **Signing & Capabilities**.
3. Check **Automatically manage signing**.
4. Select your **Team** (Apple Developer team).
5. Set the **Bundle Identifier** to match `appId` in `capacitor.config.ts` (currently `app.lovable.p76fc550486b34fffaad7f61fef25ef8f`).
6. Xcode will register the App ID and provisioning profile automatically.

> **Important:** If the bundle identifier has already been used by another app in App Store Connect, change it to something unique (e.g. `app.lovable.p76fc550486b34fffaad7f61fef25ef8f.testflight`).

## 5. Archive the app

1. In Xcode, choose **Product → Destination → Any iOS Device (arm64)** from the toolbar.
2. Choose **Product → Archive**.
3. Wait for the archive to finish. The **Organizer** window will open automatically.

## 6. Upload to TestFlight

### Option A: Upload directly from Xcode Organizer

1. In the Organizer, select the archive you just created.
2. Click **Distribute App**.
3. Select **App Store Connect** → **TestFlight Internal Testing** (or **App Store Connect** → default flow).
4. Click **Upload**.
5. Choose content options (default is fine for TestFlight) and click **Upload** again.
6. Wait for validation and upload to complete. This can take a few minutes.

### Option B: Upload from the command line

If you prefer to stay in the terminal, you can archive and upload using `xcodebuild` and `altool`.

#### Step 1: Create an App Store Connect API key

1. Go to [App Store Connect → Users and Access → Keys](https://appstoreconnect.apple.com/access/api).
2. Click the **+** button to create a key.
3. Give it a name and select **App Manager** or **Admin** role.
4. Download the `.p8` private key file and note the **Key ID** and **Issuer ID**.

Store the key securely; you cannot download it again.

#### Step 2: Archive with xcodebuild

```sh
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -sdk iphoneos \
  -configuration Release \
  -archivePath ios/App.xcarchive \
  archive \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=<YOUR_TEAM_ID>
```

Replace `<YOUR_TEAM_ID>` with your Apple Developer Team ID (found in [Apple Developer Membership](https://developer.apple.com/account)).

#### Step 3: Export the archive to an IPA

Create an export options plist file at `ios/exportOptions.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>thinning</key>
    <string>&lt;none&gt;</string>
</dict>
</plist>
```

Then export the IPA:

```sh
xcodebuild -exportArchive \
  -archivePath ios/App.xcarchive \
  -exportOptionsPlist ios/exportOptions.plist \
  -exportPath ios/build
```

The IPA will be at `ios/build/App.ipa`.

#### Step 4: Upload the IPA with altool

```sh
xcrun altool --upload-app \
  --type ios \
  --file ios/build/App.ipa \
  --apiKey <APP_STORE_CONNECT_KEY_ID> \
  --apiIssuer <APP_STORE_CONNECT_ISSUER_ID>
```

The private key `.p8` file must be in the directory you run this command from, or in `~/.appstoreconnect/private_keys/`.

## 7. Add testers in App Store Connect

1. Open [App Store Connect → My Apps](https://appstoreconnect.apple.com/apps).
2. Select your app.
3. Go to **TestFlight** → **Internal Testing** (or **External Testing**).
4. Add testers by email.
5. Testers will receive an invitation to install the app via the TestFlight app.

## 8. Update the app after code changes

Every time you change the web code, rebuild and sync before testing again:

```sh
npm run build
npx cap sync ios
```

Then re-archive and upload, or run directly on a simulator/device:

```sh
npx cap run ios
```

## Common issues

- **Build fails with signing error:** Make sure you selected a valid Team in Xcode and the bundle identifier is unique.
- **"App ID already exists":** Change the bundle identifier in Xcode and in `capacitor.config.ts`.
- **Upload succeeds but testers see old build:** Make sure you ran `npm run build` and `npx cap sync ios` before archiving.
- **Network requests fail in the native app:** Check that the `server.url` in `capacitor.config.ts` points to the published/live URL, not localhost, for production builds. For local development, use `npx cap run ios --livereload --external`.
