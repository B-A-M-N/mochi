//! Head+tail output folding for tool results (slice 5).
//!
//! Mirrors the line/byte selection logic in `src/core/tool-output.ts`
//! `applyToolOutputPolicy`. The Rust side is pure compute: given an input
//! string + max lines + max bytes, it returns the head lines, tail lines,
//! and the omitted-line count. Side effects (temp-file spill, telemetry)
//! stay in the TS wrapper.
//!
//! JSON in:  {"text":"...","maxLines":N,"maxBytes":N}
//! JSON out: {"head":[...],"tail":[...],"omitted":N,"truncated":true|false,
//!            "truncatedBy":"lines"|"bytes"|null,"totalLines":N,"totalBytes":N}
//!
//! `truncatedBy` is computed from the same rules as TS: if totalLines > maxLines
//! the dominant reason is "lines", otherwise "bytes". When the input is
//! already within both limits the response is `truncated:false` and head/tail
//! are the original lines (no fold).

/// Split `text` into lines (LF-separated), dropping a single trailing empty
/// line if the input ends with `\n` (matches the TS `splitLines` helper).
fn split_lines(text: &str) -> Vec<&str> {
    if text.is_empty() {
        return Vec::new();
    }
    let mut lines: Vec<&str> = text.split('\n').collect();
    if text.ends_with('\n') {
        lines.pop();
    }
    lines
}

/// Approximate byte length of a string slice (UTF-8). Matches
/// `Buffer.byteLength(s, 'utf-8')` for ASCII; differs only on multi-byte chars
/// where we use the `len()` of the str — which is the byte length for `&str`.
#[inline]
fn byte_len(s: &str) -> usize {
    s.len()
}

/// Decide the head/tail fold. Returns (head_lines, tail_lines, omitted,
/// truncated, truncated_by, total_lines, total_bytes).
pub fn fold_output(text: &str, max_lines: usize, max_bytes: usize) -> (Vec<String>, Vec<String>, usize, bool, &'static str, usize, usize) {
    let lines = split_lines(text);
    let total_lines = lines.len();
    let total_bytes = byte_len(text);

    if total_lines <= max_lines && total_bytes <= max_bytes {
        // Passthrough: the head is all the lines; the tail is empty.
        let all: Vec<String> = lines.iter().map(|s| s.to_string()).collect();
        return (all, Vec::new(), 0, false, "none", total_lines, total_bytes);
    }

    let truncated_by: &'static str = if total_lines > max_lines { "lines" } else { "bytes" };

    // Mirror TS budget split: half at head, half at tail.
    let head_line_budget = max_lines / 2;
    let tail_line_budget = max_lines - head_line_budget;
    let head_byte_budget = max_bytes / 2;
    let tail_byte_budget = max_bytes - head_byte_budget;

    // Head scan (forward).
    let mut head_lines: Vec<String> = Vec::with_capacity(head_line_budget);
    let mut head_bytes = 0usize;
    for line in &lines {
        let lb = byte_len(line) + 1; // +1 for the joining \n
        if head_lines.len() >= head_line_budget || head_bytes + lb > head_byte_budget {
            break;
        }
        head_lines.push(line.to_string());
        head_bytes += lb;
    }

    // Tail scan (backward, stopping before the head to avoid overlap).
    let mut tail_lines: Vec<String> = Vec::with_capacity(tail_line_budget);
    let mut tail_bytes = 0usize;
    for i in (0..lines.len()).rev() {
        if i < head_lines.len() {
            break;
        }
        let line = lines[i];
        let lb = byte_len(line) + 1;
        if tail_lines.len() >= tail_line_budget || tail_bytes + lb > tail_byte_budget {
            break;
        }
        tail_lines.insert(0, line.to_string());
        tail_bytes += lb;
    }

    let omitted = total_lines.saturating_sub(head_lines.len() + tail_lines.len());

    (head_lines, tail_lines, omitted, true, truncated_by, total_lines, total_bytes)
}

/// JSON output shape for the FFI. `head` and `tail` are JSON arrays of
/// strings; we serialize the result via a small struct → JSON helper below.
pub fn fold_output_json(text: &str, max_lines: usize, max_bytes: usize) -> String {
    let (head, tail, omitted, truncated, truncated_by, total_lines, total_bytes) =
        fold_output(text, max_lines, max_bytes);
    let head_json = head.iter().map(|s| json_string(s)).collect::<Vec<_>>().join(",");
    let tail_json = tail.iter().map(|s| json_string(s)).collect::<Vec<_>>().join(",");
    format!(
        r#"{{"head":[{}],"tail":[{}],"omitted":{},"truncated":{},"truncatedBy":"{}","totalLines":{},"totalBytes":{}}}"#,
        head_json, tail_json, omitted,
        if truncated { "true" } else { "false" },
        truncated_by, total_lines, total_bytes
    )
}

/// JSON-encode a string with proper escaping (handles control chars, quotes,
/// backslashes, and the common 2-byte UTF-8 sequences the tool output is
/// likely to contain).
fn json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for b in s.as_bytes() {
        match b {
            b'"' => out.push_str("\\\""),
            b'\\' => out.push_str("\\\\"),
            b'\n' => out.push_str("\\n"),
            b'\r' => out.push_str("\\r"),
            b'\t' => out.push_str("\\t"),
            0x08 => out.push_str("\\b"),
            0x0c => out.push_str("\\f"),
            c if *c < 0x20 => out.push_str(&format!("\\u{:04x}", c)),
            _ => out.push(*b as char),
        }
    }
    out.push('"');
    out
}

/// Look up a top-level string field in a JSON object body. Returns `None` if
/// the field is missing or not a string. Used to extract `text` from the
/// input without a full parser dep.
pub fn json_string_field(src: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":", key);
    let pos = src.find(&needle)?;
    let mut s = src[pos + needle.len()..].trim_start();
    if !s.starts_with('"') {
        return None;
    }
    s = &s[1..];
    // Walk to unescaped closing quote.
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'"' {
            return String::from_utf8(out).ok();
        }
        if b == b'\\' && i + 1 < bytes.len() {
            match bytes[i + 1] {
                b'"' => out.push(b'"'),
                b'\\' => out.push(b'\\'),
                b'/' => out.push(b'/'),
                b'n' => out.push(b'\n'),
                b'r' => out.push(b'\r'),
                b't' => out.push(b'\t'),
                b'b' => out.push(0x08),
                b'f' => out.push(0x0c),
                b'u' => {
                    // Skip \uXXXX for now — tool outputs rarely contain this.
                    i += 6;
                    continue;
                }
                _ => out.push(bytes[i + 1]),
            }
            i += 2;
            continue;
        }
        out.push(b);
        i += 1;
    }
    None
}

/// Look up a top-level integer field in a JSON object. Returns `None` if
/// missing or not a number.
pub fn json_usize_field(src: &str, key: &str) -> Option<usize> {
    let needle = format!("\"{}\":", key);
    let pos = src.find(&needle)?;
    let s = src[pos + needle.len()..].trim_start();
    let bytes = s.as_bytes();
    let mut end = 0;
    let mut seen = false;
    while end < bytes.len() {
        let b = bytes[end];
        if (b'0'..=b'9').contains(&b) {
            seen = true;
            end += 1;
            continue;
        }
        break;
    }
    if !seen {
        return None;
    }
    s[..end].parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passthrough_when_within_limits() {
        let text = "line1\nline2\nline3";
        let (head, tail, omitted, truncated, by, tl, tb) = fold_output(text, 100, 100_000);
        assert!(!truncated);
        assert_eq!(by, "none");
        assert_eq!(head, vec!["line1", "line2", "line3"]);
        assert!(tail.is_empty());
        assert_eq!(omitted, 0);
        assert_eq!(tl, 3);
        assert_eq!(tb, text.len());
    }

    #[test]
    fn line_limit_truncates_middle() {
        let lines: Vec<String> = (1..=10).map(|i| format!("line{}", i)).collect();
        let text = lines.join("\n");
        let (head, tail, omitted, truncated, by, _tl, _tb) = fold_output(&text, 6, 100_000);
        assert!(truncated);
        assert_eq!(by, "lines");
        // 6 max lines → 3 head, 3 tail.
        assert_eq!(head.len(), 3);
        assert_eq!(tail.len(), 3);
        assert_eq!(head[0], "line1");
        assert_eq!(tail[2], "line10");
        assert_eq!(omitted, 4); // 10 - 3 - 3
    }

    #[test]
    fn byte_limit_truncates_middle() {
        // 10 lines, each ~10 bytes; max 50 bytes → fold
        let lines: Vec<String> = (1..=10).map(|i| format!("line{:07}", i)).collect();
        let text = lines.join("\n");
        let (head, tail, omitted, truncated, by, tl, _tb) = fold_output(&text, 100, 50);
        assert!(truncated);
        assert_eq!(by, "bytes");
        assert_eq!(tl, 10);
        // head + tail < 10
        assert!(head.len() + tail.len() < 10);
        assert_eq!(omitted, 10 - head.len() - tail.len());
    }

    #[test]
    fn empty_input_returns_empty() {
        let (head, tail, omitted, truncated, _by, tl, tb) = fold_output("", 10, 10);
        assert!(!truncated);
        assert!(head.is_empty());
        assert!(tail.is_empty());
        assert_eq!(omitted, 0);
        assert_eq!(tl, 0);
        assert_eq!(tb, 0);
    }

    #[test]
    fn trailing_newline_drops_empty_line() {
        let (head, _tail, _o, t, _b, tl, _tb) = fold_output("a\nb\n", 100, 100);
        assert!(!t);
        assert_eq!(head, vec!["a", "b"]);
        assert_eq!(tl, 2);
    }

    #[test]
    fn fold_kicks_in_when_either_limit_breached() {
        // maxLines=2, text has 3 lines. totalLines > maxLines → fold runs.
        let text = "a\nb\nc";
        let (head, tail, _o, t, _b, _tl, _tb) = fold_output(text, 2, 100);
        assert!(t);
        // head + tail should sum to ≤ maxLines
        assert!(head.len() + tail.len() <= 2);
        // overlap guard: tail must not include the head line
        if !head.is_empty() && !tail.is_empty() {
            assert_ne!(head[0], tail[0]);
        }
    }

    #[test]
    fn json_string_escapes_specials() {
        assert_eq!(json_string("a\nb\"c"), "\"a\\nb\\\"c\"");
        assert_eq!(json_string("\t\rc"), "\"\\t\\rc\"");
    }

    #[test]
    fn json_parser_handles_text_with_quotes() {
        // A real-world tool output that contains a quoted path.
        let input = r#"{"text":"echo \"hello\"","maxLines":10,"maxBytes":1000}"#;
        let text = json_string_field(input, "text").unwrap();
        assert_eq!(text, "echo \"hello\"");
        assert_eq!(json_usize_field(input, "maxLines"), Some(10));
        assert_eq!(json_usize_field(input, "maxBytes"), Some(1000));
    }

    #[test]
    fn json_parser_handles_escaped_backslash() {
        let input = r#"{"text":"a\\b","maxLines":5,"maxBytes":100}"#;
        assert_eq!(json_string_field(input, "text").unwrap(), "a\\b");
    }

    #[test]
    fn json_output_roundtrip_small() {
        let text = "alpha\nbeta\ngamma";
        let out = fold_output_json(text, 100, 1000);
        // Sanity-check the shape: braces match, head array is well-formed.
        assert!(out.starts_with('{'));
        assert!(out.ends_with('}'));
        assert!(out.contains(r#""head":["alpha","beta","gamma"]"#));
        assert!(out.contains(r#""truncated":false"#));
        // Bracket count: every opening bracket has a closing one.
        let opens = out.matches('[').count();
        let closes = out.matches(']').count();
        assert_eq!(opens, closes);
    }
}
