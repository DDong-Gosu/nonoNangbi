import SwiftUI

struct ProjectRootView: View {
    let projectRoot: String
    let exists: Bool
    let looksValid: Bool
    let onChoose: () -> Void
    let onReset: () -> Void

    var body: some View {
        GroupBox("Project Root") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(projectRoot)
                            .font(.system(.callout, design: .monospaced))
                            .textSelection(.enabled)
                            .lineLimit(2)
                        Text(statusText)
                            .font(.caption)
                            .foregroundStyle(statusColor)
                    }

                    Spacer()

                    Button("Choose Project Folder", action: onChoose)
                    Button("Reset", action: onReset)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
    }

    private var statusText: String {
        if !exists {
            return "Folder not found. Choose the Mongi project folder."
        }

        if !looksValid {
            return "Folder found, but package.json is missing."
        }

        return "Ready"
    }

    private var statusColor: Color {
        exists && looksValid ? .green : .red
    }
}
