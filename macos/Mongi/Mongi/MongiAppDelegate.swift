import AppKit

final class MongiAppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillTerminate(_ notification: Notification) {
        MonitorRunner.shared.stop()
    }
}
