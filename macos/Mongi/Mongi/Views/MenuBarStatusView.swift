import AppKit
import SwiftUI

struct MenuBarStatusView: View {
    @EnvironmentObject private var viewModel: MongiAppViewModel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            statusHeader
            Divider()
            healthRow
            Divider()
            usageSection
            Divider()
            todayRow
            Divider()
            actionButtons
            Divider()
            quitRow
        }
        .frame(width: 300)
    }

    // MARK: - Header

    private var statusHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text("Mongi")
                    .font(.headline)
                statusBadge(viewModel.status?.overallStatus)
                Spacer()
                if viewModel.commandRecords[.refresh]?.status == .running {
                    ProgressView()
                        .controlSize(.mini)
                }
            }
            if let nextAction = viewModel.status?.nextAction {
                Text(nextAction)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            } else if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            } else {
                Text("Loading…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    // MARK: - Health indicators

    private var healthRow: some View {
        HStack(spacing: 16) {
            indicator(
                label: "CDP",
                value: viewModel.status?.health?.cdpReachable
            )
            indicator(
                label: "launchd",
                value: viewModel.status?.health?.launchdLoaded
            )
            if viewModel.status?.health?.quietHoursActive == true {
                Text("🌙 Quiet")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    // MARK: - Usage

    private var usageSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            usageRow(name: "Codex", usage: viewModel.status?.usage?.codex)
            usageRow(name: "Claude", usage: viewModel.status?.usage?.claude)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func usageRow(name: String, usage: MongiStatus.ServiceUsage?) -> some View {
        HStack {
            Text(name)
                .font(.caption.weight(.medium))
                .frame(width: 46, alignment: .leading)
            Text("Short: \(percentText(usage?.shortRemaining))")
                .font(.caption)
                .foregroundStyle(usageColor(usage?.shortRemaining))
                .frame(width: 80, alignment: .leading)
            Text("Weekly: \(percentText(usage?.weeklyRemaining))")
                .font(.caption)
                .foregroundStyle(usageColor(usage?.weeklyRemaining))
            Spacer()
            if let failures = usage?.failures, failures > 0 {
                Text("\(failures) fail")
                    .font(.caption2)
                    .foregroundStyle(.red)
            }
        }
    }

    // MARK: - Today

    private var todayRow: some View {
        HStack(spacing: 12) {
            if let today = viewModel.status?.today {
                statChip(label: "runs", value: today.runs)
                statChip(label: "failed", value: today.failed, warnIfNonzero: true)
                statChip(label: "notif", value: today.notificationsSent)
            } else {
                Text("No today data")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let at = viewModel.lastRefreshedAt {
                Text(at.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    // MARK: - Action buttons

    private var actionButtons: some View {
        VStack(spacing: 0) {
            menuAction("Start Mongi", icon: "play.fill", running: viewModel.commandRecords[.start]?.status == .running) {
                Task { await viewModel.startMongi() }
            }
            menuAction("Refresh", icon: "arrow.clockwise", running: viewModel.commandRecords[.refresh]?.status == .running) {
                Task { await viewModel.refreshStatus(showOutput: false) }
            }
            menuAction("Open Full App", icon: "macwindow") {
                openMainWindow()
            }
            menuAction("Health Check", icon: "stethoscope", running: viewModel.commandRecords[.health]?.status == .running) {
                Task {
                    await viewModel.runHealth()
                    openMainWindow()
                }
            }
            menuAction("Daily Summary", icon: "calendar", running: viewModel.commandRecords[.daily]?.status == .running) {
                Task {
                    await viewModel.runDailySummary()
                    openMainWindow()
                }
            }
            menuAction("Value Review", icon: "chart.line.uptrend.xyaxis", running: viewModel.commandRecords[.value]?.status == .running) {
                Task {
                    await viewModel.runValueReview()
                    openMainWindow()
                }
            }
        }
    }

    // MARK: - Quit

    private var quitRow: some View {
        Button(role: .destructive) {
            NSApplication.shared.terminate(nil)
        } label: {
            HStack {
                Image(systemName: "power")
                Text("Quit Mongi")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .font(.callout)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.red)
    }

    // MARK: - Helpers

    private func openMainWindow() {
        openWindow(id: "main")
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    private func menuAction(
        _ label: String,
        icon: String,
        running: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            HStack(spacing: 8) {
                if running {
                    ProgressView()
                        .controlSize(.mini)
                        .frame(width: 14, height: 14)
                } else {
                    Image(systemName: icon)
                        .frame(width: 14, height: 14)
                }
                Text(label)
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .font(.callout)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isRunningCommand && !running)
        .background(Color.primary.opacity(0.0))
        .hoverEffect()
    }

    private func statusBadge(_ status: String?) -> some View {
        Text(status?.uppercased() ?? "–")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
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

    private func indicator(label: String, value: Bool?) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(indicatorColor(value))
                .frame(width: 7, height: 7)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func indicatorColor(_ value: Bool?) -> Color {
        switch value {
        case true: return .green
        case false: return .red
        case nil: return .gray
        }
    }

    private func percentText(_ value: Int?) -> String {
        guard let value else { return "—" }
        return "\(value)%"
    }

    private func usageColor(_ value: Int?) -> Color {
        guard let value else { return .secondary }
        if value >= 80 { return .green }
        if value >= 40 { return .orange }
        return .red
    }

    private func statChip(label: String, value: Int?, warnIfNonzero: Bool = false) -> some View {
        HStack(spacing: 3) {
            Text("\(value ?? 0)")
                .font(.caption.weight(.medium))
                .foregroundStyle(warnIfNonzero && (value ?? 0) > 0 ? .red : .primary)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// hoverEffect is iOS-only; provide a no-op for macOS
extension View {
    @ViewBuilder
    func hoverEffect() -> some View {
        self
    }
}
