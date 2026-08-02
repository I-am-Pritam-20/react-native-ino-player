// windows/RNInoPlayer/ReactPackageProvider.h
#pragma once
#include "pch.h"

namespace winrt::RNInoPlayer {

struct ReactPackageProvider
  : winrt::implements<
      ReactPackageProvider,
      Microsoft::ReactNative::IReactPackageProvider>
{
  void CreatePackage(
    Microsoft::ReactNative::IReactPackageBuilder const& packageBuilder)
    noexcept;
};

} // namespace winrt::RNInoPlayer
