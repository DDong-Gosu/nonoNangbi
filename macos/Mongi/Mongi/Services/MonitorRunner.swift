import Foundation
import Darwin

enum MonitorRunStatus: String, Sendable {
    case idle
    case starting
    case running
    case stopped
    case failed
}

final class MonitorRunner: ObservableObject, @unchecked Sendable {
    static let shared = MonitorRunner()

    @Published private(set) var status: MonitorRunStatus = .idle
    @Published private(set) var pid: Int32?
    @Published private(set) var lastError: String?
    @Published private(set) var monitorSource: String?
    @Published private(set) var nodePath: String?
    @Published private(set) var lastStartSummary: String?

    private var process: Process?
    private var stdoutPipe: Pipe?
    private var stderrPipe: Pipe?
    // A monitor this app launched in a previous session and re-attached to. The
    // app only terminates monitors it owns (this child or an adopted app-owned
    // pid); externally managed monitors (e.g. launchd) are left untouched.
    private var adoptedPid: Int32?
    private let fileManager = FileManager.default

    var isRunning: Bool {
        if let process, process.isRunning { return true }
        if let adoptedPid, MonitorStatusEvaluator.isPidAlive(Int(adoptedPid)) { return true }
        return false
    }

    func start(preferredDevRoot: String = ProjectRootStore.current) {
        if let process, process.isRunning {
            appendMonitorLog("MonitorRunner start skipped: child already running pid=\(process.processIdentifier)")
            return
        }

        // Do not start a second monitor if a healthy one is already running,
        // whether it is ours from a previous session, a launchd run, or any
        // other owner. This is the app-side half of duplicate prevention; the
        // monitor.lock is the process-side half.
        let snapshot = MonitorStatusEvaluator.evaluate()
        if snapshot.effective == .running,
           let existingPid = snapshot.pid,
           Int32(existingPid) != ProcessInfo.processInfo.processIdentifier {
            status = .running
            pid = Int32(existingPid)
            lastError = nil
            if snapshot.owner == MonitorStatusEvaluator.appOwner {
                adoptedPid = Int32(existingPid)
                lastStartSummary = "기존 앱 모니터(pid \(existingPid))에 다시 연결했습니다."
            } else {
                adoptedPid = nil
                lastStartSummary = "다른 소유자(\(snapshot.owner ?? "unknown"))의 모니터가 실행 중이라 새로 시작하지 않았습니다."
            }
            appendMonitorLog("MonitorRunner start skipped: existing monitor pid=\(existingPid) owner=\(snapshot.owner ?? "unknown") mode=\(snapshot.mode ?? "unknown")")
            return
        }

        guard let location = MonitorBundleResolver.resolve(preferredDevRoot: preferredDevRoot) else {
            monitorSource = nil
            fail("monitor entrypoint not found")
            return
        }

        guard let node = NodeResolver.resolve() else {
            nodePath = nil
            fail("node not found")
            return
        }

        MongiRuntimePaths.ensureRuntimeDirectories()

        let process = Process()
        process.executableURL = node.executable
        process.arguments = node.prefixArguments + [location.entrypoint.path, "--loop", "--dry-run-notifications"]
        process.currentDirectoryURL = location.rootDirectory
        process.environment = makeEnvironment(preferredDevRoot: preferredDevRoot, location: location, node: node)
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        self.stdoutPipe = stdoutPipe
        self.stderrPipe = stderrPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        connectPipe(stdoutPipe, to: MongiRuntimePaths.logsDirectory.appendingPathComponent("monitor.log"))
        connectPipe(stderrPipe, to: MongiRuntimePaths.logsDirectory.appendingPathComponent("error.log"))

        status = .starting
        lastError = nil
        monitorSource = location.source
        nodePath = node.displayPath
        adoptedPid = nil

        do {
            try process.run()
            self.process = process
            pid = process.processIdentifier
            status = .running
            lastStartSummary = "새 모니터를 시작했습니다 (pid \(process.processIdentifier))."
            appendMonitorLog("MonitorRunner started pid=\(process.processIdentifier) source=\(location.source) mode=loop node=\(node.displayPath) nodeVersion=\(node.version) cwd=\(location.rootDirectory.path)")

            process.terminationHandler = { [weak self] terminated in
                DispatchQueue.main.async {
                    self?.handleTermination(terminated)
                }
            }
        } catch {
            fail("monitor start failed: \(error.localizedDescription)")
        }
    }

    func stop() {
        // Terminate the child we spawned, if any.
        if let process, process.isRunning {
            terminate(process.processIdentifier, child: process)
            self.process = nil
            clearPipes()
            status = .stopped
            pid = nil
            adoptedPid = nil
            return
        }

        // Otherwise, only terminate a monitor this app owns (adopted from a
        // previous app session). External / launchd monitors are left alone.
        if let adoptedPid, MonitorStatusEvaluator.isPidAlive(Int(adoptedPid)) {
            appendMonitorLog("MonitorRunner terminating adopted app-owned monitor pid=\(adoptedPid)")
            terminate(adoptedPid, child: nil)
        }

        self.process = nil
        clearPipes()
        adoptedPid = nil
        if status == .running || status == .starting {
            status = .stopped
            pid = nil
        }
    }

    func restart(preferredDevRoot: String = ProjectRootStore.current) {
        // Owner-safe restart: only stop monitors this app owns. If a monitor
        // owned by someone else is running, stop() is a no-op and start() will
        // detect it and decline to launch a duplicate.
        let snapshot = MonitorStatusEvaluator.evaluate()
        if process == nil,
           adoptedPid == nil,
           snapshot.effective == .running,
           let owner = snapshot.owner,
           owner != MonitorStatusEvaluator.appOwner {
            lastStartSummary = "다른 소유자(\(owner))의 모니터는 안전을 위해 재시작하지 않습니다."
            appendMonitorLog("MonitorRunner restart skipped: monitor owned by \(owner) is not app-managed")
            return
        }

        stop()
        start(preferredDevRoot: preferredDevRoot)
    }

    private func terminate(_ targetPid: Int32, child: Process?) {
        appendMonitorLog("MonitorRunner stopping pid=\(targetPid)")

        if let child {
            child.terminate()
            let deadline = Date().addingTimeInterval(2)
            while child.isRunning && Date() < deadline {
                RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
            }
            if child.isRunning {
                kill(targetPid, SIGKILL)
                appendMonitorLog("MonitorRunner force killed pid=\(targetPid)")
            }
            return
        }

        kill(targetPid, SIGTERM)
        let deadline = Date().addingTimeInterval(2)
        while MonitorStatusEvaluator.isPidAlive(Int(targetPid)) && Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
        }
        if MonitorStatusEvaluator.isPidAlive(Int(targetPid)) {
            kill(targetPid, SIGKILL)
            appendMonitorLog("MonitorRunner force killed adopted pid=\(targetPid)")
        }
    }

    private func handleTermination(_ process: Process) {
        let exitCode = process.terminationStatus
        appendMonitorLog("MonitorRunner exited pid=\(process.processIdentifier) exit=\(exitCode)")

        if self.process === process {
            self.process = nil
        }

        clearPipes()
        pid = nil

        if exitCode == 0 {
            status = .stopped
            lastError = nil
        } else {
            let message = "monitor exited with code \(exitCode)"
            status = .failed
            lastError = message
            appendErrorLog("MonitorRunner failure: \(message)")
            // The monitor process is gone, so writing here cannot race the JS
            // writer. Record the failure so runtime readers see it explicitly.
            writeRuntimeFailure(message)
        }
    }

    private func fail(_ message: String) {
        status = .failed
        pid = nil
        lastError = message
        appendErrorLog("MonitorRunner failure: \(message)")
        writeRuntimeFailure(message)
    }

    private func makeEnvironment(preferredDevRoot: String, location: MonitorLocation, node: NodeResolution) -> [String: String] {
        var environment = ProcessInfo.processInfo.environment
        let pathPrefix = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        environment["PATH"] = "\(pathPrefix):\(environment["PATH"] ?? "")"
        environment["DRY_RUN_NOTIFICATIONS"] = environment["DRY_RUN_NOTIFICATIONS"] ?? "true"
        environment["MONGI_DISABLE_FILE_LOGGER"] = "true"
        environment["MONGI_MONITOR_OWNER"] = MonitorStatusEvaluator.appOwner
        environment["MONGI_MONITOR_ENTRYPOINT"] = location.entrypoint.path
        environment["MONGI_MONITOR_NODE_PATH"] = node.displayPath

        if ProjectRootStore.exists(preferredDevRoot), ProjectRootStore.looksLikeMongiProject(preferredDevRoot) {
            environment["MONGI_OUTPUT_CWD"] = preferredDevRoot
        }

        return environment
    }

    private func appendMonitorLog(_ message: String) {
        appendLine(message, to: MongiRuntimePaths.logsDirectory.appendingPathComponent("monitor.log"))
    }

    private func appendErrorLog(_ message: String) {
        appendLine(message, to: MongiRuntimePaths.logsDirectory.appendingPathComponent("error.log"))
    }

    private func appendLine(_ message: String, to url: URL) {
        MongiRuntimePaths.ensureRuntimeDirectories()
        let line = "[\(Self.isoNow())] [MonitorRunner] \(ShellResult.sanitize(message))\n"
        guard let data = line.data(using: .utf8) else { return }
        appendData(data, to: url)
    }

    private func connectPipe(_ pipe: Pipe, to url: URL) {
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            self?.appendSanitizedData(data, to: url)
        }
    }

    private func appendSanitizedData(_ data: Data, to url: URL) {
        if let text = String(data: data, encoding: .utf8),
           let sanitized = ShellResult.sanitize(text).data(using: .utf8) {
            appendData(sanitized, to: url)
            return
        }

        appendData(data, to: url)
    }

    private func appendData(_ data: Data, to url: URL) {
        MongiRuntimePaths.ensureRuntimeDirectories()
        if !fileManager.fileExists(atPath: url.path) {
            fileManager.createFile(atPath: url.path, contents: nil)
        }

        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            handle.write(data)
        }
    }

    private func clearPipes() {
        stdoutPipe?.fileHandleForReading.readabilityHandler = nil
        stderrPipe?.fileHandleForReading.readabilityHandler = nil
        stdoutPipe = nil
        stderrPipe = nil
    }

    // Only called when no monitor process is alive (spawn failure or non-zero
    // exit), so this never races the monitor's own runtime.json writes.
    private func writeRuntimeFailure(_ message: String) {
        MongiRuntimePaths.ensureRuntimeDirectories()

        var root = readRuntimeObject()
        root["version"] = root["version"] ?? 1
        var monitor = (root["monitor"] as? [String: Any]) ?? [:]
        monitor["status"] = "failed"
        monitor["pid"] = NSNull()
        monitor["lastError"] = message
        monitor["owner"] = MonitorStatusEvaluator.appOwner
        monitor["updatedAt"] = Self.isoNow()
        root["monitor"] = monitor

        do {
            let data = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: MongiRuntimePaths.runtimeFile, options: .atomic)
        } catch {
            appendErrorLog("runtime write failed: \(error.localizedDescription)")
        }
    }

    private func readRuntimeObject() -> [String: Any] {
        guard let data = try? Data(contentsOf: MongiRuntimePaths.runtimeFile),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }

        return object
    }

    private static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
