import Foundation

struct MongiStatus: Codable, Sendable {
    var generatedAt: String?
    var overallStatus: String?
    var nextAction: String?
    var health: Health?
    var output: Output?
    var usage: Usage?
    var today: Today?
    var policy: Policy?
    var warnings: [String]?
    var historyWarnings: [String]?
    var statusMeta: StatusMeta?

    struct StatusMeta: Codable, Sendable {
        var recentWindowMinutes: Int?
        var staleWindowMinutes: Int?
        var latestRunHealthy: Bool?
        var latestFailureAgeMinutes: Int?
        var oldFailuresToday: Int?
    }

    struct Health: Codable, Sendable {
        var envFound: Bool?
        var discordWebhookConfigured: Bool?
        var browserMode: String?
        var cdpReachable: Bool?
        var launchdInstalled: Bool?
        var launchdLoaded: Bool?
        var quietHoursActive: Bool?
    }

    struct Output: Codable, Sendable {
        var outputStatus: String?
        var displayLabel: String?
        var displayMeaning: String?
        var reason: String?
        var hasLocalChanges: Bool?
        var hasUnpushedCommits: Bool?
        var hasShippedToday: Bool?
        var quietHoursActive: Bool?
        var checkedAt: String?
        var repository: Repository?
    }

    struct Repository: Codable, Sendable {
        var available: Bool?
        var root: String?
        var branch: String?
        var upstream: String?
    }

    struct Usage: Codable, Sendable {
        var codex: ServiceUsage?
        var claude: ServiceUsage?
    }

    struct ServiceUsage: Codable, Sendable {
        var sourceKey: String?
        var backend: String?
        var status: String?
        var freshness: String?
        var shortRemaining: Int?
        var weeklyRemaining: Int?
        var shortUsed: Int?
        var weeklyUsed: Int?
        var shortMeaning: String?
        var weeklyMeaning: String?
        var shortLabel: String?
        var weeklyLabel: String?
        var shortResetAt: String?
        var weeklyResetAt: String?
        var failures: Int?
        var lastCheckedAt: String?
        var lastAttemptedAt: String?
        var lastSuccessfulCheckedAt: String?
        var lastParseFailedAt: String?
        var lastParseFailureReason: String?
        var stale: Bool?
        var consecutiveFailures: Int?
        var lastFreshReadAt: String?
        var lastAttemptAt: String?
        var sourceReloadedAt: String?
        var readAfterReload: Bool?
        var candidateCount: Int?
        var exactConfiguredUrlMatch: Bool?
        var sourceUrlGuardPassed: Bool?
        var expectedUsageLabelsPresent: Bool?
        var freshnessDecisionReason: String?
        var lastError: String?
        var lastRecoveryAction: String?
        var lastReloadAt: String?
        var reloadCooldownRemainingMs: Int?
        var targetFound: Bool?
        var target: Target?
    }

    struct Target: Codable, Sendable {
        var targetId: String?
        var url: String?
        var title: String?
        var matchType: String?
        var exactConfiguredUrlMatch: Bool?
        var sourceUrlGuardPassed: Bool?
    }

    struct Today: Codable, Sendable {
        var runs: Int?
        var successful: Int?
        var failed: Int?
        var notificationsSent: Int?
        var events: [String: Int]?
        var quietHoursSuppressionHint: Bool?
        var latestRun: String?
        var latestExitCode: Int?
        var recentErrorsCount: Int?
    }

    struct Policy: Codable, Sendable {
        var source: String?
        var notifications: Notifications?
        var thresholds: Thresholds?
        var quietHours: QuietHours?
        var message: Message?
        var services: Services?
    }

    struct Notifications: Codable, Sendable {
        var recoveredShort: Bool?
        var recoveredWeekly: Bool?
        var sessionStopped: Bool?
        var weeklyIdle: Bool?
        var diagnostics: Bool?
    }

    struct Thresholds: Codable, Sendable {
        var sessionStoppedMinutes: Int?
        var weeklyIdleReminderHours: Int?
        var diagnosticReminderHours: Int?
    }

    struct QuietHours: Codable, Sendable {
        var enabled: Bool?
        var startHour: Int?
        var endHour: Int?
    }

    struct Message: Codable, Sendable {
        var intensity: String?
    }

    struct Services: Codable, Sendable {
        var codex: ServicePolicy?
        var claude: ServicePolicy?
    }

    struct ServicePolicy: Codable, Sendable {
        var enabled: Bool?
        var weeklyIdleEnabled: Bool?
    }
}
