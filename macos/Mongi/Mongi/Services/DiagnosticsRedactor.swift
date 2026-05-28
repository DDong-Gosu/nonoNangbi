import Foundation

enum DiagnosticsRedactor {
    static func redact(_ value: String) -> String {
        ShellResult.sanitize(value)
            .replacingOccurrences(
                of: #"(access_token|refresh_token|id_token|session|sessionid)["']?\s*[:=]\s*["']?[^"',\s}]+"#,
                with: "$1=[REDACTED]",
                options: [.regularExpression, .caseInsensitive]
            )
            .replacingOccurrences(
                of: #"(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+"#,
                with: "$1 [REDACTED]",
                options: [.regularExpression, .caseInsensitive]
            )
    }
}
