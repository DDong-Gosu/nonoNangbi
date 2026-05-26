import SwiftUI

struct UsageCardView: View {
    let title: String
    let usage: MongiStatus.ServiceUsage?

    var body: some View {
        GroupBox(title) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 18) {
                    remainingBlock("Short remaining", usage?.shortRemaining)
                    remainingBlock("Weekly remaining", usage?.weeklyRemaining)
                    Spacer()
                }

                Divider()

                metric("Failures", numberText(usage?.failures))
                metric("Last checked", usage?.lastCheckedAt ?? "unknown")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private func remainingBlock(_ label: String, _ value: Int?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(percentText(value))
                .font(.title2.weight(.semibold))
                .foregroundStyle(percentColor(value))
        }
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

    private func percentText(_ value: Int?) -> String {
        guard let value else {
            return "unknown"
        }

        return "\(value)%"
    }

    private func numberText(_ value: Int?) -> String {
        guard let value else {
            return "unknown"
        }

        return String(value)
    }

    private func percentColor(_ value: Int?) -> Color {
        guard let value else {
            return .secondary
        }

        if value >= 70 {
            return .green
        }

        if value >= 30 {
            return .orange
        }

        return .red
    }
}
