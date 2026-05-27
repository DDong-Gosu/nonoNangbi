import Foundation

public enum StatusDisplayFormatter {
    public static func outputMeaning(_ outputStatus: String?) -> String {
        switch outputStatus {
        case "NO_OUTPUT":
            return "No shipped or local Git output detected."
        case "LOCAL_ONLY":
            return "Local work exists. Ship it today."
        case "SHIPPED":
            return "Git output detected today."
        default:
            return "Git output status unavailable."
        }
    }

    public static func percentText(_ value: Int?) -> String {
        guard let value else {
            return "unavailable"
        }

        return "\(clampedPercent(value))%"
    }

    public static func progress(_ value: Int?) -> Double {
        guard let value else {
            return 0
        }

        return Double(clampedPercent(value)) / 100
    }

    public static func resetCountdown(resetAt: String?, now: Date = Date()) -> String {
        guard let resetAt, let date = parseIsoDate(resetAt) else {
            return "unavailable"
        }

        let seconds = Int(date.timeIntervalSince(now))

        if seconds <= 0 {
            return "now"
        }

        let days = seconds / 86_400
        let hours = (seconds % 86_400) / 3_600
        let minutes = (seconds % 3_600) / 60

        if days > 0 {
            return "\(days)d \(hours)h"
        }

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }

        return "\(max(minutes, 1))m"
    }

    public static func compactTime(_ isoString: String?) -> String {
        guard let isoString, let date = parseIsoDate(isoString) else {
            return "unknown"
        }

        return date.formatted(date: .omitted, time: .shortened)
    }

    private static func clampedPercent(_ value: Int) -> Int {
        min(100, max(0, value))
    }

    private static func parseIsoDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        if let date = formatter.date(from: value) {
            return date
        }

        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: value) {
            return date
        }

        return nil
    }
}
