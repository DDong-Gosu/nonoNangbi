import Foundation

struct ShellResult: Sendable {
    let stdout: String
    let stderr: String
    let exitCode: Int32
    let commandDescription: String
    let workingDirectory: String
    let errorSummary: String?
    let npmPathCandidates: [String]
    let resolvedNpmPath: String?

    var succeeded: Bool {
        exitCode == 0
    }

    var combinedOutput: String {
        if stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return stdout
        }

        if stdout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return stderr
        }

        return "\(stdout)\n\(stderr)"
    }

    var sanitizedCombinedOutput: String {
        Self.sanitize(combinedOutput)
    }

    static func sanitize(_ output: String) -> String {
        output
            .replacingOccurrences(
                of: #"https://(?:canary\.)?discord(?:app)?\.com/api/webhooks/\S+"#,
                with: "[REDACTED_DISCORD_WEBHOOK]",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"DISCORD_WEBHOOK_URL\s*=\s*\S+"#,
                with: "[REDACTED_DISCORD_WEBHOOK_ENV]",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"(authorization|cookie|token|password)["']?\s*[:=]\s*["']?[^"',\s}]+"#,
                with: "$1=[REDACTED]",
                options: [.regularExpression, .caseInsensitive]
            )
    }
}

struct ShellRunner: Sendable {
    let workingDirectory: String
    static let npmPathCandidates = ["/usr/local/bin/npm", "/opt/homebrew/bin/npm", "/usr/bin/npm", "npm"]

    func run(_ command: String, description: String) async -> ShellResult {
        await Task.detached(priority: .userInitiated) {
            guard FileManager.default.fileExists(atPath: workingDirectory) else {
                return ShellResult(
                    stdout: "",
                    stderr: "Mongi project folder not found: \(workingDirectory)",
                    exitCode: 127,
                    commandDescription: description,
                    workingDirectory: workingDirectory,
                    errorSummary: "Mongi project folder not found.",
                    npmPathCandidates: Self.npmPathCandidates,
                    resolvedNpmPath: nil
                )
            }

            let process = Process()
            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()
            let shellCommand = Self.shellCommand(command, workingDirectory: workingDirectory)

            process.executableURL = URL(fileURLWithPath: "/bin/zsh")
            process.arguments = ["-lc", shellCommand]
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            do {
                try process.run()
                process.waitUntilExit()

                let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                let resolvedNpmPath = Self.extractResolvedNpmPath(stdout: stdout, stderr: stderr)
                let errorSummary = process.terminationStatus == 0
                    ? nil
                    : Self.makeErrorSummary(stdout: stdout, stderr: stderr, exitCode: process.terminationStatus)

                return ShellResult(
                    stdout: stdout,
                    stderr: stderr,
                    exitCode: process.terminationStatus,
                    commandDescription: description,
                    workingDirectory: workingDirectory,
                    errorSummary: errorSummary,
                    npmPathCandidates: Self.npmPathCandidates,
                    resolvedNpmPath: resolvedNpmPath
                )
            } catch {
                return ShellResult(
                    stdout: "",
                    stderr: error.localizedDescription,
                    exitCode: -1,
                    commandDescription: description,
                    workingDirectory: workingDirectory,
                    errorSummary: error.localizedDescription,
                    npmPathCandidates: Self.npmPathCandidates,
                    resolvedNpmPath: nil
                )
            }
        }.value
    }

    static func shellCommand(_ command: String, workingDirectory: String) -> String {
        let pathPrefix = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        let quotedDirectory = singleQuote(workingDirectory)
        let projectRoot = ProjectRootStore.current
        let outputCwd = ProjectRootStore.exists(projectRoot) && ProjectRootStore.looksLikeMongiProject(projectRoot)
            ? " export MONGI_OUTPUT_CWD=\(singleQuote(projectRoot));"
            : ""
        return "export PATH=\(singleQuote(pathPrefix)):$PATH;\(outputCwd) cd \(quotedDirectory); \(command)"
    }

    static func npmCommand(_ script: String) -> String {
        let escapedScript = script.replacingOccurrences(of: "'", with: "'\\''")
        return "if [ -x /usr/local/bin/npm ]; then NPM=/usr/local/bin/npm; elif [ -x /opt/homebrew/bin/npm ]; then NPM=/opt/homebrew/bin/npm; elif [ -x /usr/bin/npm ]; then NPM=/usr/bin/npm; else NPM=npm; fi; echo \"MONGI_NPM_PATH=$NPM\" >&2; \"$NPM\" run \(escapedScript)"
    }

    static func singleQuote(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
    }

    static func extractResolvedNpmPath(stdout: String, stderr: String) -> String? {
        let combined = "\(stdout)\n\(stderr)"

        for line in combined.split(separator: "\n") {
            if line.hasPrefix("MONGI_NPM_PATH=") {
                return String(line.dropFirst("MONGI_NPM_PATH=".count))
            }
        }

        return nil
    }

    static func makeErrorSummary(stdout: String, stderr: String, exitCode: Int32) -> String {
        let output = stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? stdout : stderr
        let firstLine = output
            .split(separator: "\n")
            .first
            .map(String.init) ?? "Command failed."
        return "Exit \(exitCode): \(ShellResult.sanitize(firstLine))"
    }
}
