import AppKit
import SwiftUI

struct CommandOutputPanel: View {
    let output: CommandOutput?
    let onClear: () -> Void

    var body: some View {
        GroupBox("Command Output") {
            VStack(alignment: .leading, spacing: 12) {
                if let output {
                    header(output)

                    ScrollView {
                        Text(output.output)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                    }
                    .frame(minHeight: 180, maxHeight: 320)
                    .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
                } else {
                    Text("Run a command to see output here.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
    }

    private func header(_ output: CommandOutput) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(output.title)
                        .font(.headline)
                    Text("Ran \(output.ranAt.formatted(date: .omitted, time: .standard)) in \(output.result.workingDirectory)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    if let npm = output.result.resolvedNpmPath {
                        Text("npm: \(npm)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("npm candidates: \(output.result.npmPathCandidates.joined(separator: ", "))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                Button("Copy") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(output.output, forType: .string)
                }
                Button("Clear", action: onClear)
            }

            if let summary = output.result.errorSummary {
                Text(summary)
                    .font(.callout.weight(.medium))
                    .foregroundStyle(.red)
            }
        }
    }
}
