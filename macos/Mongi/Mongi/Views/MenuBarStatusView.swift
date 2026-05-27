import AppKit
import MongiCore
import SwiftUI

struct MenuBarStatusView: View {
    @EnvironmentObject private var viewModel: MongiAppViewModel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            statusHeader
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    usageSection
                    cadenceRow
                    healthRow
                    todayRow
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
            Divider()
            actionButtons
            Divider()
            quitRow
        }
        .frame(width: 340)
        .onAppear {
            refreshOnPopoverOpen()
        }
    }

    // MARK: - Header

    private var statusHeader: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 8) {
                Text(viewModel.status?.output?.outputStatus ?? "UNKNOWN")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(outputColor(viewModel.status?.output?.outputStatus))
                Spacer()
                if viewModel.commandRecords[.refresh]?.status == .running {
                    ProgressView()
                        .controlSize(.mini)
                }
            }
            Text(StatusDisplayFormatter.outputMeaning(viewModel.status?.output?.outputStatus))
                .font(.caption)
                .foregroundStyle(.primary)
                .lineLimit(2)
            outputDetails
            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(outputColor(viewModel.status?.output?.outputStatus).opacity(0.08))
    }

    private var outputDetails: some View {
        HStack(spacing: 8) {
            if let branch = viewModel.status?.output?.repository?.branch {
                detailChip("branch \(branch)")
            }
            if viewModel.status?.output?.hasLocalChanges == true {
                detailChip("local changes")
            }
            if viewModel.status?.output?.hasUnpushedCommits == true {
                detailChip("unpushed")
            }
            if viewModel.status?.output?.hasShippedToday == true {
                detailChip("shipped today")
            }
        }
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
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }

    private var cadenceRow: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("Refresh")
                    .font(.caption.weight(.medium))
                Spacer()
                Text(refreshMetadata)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Picker("Refresh cadence", selection: $viewModel.refreshCadence) {
                ForEach(RefreshCadence.allCases) { cadence in
                    Text(cadence.label).tag(cadence)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Usage

    private var usageSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            providerCard(name: "Codex", usage: viewModel.status?.usage?.codex)
            providerCard(name: "Claude", usage: viewModel.status?.usage?.claude)
        }
    }

    private func providerCard(name: String, usage: MongiStatus.ServiceUsage?) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline) {
                Text(name)
                    .font(.caption.weight(.semibold))
                Spacer()
                if let failures = usage?.failures, failures > 0 {
                    Text("\(failures) parse fail")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.red)
                } else {
                    Text("checked \(StatusDisplayFormatter.compactTime(usage?.lastCheckedAt))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            UsageMeterView(label: "Short remaining", value: usage?.shortRemaining)
            UsageMeterView(label: "Weekly remaining", value: usage?.weeklyRemaining)

            HStack(spacing: 10) {
                resetChip(label: "Short used", value: StatusDisplayFormatter.percentText(usage?.shortUsed))
                resetChip(label: "Weekly used", value: StatusDisplayFormatter.percentText(usage?.weeklyUsed))
            }

            HStack(spacing: 10) {
                resetChip(label: "Short reset", value: StatusDisplayFormatter.resetCountdown(resetAt: usage?.shortResetAt))
                resetChip(label: "Weekly reset", value: StatusDisplayFormatter.resetCountdown(resetAt: usage?.weeklyResetAt))
            }
        }
        .padding(10)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
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
                Text("refreshed \(at.formatted(date: .omitted, time: .shortened))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
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

    private func refreshOnPopoverOpen() {
        Task { await viewModel.refreshStatus(showOutput: false) }
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

    private var refreshMetadata: String {
        if viewModel.commandRecords[.refresh]?.status == .running {
            return "refreshing"
        }

        return "cadence \(viewModel.refreshCadence.label)"
    }

    private func outputColor(_ status: String?) -> Color {
        switch status {
        case "SHIPPED": return .green
        case "LOCAL_ONLY": return .orange
        case "NO_OUTPUT": return .red
        default: return .gray
        }
    }

    private func detailChip(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.primary.opacity(0.07), in: Capsule())
    }

    private func resetChip(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.medium))
                .foregroundStyle(value == "unavailable" ? .secondary : .primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
