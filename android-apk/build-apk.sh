#!/bin/bash
# Builds the METRO ASSIST Android WebView wrapper without Gradle.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="$HERE/../.tools/android-sdk"
JDK="$HERE/../.tools/jdk"
BUILD_TOOLS="$SDK/build-tools/35.0.0"
PLATFORM="$SDK/platforms/android-35/android.jar"
BUILD="$HERE/build"
OUT="$HERE/out"
KEYSTORE="$HERE/debug.keystore"
APK="$OUT/METRO-ASSIST.apk"

export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"

for tool in "$JDK/bin/javac" "$JDK/bin/keytool" "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/d8" \
            "$BUILD_TOOLS/zipalign" "$BUILD_TOOLS/apksigner" "$PLATFORM"; do
  if [ ! -e "$tool" ]; then
    echo "Missing build dependency: $tool" >&2
    exit 1
  fi
done

rm -rf "$BUILD"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$OUT"

echo "[1/6] Compiling resources"
"$BUILD_TOOLS/aapt2" compile --dir "$HERE/res" -o "$BUILD/resources.zip"

echo "[2/6] Linking resources and manifest"
"$BUILD_TOOLS/aapt2" link \
  -o "$BUILD/app-unsigned.apk" \
  -I "$PLATFORM" \
  --manifest "$HERE/AndroidManifest.xml" \
  -R "$BUILD/resources.zip" \
  --java "$BUILD/gen" \
  --auto-add-overlay \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name "1.0"

echo "[3/6] Compiling Java"
# shellcheck disable=SC2046
"$JDK/bin/javac" --release 11 -Xlint:-options \
  -classpath "$PLATFORM" \
  -d "$BUILD/classes" \
  $(find "$HERE/java" "$BUILD/gen" -name '*.java')

echo "[4/6] Dexing"
# shellcheck disable=SC2046
"$BUILD_TOOLS/d8" --lib "$PLATFORM" --min-api 24 \
  --output "$BUILD/dex" \
  $(find "$BUILD/classes" -name '*.class')

echo "[5/6] Packaging and aligning"
(cd "$BUILD" && zip -q -j app-unsigned.apk dex/classes.dex)
"$BUILD_TOOLS/zipalign" -f 4 "$BUILD/app-unsigned.apk" "$BUILD/app-aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "Creating a local debug keystore"
  "$JDK/bin/keytool" -genkeypair -v \
    -keystore "$KEYSTORE" \
    -storepass android -keypass android \
    -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=METRO ASSIST Debug,O=Prototype,C=IN" >/dev/null
fi

echo "[6/6] Signing"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$APK" "$BUILD/app-aligned.apk"

"$BUILD_TOOLS/apksigner" verify --print-certs "$APK"
"$BUILD_TOOLS/aapt" dump badging "$APK" | head -5
echo "Built: $APK"
