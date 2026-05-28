import Foundation

struct MonitorLocation: Sendable {
    let rootDirectory: URL
    let entrypoint: URL
    let source: String
}

enum MonitorBundleResolver {
    static func resolve(preferredDevRoot: String = ProjectRootStore.current) -> MonitorLocation? {
        if let resourceURL = Bundle.main.resourceURL {
            let bundledRoot = resourceURL.appendingPathComponent("monitor", isDirectory: true)
            let bundledEntrypoint = bundledRoot
                .appendingPathComponent("src", isDirectory: true)
                .appendingPathComponent("monitor.js")

            if FileManager.default.fileExists(atPath: bundledEntrypoint.path) {
                return MonitorLocation(rootDirectory: bundledRoot, entrypoint: bundledEntrypoint, source: "bundle")
            }
        }

        let devRoot = URL(fileURLWithPath: preferredDevRoot, isDirectory: true)
        let devEntrypoint = devRoot
            .appendingPathComponent("src", isDirectory: true)
            .appendingPathComponent("monitor.js")

        if FileManager.default.fileExists(atPath: devEntrypoint.path) {
            return MonitorLocation(rootDirectory: devRoot, entrypoint: devEntrypoint, source: "dev")
        }

        return nil
    }
}
