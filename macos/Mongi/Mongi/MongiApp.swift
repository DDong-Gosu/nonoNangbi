import SwiftUI

@main
struct MongiApp: App {
    @StateObject private var viewModel = MongiAppViewModel()

    var body: some Scene {
        WindowGroup("Mongi", id: "main") {
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
