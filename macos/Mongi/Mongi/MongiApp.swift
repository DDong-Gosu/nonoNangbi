import SwiftUI

@main
struct MongiApp: App {
    @NSApplicationDelegateAdaptor(MongiAppDelegate.self) private var appDelegate
    @StateObject private var viewModel = MongiAppViewModel()

    init() {
        MongiRuntimePaths.ensureRuntimeDirectories()
    }

    var body: some Scene {
        Window("Mongi", id: "main") {
            ContentView()
                .environmentObject(viewModel)
                .frame(minWidth: 980, minHeight: 720)
        }
        .windowStyle(.titleBar)

        MenuBarExtra("Mongi", systemImage: "chart.bar.fill") {
            MenuBarStatusView()
                .environmentObject(viewModel)
        }
        .menuBarExtraStyle(.window)
    }
}
