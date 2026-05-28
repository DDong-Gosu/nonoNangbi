import Foundation

struct NodeResolution: Sendable {
    let executable: URL
    let prefixArguments: [String]
    let displayPath: String
    let version: String
}

enum NodeResolver {
    static var candidates: [String] {
        if let override = ProcessInfo.processInfo.environment["MONGI_NODE_CANDIDATES"] {
            let values = override
                .split(separator: ":")
                .map { String($0) }
                .filter { !$0.isEmpty }

            if !values.isEmpty {
                return values
            }
        }

        return [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node",
            "/usr/bin/env node"
        ]
    }

    static func resolve() -> NodeResolution? {
        for candidate in candidates {
            if candidate == "/usr/bin/env node" {
                if let version = version(executable: URL(fileURLWithPath: "/usr/bin/env"), arguments: ["node", "--version"]) {
                    return NodeResolution(
                        executable: URL(fileURLWithPath: "/usr/bin/env"),
                        prefixArguments: ["node"],
                        displayPath: candidate,
                        version: version
                    )
                }
                continue
            }

            let url = URL(fileURLWithPath: candidate)

            guard FileManager.default.isExecutableFile(atPath: url.path) else {
                continue
            }

            if let version = version(executable: url, arguments: ["--version"]) {
                return NodeResolution(executable: url, prefixArguments: [], displayPath: candidate, version: version)
            }
        }

        return nil
    }

    private static func version(executable: URL, arguments: [String]) -> String? {
        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()

        process.executableURL = executable
        process.arguments = arguments
        process.standardOutput = stdout
        process.standardError = stderr

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return nil
        }

        guard process.terminationStatus == 0 else {
            return nil
        }

        let data = stdout.fileHandleForReading.readDataToEndOfFile()
        let text = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        return text.isEmpty ? "unknown" : text
    }
}
