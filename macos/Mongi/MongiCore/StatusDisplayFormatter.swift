import Foundation

public enum StatusDisplayFormatter {
    public static func outputLabel(_ outputStatus: String?) -> String {
        switch outputStatus {
        case "NO_OUTPUT":
            return "산출물 없음"
        case "LOCAL_ONLY":
            return "로컬 작업만 있음"
        case "SHIPPED":
            return "오늘 푸시함"
        default:
            return "상태 확인 안 됨"
        }
    }

    public static func outputMeaning(_ outputStatus: String?) -> String {
        switch outputStatus {
        case "NO_OUTPUT":
            return "오늘 감지된 로컬 변경이나 푸시가 없습니다."
        case "LOCAL_ONLY":
            return "로컬 변경이 있습니다. 아직 푸시되지 않았습니다."
        case "SHIPPED":
            return "오늘 GitHub에 올라간 작업이 있습니다."
        default:
            return "Git output 상태를 아직 읽지 못했습니다."
        }
    }

    public static func percentText(_ value: Int?) -> String {
        guard let value else {
            return "확인 안 됨"
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
            return "확인 안 됨"
        }

        let seconds = Int(date.timeIntervalSince(now))

        if seconds <= 0 {
            return "지금"
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
            return "확인 안 됨"
        }

        return date.formatted(date: .omitted, time: .shortened)
    }

    public static func usageSummary(provider: String, shortRemaining: Int?, weeklyRemaining: Int?) -> String {
        "\(provider) 남음 \(percentText(shortRemaining)) / \(percentText(weeklyRemaining))"
    }

    public static func shortRemainingLabel(provider: String) -> String {
        provider.lowercased() == "claude" ? "세션 남음" : "5시간 남음"
    }

    public static func weeklyRemainingLabel(provider: String) -> String {
        provider.lowercased() == "claude" ? "전체 남음" : "주간 남음"
    }

    public static func shortUsedLabel(provider: String) -> String {
        provider.lowercased() == "claude" ? "세션 사용" : "5시간 사용"
    }

    public static func weeklyUsedLabel(provider: String) -> String {
        provider.lowercased() == "claude" ? "전체 사용" : "주간 사용"
    }

    public static func shortGaugeTitle(provider: String) -> String {
        provider.lowercased() == "claude" ? "세션" : "5시간"
    }

    public static func weeklyGaugeTitle(provider: String) -> String {
        provider.lowercased() == "claude" ? "전체" : "주간"
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
