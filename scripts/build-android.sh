#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Prefer an explicitly configured toolchain, then the local development tools.
if [[ -z "${JAVA_HOME:-}" && -d tmp/android-tools/jdk ]]; then
  export JAVA_HOME="$PWD/tmp/android-tools/jdk"
fi
if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
  elif [[ -d tmp/android-tools/sdk ]]; then
    export ANDROID_HOME="$PWD/tmp/android-tools/sdk"
  fi
fi
if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo 'Set ANDROID_HOME to an Android SDK with platform 36 and build-tools 36.0.0.' >&2
  exit 1
fi
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PWD/tmp/android-tools/gradle}"
npm run android:sync
(cd android && ./gradlew assembleDebug --no-daemon --console=plain)
mkdir -p artifacts
cp android/app/build/outputs/apk/debug/app-debug.apk artifacts/downuptiles-0.3-debug.apk
echo "APK: $PWD/artifacts/downuptiles-0.3-debug.apk"
