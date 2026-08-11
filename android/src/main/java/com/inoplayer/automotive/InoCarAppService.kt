package com.inoplayer.automotive
import android.content.pm.ApplicationInfo
import androidx.car.app.*; import androidx.car.app.model.*; import androidx.car.app.validation.HostValidator
class InoCarAppService : CarAppService() {
    override fun createHostValidator() = if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) HostValidator.ALLOW_ALL_HOSTS_VALIDATOR else HostValidator.Builder(applicationContext).addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample).build()
    override fun onCreateSession(sessionInfo: SessionInfo) = InoCarSession(sessionInfo)
}
class InoCarSession(private val info: SessionInfo) : Session() {
    override fun onCreateScreen(intent: android.content.Intent): Screen = InoCarScreen(carContext, info)
}
class InoCarScreen(carContext: CarContext, private val info: SessionInfo) : Screen(carContext) {
    override fun onGetTemplate(): Template = ListTemplate.Builder().setTitle("InoPlayer")
        .setSingleList(ItemList.Builder().addItem(Row.Builder().setTitle("Now Playing").setOnClickListener {}.build()).addItem(Row.Builder().setTitle("Library").setOnClickListener {}.build()).build()).build()
}
