require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "InoPlayer"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/I-am-Pritam-20/react-native-ino-player.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"

  # iPhone, iPad (iOS 13+) and Mac Catalyst (macOS via Catalyst)
  s.platforms = { :ios => "13.0", :maccatalyst => "13.0" }

  s.swift_version = "5.7"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE"                      => "YES",
    "SWIFT_OBJC_INTERFACE_HEADER_NAME"    => "react_native_ino_player-Swift.h",
    "GCC_WARN_ABOUT_DEPRECATED_FUNCTIONS" => "NO",
    "SUPPORTS_MACCATALYST"                => "YES",
  }

  s.frameworks = %w[AVFoundation MediaPlayer CoreAudio AudioToolbox CoreMedia]

  install_modules_dependencies(s)
end
