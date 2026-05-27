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
            return "몽이 시작"
        case .refresh:
            return "상태 새로고침"
        case .health:
            return "상태 점검"
        case .daily:
            return "오늘 요약"
        case .value:
            return "가치 리뷰"
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
            return "대기"
        case .running:
            return "실행 중"
        case .success:
            return "성공"
        case .failed:
            return "실패"
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
