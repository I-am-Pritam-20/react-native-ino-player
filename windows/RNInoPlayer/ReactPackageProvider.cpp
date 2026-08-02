// windows/RNInoPlayer/ReactPackageProvider.cpp
#include "pch.h"
#include "ReactPackageProvider.h"
#include "InoPlayerModule.h"

namespace winrt::RNInoPlayer {

void ReactPackageProvider::CreatePackage(
  Microsoft::ReactNative::IReactPackageBuilder const& packageBuilder) noexcept
{
  AddAttributedModules(packageBuilder);
}

} // namespace winrt::RNInoPlayer
