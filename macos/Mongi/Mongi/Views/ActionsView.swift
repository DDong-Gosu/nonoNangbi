import SwiftUI

struct ActionsView: View {
    let records: [CommandKind: CommandRecord]
    let isRunning: Bool
    let onStart: () -> Void
    let onRefresh: () -> Void
    let onHealth: () -> Void
    let onDaily: () -> Void
    let onValue: () -> Void

    var body: some View {
        GroupBox("Actions") {
            VStack(alignment: .leading, spacing: 14) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 12)], alignment: .leading, spacing: 12) {
                    commandButton(.start, action: onStart, prominent: true)
                    commandButton(.refresh, action: onRefresh)
                    commandButton(.health, action: onHealth)
                    commandButton(.daily, action: onDaily)
                    commandButton(.value, action: onValue)
                }

                Text("Commands run through the existing Node scripts. This app does not install launchd, edit policy, or read .env.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
    }

    private func commandButton(_ kind: CommandKind, action: @escaping () -> Void, prominent: Bool = false) -> some View {
        let record = records[kind] ?? CommandRecord()

        return VStack(alignment: .leading, spacing: 6) {
            if prominent {
                commandButtonBody(kind, record: record, action: action)
                    .buttonStyle(.borderedProminent)
                    .disabled(isRunning)
            } else {
                commandButtonBody(kind, record: record, action: action)
                    .buttonStyle(.bordered)
                    .disabled(isRunning)
            }

            HStack(spacing: 6) {
                statusBadge(record.status)
                Text(lastRunText(record.lastRunAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let summary = record.summary, !summary.isEmpty {
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }

    private func commandButtonBody(_ kind: CommandKind, record: CommandRecord, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            HStack {
                if record.status == .running {
                    ProgressView()
                        .controlSize(.small)
                }
                Text(kind.title)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func statusBadge(_ status: CommandRunStatus) -> some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(statusColor(status), in: Capsule())
    }

    private func statusColor(_ status: CommandRunStatus) -> Color {
        switch status {
        case .idle:
            return .gray
        case .running:
            return .blue
        case .success:
            return .green
        case .failed:
            return .red
        }
    }

    private func lastRunText(_ date: Date?) -> String {
        guard let date else {
            return "not run"
        }

        return date.formatted(date: .omitted, time: .standard)
    }
}
