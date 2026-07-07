package com.inoplayer

import com.facebook.react.bridge.ReactApplicationContext

class InoPlayerModule(reactContext: ReactApplicationContext) :
  NativeInoPlayerSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeInoPlayerSpec.NAME
  }
}
