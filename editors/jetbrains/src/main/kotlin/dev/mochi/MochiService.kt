package dev.mochi

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.nio.charset.StandardCharsets
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

typealias MochiChunkListener = (sessionId: String, text: String) -> Unit

@Service(Service.Level.PROJECT)
class MochiService(private val project: Project) : Disposable {

    private val requestId = AtomicLong(1)
    private val pending = ConcurrentHashMap<String, CompletableFuture<JsonObject>>()
    private val listeners = CopyOnWriteArrayList<MochiChunkListener>()

    private var process: Process? = null
    private var writer: BufferedWriter? = null
    private var readerThread: Thread? = null

    @Volatile
    private var initialized = false

    @Volatile
    private var defaultSessionId: String? = null

    fun addUpdateListener(listener: MochiChunkListener) {
        listeners.add(listener)
    }

    fun removeUpdateListener(listener: MochiChunkListener) {
        listeners.remove(listener)
    }

    @Synchronized
    fun ensureStarted() {
        if (process?.isAlive == true && writer != null) return
        shutdownProcess()
        val binary = try {
            MochiSettings.getInstance().binaryPath
        } catch (_: Exception) {
            "mochi"
        }
        val basePath = project.basePath ?: System.getProperty("user.dir")
        val builder = ProcessBuilder(binary, "acp").directory(java.io.File(basePath))
        builder.redirectErrorStream(false)
        val started = builder.start()
        process = started
        writer = BufferedWriter(OutputStreamWriter(started.outputStream, StandardCharsets.UTF_8))
        val reader = BufferedReader(InputStreamReader(started.inputStream, StandardCharsets.UTF_8))
        initialized = false
        val thread = Thread({ readLoop(reader) }, "mochi-acp-reader")
        thread.isDaemon = true
        readerThread = thread
        thread.start()
    }

    private fun readLoop(reader: BufferedReader) {
        try {
            while (true) {
                val line = reader.readLine() ?: break
                val trimmed = line.trim()
                if (trimmed.isEmpty()) continue
                val element = try {
                    JsonParser.parseString(trimmed)
                } catch (_: Exception) {
                    continue
                }
                if (!element.isJsonObject) continue
                val message = element.asJsonObject
                if (message.has("method")) {
                    handleServerMessage(message)
                } else if (message.has("id")) {
                    val key = message.get("id").toString()
                    val future = pending.remove(key)
                    if (future != null) {
                        future.complete(message)
                    }
                }
            }
        } catch (_: Exception) {
        } finally {
            for ((_, future) in pending) {
                future.completeExceptionally(IllegalStateException("ACP process terminated"))
            }
            pending.clear()
        }
    }

    private fun handleServerMessage(message: JsonObject) {
        val method = message.get("method")?.asString ?: return
        if (method != "session/update") return
        val params = if (message.has("params") && message.get("params").isJsonObject) {
            message.getAsJsonObject("params")
        } else return
        val sessionId = params.get("sessionId")?.asString ?: return
        val update = if (params.has("update") && params.get("update").isJsonObject) {
            params.getAsJsonObject("update")
        } else return
        val text = extractText(update) ?: return
        if (text.isEmpty()) return
        for (listener in listeners) {
            try {
                listener(sessionId, text)
            } catch (_: Exception) {
            }
        }
    }

    private fun extractText(update: JsonObject): String? {
        val kind = update.get("sessionUpdate")?.asString ?: return null
        if (kind == "agent_message_chunk") {
            val content = update.get("content") ?: return null
            return extractContentText(content)
        }
        if (kind == "tool_call" || kind == "tool_call_update") {
            val title = update.get("title")?.asString
            val status = update.get("status")?.asString
            val content = if (update.has("content")) extractContentText(update.get("content")) else null
            val parts = listOfNotNull(title, status, content).filter { it.isNotEmpty() }
            if (parts.isEmpty()) return null
            return parts.joinToString(": ").take(2000)
        }
        return null
    }

    private fun extractContentText(element: com.google.gson.JsonElement): String? {
        if (element.isJsonObject) {
            val obj = element.asJsonObject
            if (obj.has("text")) return obj.get("text").asString
            return null
        }
        if (element.isJsonArray) {
            val parts = mutableListOf<String>()
            for (item in element.asJsonArray) {
                if (item.isJsonObject && item.asJsonObject.has("text")) {
                    parts.add(item.asJsonObject.get("text").asString)
                } else if (item.isJsonPrimitive) {
                    parts.add(item.asString)
                }
            }
            if (parts.isEmpty()) return null
            return parts.joinToString("\n")
        }
        if (element.isJsonPrimitive) return element.asString
        return null
    }

    private fun sendRequest(method: String, params: JsonObject): CompletableFuture<JsonObject> {
        ensureStarted()
        val id = requestId.getAndIncrement()
        val envelope = JsonObject()
        envelope.addProperty("jsonrpc", "2.0")
        envelope.addProperty("id", id)
        envelope.addProperty("method", method)
        envelope.add("params", params)
        val future = CompletableFuture<JsonObject>()
        pending[id.toString()] = future
        val line = envelope.toString() + "\n"
        try {
            synchronized(this) {
                writer?.write(line)
                writer?.flush()
            }
        } catch (e: Exception) {
            pending.remove(id.toString())
            future.completeExceptionally(e)
        }
        return future
    }

    private fun sendNotification(method: String, params: JsonObject) {
        ensureStarted()
        val envelope = JsonObject()
        envelope.addProperty("jsonrpc", "2.0")
        envelope.addProperty("method", method)
        envelope.add("params", params)
        val line = envelope.toString() + "\n"
        try {
            synchronized(this) {
                writer?.write(line)
                writer?.flush()
            }
        } catch (_: Exception) {
        }
    }

    @Synchronized
    fun initialize(): Boolean {
        ensureStarted()
        if (initialized) return true
        val params = JsonObject()
        params.addProperty("protocolVersion", 1)
        params.add("clientCapabilities", JsonObject())
        val response = sendRequest("initialize", params).get(30, TimeUnit.SECONDS)
        val error = response.get("error")
        if (error != null && !error.isJsonNull) return false
        initialized = true
        return true
    }

    fun newSession(): String {
        initialize()
        val params = JsonObject()
        val cwd = project.basePath
        if (cwd != null) params.addProperty("cwd", cwd)
        val response = sendRequest("session/new", params).get(30, TimeUnit.SECONDS)
        if (response.has("error") && !response.get("error").isJsonNull) {
            val message = response.getAsJsonObject("error").get("message")?.asString ?: "session/new failed"
            throw IllegalStateException(message)
        }
        val result = response.getAsJsonObject("result")
        return result.get("sessionId").asString
    }

    @Synchronized
    fun getOrCreateSession(): String {
        val existing = defaultSessionId
        if (existing != null) return existing
        val created = newSession()
        defaultSessionId = created
        return created
    }

    fun prompt(sessionId: String, text: String): String {
        initialize()
        val params = JsonObject()
        params.addProperty("sessionId", sessionId)
        val blocks = JsonArray()
        val block = JsonObject()
        block.addProperty("type", "text")
        block.addProperty("text", text)
        blocks.add(block)
        params.add("prompt", blocks)
        val response = sendRequest("session/prompt", params).get(10, TimeUnit.MINUTES)
        if (response.has("error") && !response.get("error").isJsonNull) {
            val message = response.getAsJsonObject("error").get("message")?.asString ?: "session/prompt failed"
            throw IllegalStateException(message)
        }
        val result = response.getAsJsonObject("result")
        return result.get("stopReason")?.asString ?: "end_turn"
    }

    fun promptText(text: String): String {
        val sessionId = getOrCreateSession()
        return prompt(sessionId, text)
    }

    fun cancel(sessionId: String) {
        val params = JsonObject()
        params.addProperty("sessionId", sessionId)
        sendNotification("session/cancel", params)
    }

    fun cancelCurrent() {
        val sessionId = defaultSessionId ?: return
        cancel(sessionId)
    }

    fun setMode(sessionId: String, modeId: String): String {
        initialize()
        val params = JsonObject()
        params.addProperty("sessionId", sessionId)
        params.addProperty("modeId", modeId)
        val response = sendRequest("session/set_mode", params).get(15, TimeUnit.SECONDS)
        if (response.has("error") && !response.get("error").isJsonNull) {
            val message = response.getAsJsonObject("error").get("message")?.asString ?: "session/set_mode failed"
            throw IllegalStateException(message)
        }
        return response.getAsJsonObject("result").get("modeId")?.asString ?: modeId
    }

    fun close(sessionId: String) {
        try {
            val params = JsonObject()
            params.addProperty("sessionId", sessionId)
            sendRequest("session/close", params).get(15, TimeUnit.SECONDS)
        } catch (_: Exception) {
            // best-effort: the server drops dead sessions on close anyway
        }
    }

    @Synchronized
    fun newSessionFresh(): String {
        val old = defaultSessionId
        if (old != null) {
            try { close(old) } catch (_: Exception) {}
        }
        defaultSessionId = null
        return getOrCreateSession()
    }

    fun shutdown() {
        try {
            val params = JsonObject()
            sendRequest("shutdown", params).get(5, TimeUnit.SECONDS)
        } catch (_: Exception) {
        } finally {
            shutdownProcess()
        }
    }

    private fun shutdownProcess() {
        try {
            writer?.close()
        } catch (_: Exception) {
        }
        writer = null
        try {
            process?.destroy()
        } catch (_: Exception) {
        }
        process = null
        readerThread = null
        initialized = false
    }

    override fun dispose() {
        shutdownProcess()
    }

    companion object {
        @JvmStatic
        fun getInstance(project: Project): MochiService =
            project.getService(MochiService::class.java)
    }
}
