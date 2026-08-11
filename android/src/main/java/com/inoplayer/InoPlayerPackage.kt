package com.inoplayer
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
class InoPlayerPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == InoPlayerModule.NAME) InoPlayerModule(reactContext) else null
    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(InoPlayerModule.NAME to ReactModuleInfo(
            InoPlayerModule.NAME, InoPlayerModule.NAME,
            false, false, false, true))
    }
}
