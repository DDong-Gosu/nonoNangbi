import MongiCore
import SwiftUI

struct UsageCardView: View {
    let title: String
    let usage: MongiStatus.ServiceUsage?

    var body: some View {
        GroupBox(title) {
            VStack(alignment: .leading, spacing: 12) {
                UsageMeterView(label: "Short remaining", value: usage?.shortRemaining)
                UsageMeterView(label: "Weekly remaining", value: usage?.weeklyRemaining)

                Divider()

                metric("Short used", StatusDisplayFormatter.percentText(usage?.shortUsed))
                metric("Weekly used", StatusDisplayFormatter.percentText(usage?.weeklyUsed))
                metric("Short reset", StatusDisplayFormatter.resetCountdown(resetAt: usage?.shortResetAt))
                metric("Weekly reset", StatusDisplayFormatter.resetCountdown(resetAt: usage?.weeklyResetAt))
                metric("Failures", numberText(usage?.failures))
                metric("Last checked", StatusDisplayFormatter.compactTime(usage?.lastCheckedAt))
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
            return "unknown"
        }

        return String(value)
    }
}
