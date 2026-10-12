---
name: reverse-engineering-binaries
description: Analyze compiled binaries and protocols — static analysis triage, dynamic instrumentation, format/file-carving, and deobfuscation workflow. Use when given a binary, firmware, or unknown file format to understand; interoperating with undocumented protocols; or analyzing potentially malicious files.
---

# Reverse Engineering Procedure

RE is disciplined curiosity: enumerate what the thing IS before guessing what it DOES, and never execute untrusted code on your real machine.

## 1. Triage (identify before analysis)
- `file`, `strings`, `binwalk`, `lief`/`pefile` for headers; entropy scan (`binwalk -E`) distinguishes code from packed/compressed blobs (high entropy everywhere = packed or encrypted).
- Compiler/origin fingerprints: section names (`.go.buildinfo`, `__TEXT`), PDB paths, build IDs, Go/Rust/Nim runtime signatures — the toolchain tells you which decompiler settings and library signatures apply.
- Safety perimeter: analyze in a VM/container snapshot; malware samples never on the host network. Static analysis first — most questions answer without execution.

## 2. Static analysis (the map)
- Decompilers: Ghidra (free, scriptable in Java/Python), IDA (best-in-class), Binary Ninja. Start at `main`/entry, follow the interesting strings and imports — `strings -n 8` + imports list is the map's legend.
- Symbol recovery: strip nothing yet — FLIRT/signature matching identifies library functions so you read only the AUTHOR'S code, not libc's malloc for the 50th time.
- Annotate as you go (rename, comment); a decompilation you can't navigate is a maze. Save/reload the annotated database.

## 3. Dynamic analysis (the ground truth)
- Instrument at the boundary that matters: `ltrace`/`strace` for syscalls/libc (network, file access, crypto calls reveal intent fast), `frida` hooks for targeted function interception, gdb/lldb for state inspection at breakpoints.
- The crypto-shortcut: hook entropy sources and crypto APIs — keys/material appear at the boundary; you don't reverse the algorithm, you read its inputs/outputs.
- Anti-debug patterns (ptrace checks, timing checks, IsDebuggerPresent): neutralize via environment emulation (qemu-user), patching, or a framework that hides (ScyllaHide-class). Note each check found — its presence is itself information.

## 4. File formats and protocols
- Magic bytes + structure inference: hex-dump the head, guess field boundaries, validate by round-trip (write a parser, feed it every sample you have, diff outputs).
- Protocol RE: capture real traffic first (wireshark/mitmproxy with a pinned client), correlate bytes to behavior (change an input, diff the frame) — a protocol you can drive is a protocol you understand.
- kaitai-struct for format specs: declarative, testable, and the spec doubles as documentation.

## 5. Deobfuscation and deeper layers
- Packed binaries: unpack (find the OEP via memory-dump after self-decompression) or emulate; unpacked code = back to static analysis.
- VM-based obfuscation (custom bytecode interpreters): identify the dispatcher loop, extract the bytecode + handler semantics, write a lifter — the last 5% costs 95% of the effort; confirm the goal actually needs it.
- Scripted hooks beat manual stepping: every analysis session writes its frida/idapython script into the case folder — reproducible analysis beats memory.

## 6. Deliverable discipline
- The product is a WRITTEN spec: file layout, algorithm pseudocode, protocol state machine, IOCs if malicious. An undocumented RE session is lost work.
- Verify claims by round-trip: your parser/protocol-client/hook demonstrably produces the observed behavior.

## Pitfalls
- Reading decompiled output top-to-bottom like prose: navigate by data flow from interesting inputs (network, file, user) — the call graph is a graph, not a novel.
- Executing the sample to "see what happens" outside a disposable environment: the sample sees your real filesystem, browser sessions, and wallet extensions.
- Over-decompiling: if the goal is the file format or one config value, stop when you have it — completeness is not the objective.
