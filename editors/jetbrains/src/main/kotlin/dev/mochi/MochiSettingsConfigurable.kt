package dev.mochi

import com.intellij.openapi.options.Configurable
import java.awt.BorderLayout
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import java.awt.Insets
import javax.swing.JCheckBox
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTextField

class MochiSettingsConfigurable : Configurable {

    private var binaryPathField: JTextField? = null
    private var timeoutField: JTextField? = null
    private var notificationsCheckBox: JCheckBox? = null

    override fun getDisplayName(): String = "Mochi"

    override fun createComponent(): JComponent {
        val settings = MochiSettings.getInstance()

        val binaryPath = JTextField(settings.binaryPath, 30)
        val timeout = JTextField(settings.requestTimeoutMs.toString(), 12)
        val notifications = JCheckBox("Show notifications", settings.showNotifications)
        binaryPathField = binaryPath
        timeoutField = timeout
        notificationsCheckBox = notifications

        val form = JPanel(GridBagLayout())
        val gbc = GridBagConstraints().apply {
            insets = Insets(4, 4, 4, 4)
            anchor = GridBagConstraints.WEST
        }

        gbc.gridx = 0
        gbc.gridy = 0
        gbc.fill = GridBagConstraints.NONE
        form.add(JLabel("Mochi binary path:"), gbc)
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        form.add(binaryPath, gbc)

        gbc.gridx = 0
        gbc.gridy = 1
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        form.add(JLabel("Request timeout (ms):"), gbc)
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        form.add(timeout, gbc)

        gbc.gridx = 1
        gbc.gridy = 2
        form.add(notifications, gbc)

        val root = JPanel(BorderLayout())
        root.add(form, BorderLayout.NORTH)
        return root
    }

    override fun isModified(): Boolean {
        val settings = MochiSettings.getInstance()
        val binary = binaryPathField?.text?.trim().orEmpty()
        val timeout = timeoutField?.text?.trim()?.toLongOrNull() ?: -1L
        val notifications = notificationsCheckBox?.isSelected ?: settings.showNotifications
        return binary != settings.binaryPath ||
            timeout != settings.requestTimeoutMs ||
            notifications != settings.showNotifications
    }

    override fun apply() {
        val settings = MochiSettings.getInstance()
        settings.binaryPath = binaryPathField?.text?.trim().orEmpty()
        timeoutField?.text?.trim()?.toLongOrNull()?.takeIf { it > 0 }?.let {
            settings.requestTimeoutMs = it
        }
        notificationsCheckBox?.let { settings.showNotifications = it.isSelected }
    }

    override fun reset() {
        val settings = MochiSettings.getInstance()
        binaryPathField?.text = settings.binaryPath
        timeoutField?.text = settings.requestTimeoutMs.toString()
        notificationsCheckBox?.isSelected = settings.showNotifications
    }

    override fun disposeUIResources() {
        binaryPathField = null
        timeoutField = null
        notificationsCheckBox = null
    }
}
