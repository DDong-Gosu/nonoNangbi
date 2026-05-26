import SwiftUI

struct StatusOverviewView: View {
    let status: MongiStatus?

    var body: some View {
        GroupBox("Status Overview") {
            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), alignment: .leading)], alignment: .leading, spacing: 12) {
                    metric("CDP reachable", boolText(status?.health?.cdpReachable))
                    metric("launchd loaded", boolText(status?.health?.launchdLoaded))
                    metric("quiet hours", boolText(status?.health?.quietHoursActive))
                    metric("browser mode", status?.health?.browserMode ?? "unknown")
                }

                Divider()

                VStack(alignment: .leading, spacing: 6) {
                    Text("Next action")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(status?.nextAction ?? "Run Refresh Status to load Mongi state.")
                        .font(.body.weight(.medium))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
    }

    private func boolText(_ value: Bool?) -> String {
        guard let value else {
            return "unknown"
        }

        return value ? "yes" : "no"
    }
}
