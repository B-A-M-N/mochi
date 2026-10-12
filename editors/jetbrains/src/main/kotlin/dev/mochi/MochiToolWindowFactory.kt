package dev.mochi

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.Dimension
import javax.swing.JButton
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTextArea
import javax.swing.JTextField
import javax.swing.SwingUtilities

class MochiToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = MochiChatPanel(project)
        val content = ContentFactory.getInstance().createContent(panel.root, "", false)
        content.isCloseable = false
        toolWindow.contentManager.addContent(content)
    }

    class MochiChatPanel(private val project: Project) {
        val root = JPanel(BorderLayout())
        private val transcript = JTextArea()
        private val input = JTextField()
        private val sendButton = JButton("Send")
        private val cancelButton = JButton("Cancel")
        private val newButton = JButton("New")
        private val modeButton = JButton("Mode: act")
        private val statusLabel = JLabel("Mochi ready")
        private var mode = "act"
        private val listener: MochiChunkListener

        init {
            transcript.isEditable = false
            transcript.lineWrap = true
            transcript.wrapStyleWord = true
            transcript.text = "Mochi agent ready. Type a request and press Send.\n" +
                "Tip: select code in the editor, right-click → Send Selection to Mochi.\n"
            val scroll = JBScrollPane(transcript)
            scroll.preferredSize = Dimension(320, 400)

            val top = JPanel(BorderLayout())
            top.add(statusLabel, BorderLayout.WEST)
            val topButtons = JPanel()
            topButtons.add(newButton)
            topButtons.add(modeButton)
            top.add(topButtons, BorderLayout.EAST)

            val bottom = JPanel(BorderLayout())
            bottom.add(input, BorderLayout.CENTER)
            val buttons = JPanel()
            buttons.add(sendButton)
            buttons.add(cancelButton)
            bottom.add(buttons, BorderLayout.EAST)

            root.add(top, BorderLayout.NORTH)
            root.add(scroll, BorderLayout.CENTER)
            root.add(bottom, BorderLayout.SOUTH)

            val service = MochiService.getInstance(project)
            listener = { sessionId, text ->
                val current = try {
                    service.getOrCreateSession()
                } catch (_: Exception) {
                    ""
                }
                if (current.isEmpty() || sessionId == current) {
                    SwingUtilities.invokeLater { transcript.append(text + "\n") }
                }
            }
            service.addUpdateListener(listener)

            sendButton.addActionListener { sendCurrentInput() }
            input.addActionListener { sendCurrentInput() }
            cancelButton.addActionListener {
                setStatus("Cancelling…")
                ApplicationManager.getApplication().executeOnPooledThread {
                    try {
                        service.cancelCurrent()
                        setStatus("Cancelled")
                    } catch (e: Exception) {
                        appendLine("Cancel failed: ${e.message}")
                        setStatus("Cancel failed")
                    }
                }
            }
            newButton.addActionListener {
                setStatus("Starting new session…")
                setBusy(true)
                ApplicationManager.getApplication().executeOnPooledThread {
                    try {
                        val sid = service.newSessionFresh()
                        appendLine("New session ${sid.take(8)} (act mode).")
                        mode = "act"
                        updateModeButton()
                        setStatus("Session ${sid.take(8)} ready")
                    } catch (e: Exception) {
                        appendLine("New session failed: ${e.message}")
                        setStatus("New session failed")
                        showBinaryError(e)
                    } finally {
                        setBusy(false)
                    }
                }
            }
            modeButton.addActionListener {
                val next = if (mode == "plan") "act" else "plan"
                setStatus("Switching to $next…")
                ApplicationManager.getApplication().executeOnPooledThread {
                    try {
                        val sid = service.getOrCreateSession()
                        service.setMode(sid, next)
                        mode = next
                        updateModeButton()
                        appendLine("Mode: $mode (${if (mode == "plan") "read-only blueprinting" else "direct execution"}).")
                        setStatus("Mode: $mode")
                    } catch (e: Exception) {
                        appendLine("Mode switch failed: ${e.message}")
                        setStatus("Mode switch failed")
                    }
                }
            }
        }

        fun sendText(text: String) {
            if (text.isBlank()) return
            appendLine("You: $text")
            setStatus("Mochi is working…")
            setBusy(true)
            ApplicationManager.getApplication().executeOnPooledThread {
                try {
                    val service = MochiService.getInstance(project)
                    val stopReason = service.promptText(text)
                    appendLine("Mochi finished ($stopReason).")
                    setStatus("Done ($stopReason)")
                } catch (e: Exception) {
                    appendLine("Error: ${e.message}")
                    setStatus("Error — see log")
                    showBinaryError(e)
                } finally {
                    setBusy(false)
                }
            }
        }

        private fun sendCurrentInput() {
            val text = input.text.trim()
            if (text.isEmpty()) return
            input.text = ""
            sendText(text)
        }

        private fun appendLine(line: String) {
            SwingUtilities.invokeLater { transcript.append(line + "\n") }
        }

        private fun setStatus(s: String) {
            SwingUtilities.invokeLater { statusLabel.text = s }
        }

        private fun updateModeButton() {
            SwingUtilities.invokeLater { modeButton.text = "Mode: $mode" }
        }

        private fun setBusy(busy: Boolean) {
            SwingUtilities.invokeLater {
                sendButton.isEnabled = !busy
                input.isEnabled = !busy
            }
        }

        private fun showBinaryError(e: Exception) {
            val msg = e.message ?: ""
            if (msg.contains("mochi", ignoreCase = true) && (msg.contains("No such file", ignoreCase = true) || msg.contains("error=2", ignoreCase = true))) {
                SwingUtilities.invokeLater {
                    Messages.showWarningDialog(
                        project,
                        "Mochi binary not found. Install with `npm i -g @mochi/agent` or set the path in Settings → Tools → Mochi.",
                        "Mochi: Binary Missing",
                    )
                }
            }
        }
    }
}
