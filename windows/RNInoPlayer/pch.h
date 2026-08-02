// windows/RNInoPlayer/pch.h
// Precompiled header — included by every .cpp file in the Windows module.
#pragma once

// Windows Runtime
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.System.Threading.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.ApplicationModel.Core.h>

// Media playback
#include <winrt/Windows.Media.h>
#include <winrt/Windows.Media.Core.h>
#include <winrt/Windows.Media.Playback.h>
#include <winrt/Windows.Media.MediaProperties.h>

// System media transport controls (lock screen / taskbar)
#include <winrt/Windows.Media.SystemMediaTransportControls.h>

// Networking (for HTTP headers)
#include <winrt/Windows.Web.Http.h>
#include <winrt/Windows.Web.Http.Headers.h>

// React Native Windows
#include <JSValueWriter.h>
#include <JSValueReader.h>
#include <NativeModules.h>
#include <ReactContext.h>
#include <ReactPackageProvider.h>
#include <winrt/Microsoft.ReactNative.h>

// Standard library
#include <functional>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <optional>
#include <sstream>
#include <chrono>

// JSON parsing (bundled with RN Windows)
#include <folly/dynamic.h>
#include <folly/json.h>
