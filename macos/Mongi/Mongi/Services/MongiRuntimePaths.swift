import Foundation

// Mirrors src/runtime/paths.js so the Swift app and the JS monitor agree on
// where runtime files live. State/config/runtime go under
// ~/Library/Application Support/Mongi and logs under ~/Library/Logs/Mongi,
// independent of the project root or the current working directory.
enum MongiRuntimePaths {
    static var appSupportDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        return base.appendingPathComponent("Mongi", isDirectory: true)
    }

    static var logsDirectory: URL {
        URL(fileURLWithPath: NSHomeDirectory())
            .appendingPathComponent("Library/Logs", isDirectory: true)
            .appendingPathComponent("Mongi", isDirectory: true)
    }

    static var stateFile: URL { appSupportDirectory.appendingPathComponent("state.json") }
    static var configFile: URL { appSupportDirectory.appendingPathComponent("config.json") }
    static var runtimeFile: URL { appSupportDirectory.appendingPathComponent("runtime.json") }
    static var commandsFile: URL { appSupportDirectory.appendingPathComponent("commands.json") }
    static var lockFile: URL { appSupportDirectory.appendingPathComponent("monitor.lock") }

    // Best-effort directory creation at app launch. Failures are reported to the
    // console and error.log rather than crashing the app.
    @discardableResult
    static func ensureRuntimeDirectories() -> Bool {
        let fileManager = FileManager.default
        var success = true

        for directory in [appSupportDirectory, logsDirectory] {
            do {
                try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            } catch {
                success = false
                let message = "Failed to create runtime directory \(directory.path): \(error.localizedDescription)\n"
                FileHandle.standardError.write(Data(message.utf8))
                appendError(message)
            }
        }

        return success
    }

    private static func appendError(_ message: String) {
        let errorLog = logsDirectory.appendingPathComponent("error.log")
        guard let data = message.data(using: .utf8) else { return }

        if let handle = try? FileHandle(forWritingTo: errorLog) {
            defer { try? handle.close() }
            handle.seekToEndOfFile()
            handle.write(data)
        } else {
            try? data.write(to: errorLog)
        }
    }
}
