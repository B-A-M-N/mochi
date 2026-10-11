//! Prompt token estimation and 64-bit FNV-1a KV-cache hash signature calculator.

pub fn fnv1a_64_hash(bytes: &[u8]) -> u64 {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    let mut hash = FNV_OFFSET;
    for &byte in bytes {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

pub fn estimate_tokens_approx(text: &str) -> usize {
    let bytes = text.len();
    if bytes == 0 {
        return 0;
    }
    // Standard approximation: ~4 characters / bytes per token for English & code
    (bytes + 3) / 4
}

/// Zero-regex high-speed ANSI escape code stripper. Handles the full CSI
/// sequence set (any final byte 0x40-0x7E) so it matches the TS regex
/// `\x1b\[[0-9;]*[A-Za-z]` byte-for-byte: SGR colors, cursor moves,
/// line/column erases, mode sets, etc. — all the way the model would
/// expect a "strip ANSI" pass to behave.
pub fn strip_ansi(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        // CSI = ESC '[' ... <final byte 0x40-0x7E>
        if bytes[i] == 0x1b && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            i += 2;
            // Consume parameter bytes (0x30-0x3F), intermediate bytes
            // (0x20-0x2F), then the final byte (0x40-0x7E). Matches the
            // TS `\x1b\[[0-9;]*[A-Za-z]` plus 0x40-0x7E range.
            while i < bytes.len() {
                let b = bytes[i];
                if b >= 0x40 && b <= 0x7e {
                    i += 1; // consume final byte
                    break;
                }
                i += 1; // parameter or intermediate byte
            }
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).unwrap_or_else(|_| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi() {
        assert_eq!(strip_ansi("\x1b[31mHello\x1b[0m World"), "Hello World");
        assert_eq!(strip_ansi("No ANSI"), "No ANSI");
        // Full CSI coverage — must match the TS regex which accepts any
        // letter (A-Z, a-z) as the terminator. Cursor moves (K), line
        // clears (2J), mode sets (h/l) are all common in real tool output.
        assert_eq!(strip_ansi("a\x1b[2Kb\x1b[1;32mgreen\x1b[0m"), "abgreen");
        assert_eq!(strip_ansi("\x1b[?25lhidden"), "hidden");
        assert_eq!(strip_ansi("a\x1b[Hreset"), "areset");
        assert_eq!(strip_ansi("plain\x1b[2J"), "plain");
        // OSC sequences (ESC ']') are not CSI — leave alone.
        assert_eq!(strip_ansi("\x1b]0;title\x07keep"), "\x1b]0;title\x07keep");
    }

    #[test]
    fn test_estimate_tokens() {
        assert_eq!(estimate_tokens_approx("abcd"), 1);
        assert_eq!(estimate_tokens_approx(""), 0);
    }
}
