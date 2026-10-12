package dev.mochi

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

data class MochiSettingsState(
    var binaryPath: String = "mochi",
    var requestTimeoutMs: Long = 600000,
    var showNotifications: Boolean = true
)

@State(name = "MochiSettings", storages = [Storage("mochi.xml")])
@Service(Service.Level.APP)
class MochiSettings : PersistentStateComponent<MochiSettingsState> {
    private var state = MochiSettingsState()

    override fun getState(): MochiSettingsState = state

    override fun loadState(loaded: MochiSettingsState) {
        state = loaded
    }

    var binaryPath: String
        get() = state.binaryPath.ifBlank { "mochi" }
        set(value) {
            state.binaryPath = value.ifBlank { "mochi" }
        }

    var requestTimeoutMs: Long
        get() = state.requestTimeoutMs.takeIf { it > 0 } ?: 600000
        set(value) {
            state.requestTimeoutMs = if (value > 0) value else 600000
        }

    var showNotifications: Boolean
        get() = state.showNotifications
        set(value) {
            state.showNotifications = value
        }

    companion object {
        @JvmStatic
        fun getInstance(): MochiSettings =
            ApplicationManager.getApplication().getService(MochiSettings::class.java)
    }
}
