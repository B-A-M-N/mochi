plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.0.21"
    id("org.jetbrains.intellij.platform") version "2.3.0"
}

group = "dev.mochi"
version = "0.1.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.1")
        instrumentationTools()
    }
}

kotlin {
    jvmToolchain(17)
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "dev.mochi.jetbrains"
        name = "Mochi AI Agent"
        version = project.version.toString()
        description = "Mochi AI agent integration for JetBrains IDEs via ACP (mochi acp stdio JSON-RPC)."
        vendor {
            name = "Mochi"
            url = "https://github.com/mochi"
        }
        ideaVersion {
            sinceBuild = "241"
        }
    }
}

tasks {
    buildSearchableOptions {
        enabled = false
    }
    patchPluginXml {
        sinceBuild.set("241")
    }
}
