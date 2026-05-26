import Foundation

enum CommandKind: String, CaseIterable, Identifiable, Sendable {
    case start
    case refresh
    case health
    case daily
    case value

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .start:
            return "Start Mongi"
        case .refresh:
            return "Refresh Status"
        case .health:
            return "Health Check"
        case .daily:
            return "Daily Summary"
        case .value:
            return "Value Review"
        }
    }

    var script: String {
        switch self {
        case .start:
            return "start:chrome"
        case .refresh:
            return "status:json"
        case .health:
            return "health"
        case .daily:
            return "daily:summary"
        case .value:
            return "value:review"
        }
    }
}

enum CommandRunStatus: Sendable, Equatable {
    case idle
    case running
    case success
    case failed

    var label: String {
        switch self {
        case .idle:
            return "Idle"
        case .running:
            return "Running"
        case .success:
            return "Success"
        case .failed:
            return "Failed"
        }
    }
}

struct CommandRecord: Sendable {
    var status: CommandRunStatus = .idle
    var lastRunAt: Date?
    var exitCode: Int32?
    var summary: String?
}

struct CommandOutput: Identifiable, Sendable {
    let id = UUID()
    let title: String
    let output: String
    let result: ShellResult
    let ranAt: Date
}
