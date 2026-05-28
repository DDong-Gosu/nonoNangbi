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
            providerUsageBlock
            Divider()
            metaRow
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
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text(StatusDisplayFormatter.outputLabel(viewModel.status?.output?.outputStatus))
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
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(outputColor(viewModel.status?.output?.outputStatus).opacity(0.08))
    }

    private var outputDetails: some View {
        HStack(spacing: 6) {
            if let branch = viewModel.status?.output?.repository?.branch {
                detailChip("브랜치 \(branch)")
            }
            if viewModel.status?.output?.hasLocalChanges == true {
                detailChip("로컬 변경")
            }
            if viewModel.status?.output?.hasUnpushedCommits == true {
                detailChip("푸시 전")
            }
            if viewModel.status?.output?.hasShippedToday == true {
                detailChip("오늘 푸시")
            }
        }
    }

    // MARK: - Provider usage (CodexBar-style compact gauges)

    private var providerUsageBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            providerRow(name: "Codex", usage: viewModel.status?.usage?.codex)
            Divider().opacity(0.4)
            providerRow(name: "Claude", usage: viewModel.status?.usage?.claude)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private func providerRow(name: String, usage: MongiStatus.ServiceUsage?) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(name)
                    .font(.callout.weight(.semibold))
                Spacer()
                providerStatusBadge(usage: usage)
            }
            CompactGaugeRow(
                title: StatusDisplayFormatter.shortGaugeTitle(provider: name),
                remaining: usage?.shortRemaining,
                resetCountdown: StatusDisplayFormatter.resetCountdown(resetAt: usage?.shortResetAt)
            )
            CompactGaugeRow(
                title: StatusDisplayFormatter.weeklyGaugeTitle(provider: name),
                remaining: usage?.weeklyRemaining,
                resetCountdown: StatusDisplayFormatter.resetCountdown(resetAt: usage?.weeklyResetAt)
            )
        }
    }

    private func providerStatusBadge(usage: MongiStatus.ServiceUsage?) -> some View {
        Group {
            if let failures = usage?.failures, failures > 0 {
                Text("확인 필요 · \(failures)회 실패")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.red)
            } else if usage?.stale == true {
                Text("확인 필요")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.orange)
            } else if usage?.shortRemaining == nil && usage?.weeklyRemaining == nil {
                Text("확인 안 됨")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
            } else {
                Text("확인 \(StatusDisplayFormatter.compactTime(usage?.lastCheckedAt))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Meta row (refresh cadence + health)

    private var metaRow: some View {
        HStack(spacing: 10) {
            Text("새로고침 \(formatRefreshTime)")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("·")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("주기 \(viewModel.refreshCadence.koreanLabel)")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Spacer()
            indicator(label: "CDP", value: viewModel.status?.health?.cdpReachable)
            indicator(label: "monitor", value: viewModel.monitorIsRunning)
            indicator(label: "launchd", value: viewModel.status?.health?.launchdLoaded)
            if viewModel.status?.health?.quietHoursActive == true {
                Text("조용한 시간")
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
            menuAction("몽이 시작", icon: "play.fill", running: viewModel.commandRecords[.start]?.status == .running) {
                Task { await viewModel.startMongi() }
            }
            menuAction("새로고침", icon: "arrow.clockwise", running: viewModel.commandRecords[.refresh]?.status == .running) {
                Task { await viewModel.refreshStatus(showOutput: false) }
            }
            menuAction("전체 앱 열기", icon: "macwindow") {
                openMainWindow()
            }
            menuAction("상태 점검", icon: "stethoscope", running: viewModel.commandRecords[.health]?.status == .running) {
                Task {
                    await viewModel.runHealth()
                    openMainWindow()
                }
            }
            menuAction("오늘 요약", icon: "calendar", running: viewModel.commandRecords[.daily]?.status == .running) {
                Task {
                    await viewModel.runDailySummary()
                    openMainWindow()
                }
            }
            menuAction("가치 리뷰", icon: "chart.line.uptrend.xyaxis", running: viewModel.commandRecords[.value]?.status == .running) {
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
                Text("몽이 종료")
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
        Task { await viewModel.loadStatus(showOutput: false) }
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

    private var formatRefreshTime: String {
        guard let at = viewModel.lastRefreshedAt else {
            return "전"
        }

        return at.formatted(date: .omitted, time: .shortened)
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

    private func indicator(label: String, value: Bool?) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(indicatorColor(value))
                .frame(width: 7, height: 7)
            Text(label)
                .font(.caption2)
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
}

// MARK: - Compact gauge

private struct CompactGaugeRow: View {
    let title: String
    let remaining: Int?
    let resetCountdown: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(StatusDisplayFormatter.percentText(remaining))
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(percentColor)
                Text("남음")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if resetCountdown != "확인 안 됨" {
                    Text("· 초기화 \(resetCountdown)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            GaugeBar(progress: StatusDisplayFormatter.progress(remaining), known: remaining != nil, tint: percentColor)
        }
    }

    private var percentColor: Color {
        guard let remaining else {
            return .secondary
        }

        if remaining >= 50 {
            return .green
        }

        if remaining >= 20 {
            return .orange
        }

        return .red
    }
}

private struct GaugeBar: View {
    let progress: Double
    let known: Bool
    let tint: Color

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.secondary.opacity(0.18))
                if known {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(tint)
                        .frame(width: max(2, geo.size.width * CGFloat(min(max(progress, 0), 1))))
                }
            }
        }
        .frame(height: 6)
    }
}

// hoverEffect is iOS-only; provide a no-op for macOS
extension View {
    @ViewBuilder
    func hoverEffect() -> some View {
        self
    }
}
