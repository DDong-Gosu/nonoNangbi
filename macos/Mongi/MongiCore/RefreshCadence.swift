public enum RefreshCadence: String, CaseIterable, Identifiable, Sendable {
    case manual
    case fiveMinutes = "5m"
    case tenMinutes = "10m"
    case fifteenMinutes = "15m"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .manual:
            return "Manual"
        case .fiveMinutes:
            return "5m"
        case .tenMinutes:
            return "10m"
        case .fifteenMinutes:
            return "15m"
        }
    }

    public var intervalSeconds: Int? {
        switch self {
        case .manual:
            return nil
        case .fiveMinutes:
            return 5 * 60
        case .tenMinutes:
            return 10 * 60
        case .fifteenMinutes:
            return 15 * 60
        }
    }

    public static var defaultCadence: RefreshCadence {
        .fiveMinutes
    }

    public static func validated(rawValue: String?) -> RefreshCadence {
        guard let rawValue, let cadence = RefreshCadence(rawValue: rawValue) else {
            return defaultCadence
        }

        return cadence
    }
}
