import MongiCore
import SwiftUI

struct UsageCardView: View {
    let title: String
    let usage: MongiStatus.ServiceUsage?

    var body: some View {
        GroupBox(title) {
            VStack(alignment: .leading, spacing: 12) {
                UsageMeterView(label: StatusDisplayFormatter.shortRemainingLabel(provider: title), value: usage?.shortRemaining)
                UsageMeterView(label: StatusDisplayFormatter.weeklyRemainingLabel(provider: title), value: usage?.weeklyRemaining)

                Divider()

                metric(StatusDisplayFormatter.shortUsedLabel(provider: title), StatusDisplayFormatter.percentText(usage?.shortUsed))
                metric(StatusDisplayFormatter.weeklyUsedLabel(provider: title), StatusDisplayFormatter.percentText(usage?.weeklyUsed))
                metric("단기 초기화", StatusDisplayFormatter.resetCountdown(resetAt: usage?.shortResetAt))
                metric("주간 초기화", StatusDisplayFormatter.resetCountdown(resetAt: usage?.weeklyResetAt))
                metric("파싱 실패", numberText(usage?.failures))
                metric("마지막 확인", StatusDisplayFormatter.compactTime(usage?.lastCheckedAt))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.callout)
                .textSelection(.enabled)
        }
    }

    private func numberText(_ value: Int?) -> String {
        guard let value else {
            return "확인 안 됨"
        }

        return String(value)
    }
}
