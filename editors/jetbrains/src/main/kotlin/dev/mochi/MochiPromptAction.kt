package dev.mochi

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

class MochiPromptAction : AnAction() {

    override fun update(event: AnActionEvent) {
        val editor = event.getData(CommonDataKeys.EDITOR)
        val selection = editor?.selectionModel?.selectedText
        event.presentation.isEnabledAndVisible = event.project != null && !selection.isNullOrBlank()
    }

    override fun actionPerformed(event: AnActionEvent) {
        val project = event.project ?: return
        val editor = event.getData(CommonDataKeys.EDITOR) ?: return
        val selection = editor.selectionModel.selectedText?.trim().orEmpty()
        if (selection.isEmpty()) return
        val fileName = event.getData(CommonDataKeys.VIRTUAL_FILE)?.name ?: "selection"
        val line = editor.caretModel.logicalPosition.line + 1
        val question = Messages.showInputDialog(
            project,
            "What should Mochi do with this selection?",
            "Send Selection to Mochi",
            null,
            "Explain this code",
            null,
        ) ?: return
        if (question.isBlank()) return
        val promptText = "$question\n\nSelected code from $fileName:$line:\n```\n${selection.take(4000)}\n```"
        ToolWindowManager.getInstance(project).getToolWindow("Mochi")?.show()
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                MochiService.getInstance(project).promptText(promptText)
            } catch (e: Exception) {
                Messages.showErrorDialog(project, "Mochi failed: ${e.message}", "Mochi Error")
            }
        }
    }
}
