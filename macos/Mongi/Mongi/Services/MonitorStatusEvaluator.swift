import Foundation
import Darwin

// Effective monitor status, mirroring computeMonitorStatus() in
// src/runtime/runtimeMeta.js. A recorded "running" status is only trusted when
// the pid is alive and the heartbeat is recent; otherwise it is reported as
// crashed (dead pid) or stale (silent heartbeat).
enum EffectiveMonitorStatus: String, Sendable {
    case running
    case starting
    case stopped
    case stale
    case crashed
    case failed
    case unknown
}

struct MonitorLockInfo: Sendable {
    var pid: Int?
    var owner: String?
    var mode: String?
    var alive: Bool
}

struct MonitorRuntimeStatus: Sendable {
    var recorded: String?
    var effective: EffectiveMonitorStatus
    var pid: Int?
    var pidAlive: Bool
    var owner: String?
    var mode: String?
    var heartbeatAgeSeconds: Double?
    var lastHeartbeatAt: String?
    var startedAt: String?
    var updatedAt: String?
    var entrypoint: String?
    var nodePath: String?
    var lastError: String?
    var lock: MonitorLockInfo?
}

enum MonitorStatusEvaluator {
    static let appOwner = "Mongi.app"

    // Must match DEFAULT_HEARTBEAT_STALE_MS in runtimeMeta.js.
    static let heartbeatStaleSeconds: Double = 90

    static func isPidAlive(_ pid: Int) -> Bool {
        guard pid > 0 else { return false }
        let result = kill(pid_t(pid), 0)
        if result == 0 { return true }
        return errno == EPERM
    }

    static func evaluate(now: Date = Date()) -> MonitorRuntimeStatus {
        let monitor = readMonitorObject()
        let lock = readLock()

        let recorded = string(monitor?["status"])
        let pid = int(monitor?["pid"])
        let lastHeartbeatAt = string(monitor?["lastHeartbeatAt"])
        let heartbeatAge = age(lastHeartbeatAt, now: now)
        let pidAlive = pid.map(isPidAlive) ?? false

        var effective = mapRecorded(recorded)

        if recorded == "running" || recorded == "starting" {
            if pid == nil {
                effective = .unknown
            } else if !pidAlive {
                effective = .crashed
            } else if let age = heartbeatAge, age > heartbeatStaleSeconds {
                effective = .stale
            } else {
                effective = .running
            }
        }

        return MonitorRuntimeStatus(
            recorded: recorded,
            effective: effective,
            pid: pid,
            pidAlive: pidAlive,
            owner: string(monitor?["owner"]) ?? string(monitor?["managedBy"]),
            mode: string(monitor?["mode"]),
            heartbeatAgeSeconds: heartbeatAge,
            lastHeartbeatAt: lastHeartbeatAt,
            startedAt: string(monitor?["startedAt"]),
            updatedAt: string(monitor?["updatedAt"]),
            entrypoint: string(monitor?["entrypoint"]) ?? string(monitor?["monitorPath"]),
            nodePath: string(monitor?["nodePath"]),
            lastError: string(monitor?["lastError"]),
            lock: lock
        )
    }

    static func readLock() -> MonitorLockInfo? {
        guard let data = try? Data(contentsOf: MongiRuntimePaths.lockFile),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        let pid = int(object["pid"])
        return MonitorLockInfo(
            pid: pid,
            owner: string(object["owner"]),
            mode: string(object["mode"]),
            alive: pid.map(isPidAlive) ?? false
        )
    }

    private static func readMonitorObject() -> [String: Any]? {
        guard let data = try? Data(contentsOf: MongiRuntimePaths.runtimeFile),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let monitor = object["monitor"] as? [String: Any] else {
            return nil
        }
        return monitor
    }

    private static func mapRecorded(_ recorded: String?) -> EffectiveMonitorStatus {
        guard let recorded else { return .unknown }
        return EffectiveMonitorStatus(rawValue: recorded) ?? .unknown
    }

    private static func age(_ iso: String?, now: Date) -> Double? {
        guard let iso, let date = parseIso(iso) else { return nil }
        return now.timeIntervalSince(date)
    }

    private static func parseIso(_ iso: String) -> Date? {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractional.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        return plain.date(from: iso)
    }

    private static func string(_ value: Any?) -> String? {
        guard let value, !(value is NSNull) else { return nil }
        if let value = value as? String, !value.isEmpty {
            return value
        }
        return nil
    }

    private static func int(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? NSNumber { return value.intValue }
        return nil
    }
}
