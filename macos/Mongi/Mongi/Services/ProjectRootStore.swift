import Foundation

struct ProjectRootStore {
    private static let userDefaultsKey = "mongiProjectRoot"

    static var current: String {
        UserDefaults.standard.string(forKey: userDefaultsKey) ?? mongiProjectRoot
    }

    static func save(_ path: String) {
        UserDefaults.standard.set(path, forKey: userDefaultsKey)
    }

    static func reset() {
        UserDefaults.standard.removeObject(forKey: userDefaultsKey)
    }

    static func exists(_ path: String) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) && isDirectory.boolValue
    }

    static func looksLikeMongiProject(_ path: String) -> Bool {
        FileManager.default.fileExists(atPath: "\(path)/package.json")
    }
}
