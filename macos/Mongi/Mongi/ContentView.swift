import AppKit
import MongiCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var viewModel: MongiAppViewModel

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(20)
                .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ProjectRootView(
                        projectRoot: viewModel.projectRoot,
                        exists: viewModel.projectRootExists,
                        looksValid: viewModel.projectRootLooksValid,
                        onChoose: viewModel.chooseProjectFolder,
                        onReset: viewModel.resetProjectRoot
                    )

                    if let errorMessage = viewModel.errorMessage {
                        errorPanel(errorMessage)
                    }

                    NextActionView(status: viewModel.status)
                    StatusOverviewView(status: viewModel.status)

                    HStack(alignment: .top, spacing: 16) {
                        UsageCardView(title: "Codex", usage: viewModel.status?.usage?.codex)
                        UsageCardView(title: "Claude", usage: viewModel.status?.usage?.claude)
                    }

                    TodaySummaryView(today: viewModel.status?.today)
                    PolicySummaryView(policy: viewModel.status?.policy)
                    ActionsView(
                        records: viewModel.commandRecords,
                        isRunning: viewModel.isRunningCommand,
                        onStart: { Task { await viewModel.startMongi() } },
                        onRefresh: { Task { await viewModel.refreshStatus(showOutput: true) } },
                        onHealth: { Task { await viewModel.runHealth() } },
                        onDaily: { Task { await viewModel.runDailySummary() } },
                        onValue: { Task { await viewModel.runValueReview() } }
                    )
                    CommandOutputPanel(output: viewModel.selectedOutput, onClear: viewModel.clearOutput)
                }
                .padding(20)
            }
        }
        .task {
            await viewModel.refreshStatus(showOutput: false)
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    Text("Mongi")
                        .font(.largeTitle.weight(.semibold))
                    statusBadge(viewModel.status?.overallStatus)
                }

                Text("생성: \(viewModel.status?.generatedAt ?? "확인 안 됨")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("산출물: \(StatusDisplayFormatter.outputLabel(viewModel.status?.output?.outputStatus))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("새로고침: \(formatDate(viewModel.lastRefreshedAt))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("주기: \(viewModel.refreshCadence.koreanLabel)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Picker("새로고침 주기", selection: $viewModel.refreshCadence) {
                ForEach(RefreshCadence.allCases) { cadence in
                    Text(cadence.koreanLabel).tag(cadence)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 260)

            Button {
                Task { await viewModel.refreshStatus(showOutput: true) }
            } label: {
                if viewModel.commandRecords[.refresh]?.status == .running {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text("상태 새로고침")
                }
            }
            .disabled(viewModel.isRunningCommand)
            .keyboardShortcut("r", modifiers: [.command])
        }
    }

    private func statusBadge(_ status: String?) -> some View {
        Text(status?.uppercased() ?? "UNKNOWN")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(statusColor(status), in: Capsule())
    }

    private func statusColor(_ status: String?) -> Color {
        switch status {
        case "ok": return .green
        case "warning": return .orange
        case "error": return .red
        default: return .gray
        }
    }

    private func errorPanel(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Issue")
                .font(.headline)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
            Text("status JSON 문제라면 Terminal에서 npm run status:json으로 확인하세요.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private func formatDate(_ date: Date?) -> String {
        guard let date else { return "아직 없음" }
        return date.formatted(date: .omitted, time: .standard)
    }
}
