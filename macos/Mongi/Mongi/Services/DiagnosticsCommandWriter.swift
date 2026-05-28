import Foundation

enum DiagnosticsCommandWriter {
    static func write(type: String, source: String? = nil) throws -> String {
        MongiRuntimePaths.ensureRuntimeDirectories()

        let commandId = "cmd-\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString)"
        var command: [String: Any] = [
            "id": commandId,
            "type": type,
            "createdAt": ISO8601DateFormatter().string(from: Date()),
            "status": "pending"
        ]

        if let source {
            command["source"] = source
        }

        var store = readStore()
        var commands = store["commands"] as? [[String: Any]] ?? []
        commands.append(command)
        store["version"] = store["version"] ?? 1
        store["updatedAt"] = ISO8601DateFormatter().string(from: Date())
        store["commands"] = commands

        let data = try JSONSerialization.data(withJSONObject: store, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: MongiRuntimePaths.commandsFile, options: .atomic)

        return commandId
    }

    private static func readStore() -> [String: Any] {
        guard FileManager.default.fileExists(atPath: MongiRuntimePaths.commandsFile.path),
              let data = try? Data(contentsOf: MongiRuntimePaths.commandsFile),
              !data.isEmpty else {
            return ["version": 1, "commands": []]
        }

        do {
            let value = try JSONSerialization.jsonObject(with: data)
            if let object = value as? [String: Any] {
                let commands = normalizeCommands(object["commands"])
                return ["version": object["version"] ?? 1, "commands": commands]
            }
            if let array = value as? [[String: Any]] {
                return ["version": 1, "commands": array]
            }
        } catch {
            let backup = MongiRuntimePaths.commandsFile.deletingLastPathComponent().appendingPathComponent("commands.json.corrupt.\(Int(Date().timeIntervalSince1970))")
            try? FileManager.default.moveItem(at: MongiRuntimePaths.commandsFile, to: backup)
        }

        return ["version": 1, "commands": []]
    }

    private static func normalizeCommands(_ value: Any?) -> [[String: Any]] {
        guard let commands = value as? [[String: Any]] else {
            return []
        }

        return commands.compactMap { command in
            guard let id = command["id"] as? String,
                  let type = command["type"] as? String,
                  !id.isEmpty,
                  !type.isEmpty else {
                return nil
            }
            return command
        }
    }
}
