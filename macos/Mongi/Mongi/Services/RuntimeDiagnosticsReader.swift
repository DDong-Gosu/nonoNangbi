import Foundation

struct RuntimeDiagnosticsSnapshot: Sendable {
    var status: String?
    var effectiveStatus: String?
    var pid: Int?
    var pidAlive: Bool = false
    var startedAt: String?
    var lastHeartbeatAt: String?
    var heartbeatAgeSeconds: Double?
    var updatedAt: String?
    var lastError: String?
    var owner: String?
    var mode: String?
    var entrypoint: String?
    var nodePath: String?
    var lockPid: Int?
    var lockOwner: String?
    var lockMode: String?
    var lockAlive: Bool = false
    var hasLock: Bool = false
}

enum RuntimeDiagnosticsReader {
    static func read() -> RuntimeDiagnosticsSnapshot {
        let evaluated = MonitorStatusEvaluator.evaluate()

        return RuntimeDiagnosticsSnapshot(
            status: redacted(evaluated.recorded),
            effectiveStatus: evaluated.effective.rawValue,
            pid: evaluated.pid,
            pidAlive: evaluated.pidAlive,
            startedAt: redacted(evaluated.startedAt),
            lastHeartbeatAt: redacted(evaluated.lastHeartbeatAt),
            heartbeatAgeSeconds: evaluated.heartbeatAgeSeconds,
            updatedAt: redacted(evaluated.updatedAt),
            lastError: redacted(evaluated.lastError),
            owner: redacted(evaluated.owner),
            mode: redacted(evaluated.mode),
            entrypoint: redacted(evaluated.entrypoint),
            nodePath: redacted(evaluated.nodePath),
            lockPid: evaluated.lock?.pid,
            lockOwner: redacted(evaluated.lock?.owner),
            lockMode: redacted(evaluated.lock?.mode),
            lockAlive: evaluated.lock?.alive ?? false,
            hasLock: evaluated.lock != nil
        )
    }

    private static func redacted(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return DiagnosticsRedactor.redact(value)
    }
}
