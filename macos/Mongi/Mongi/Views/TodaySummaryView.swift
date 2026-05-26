import SwiftUI

struct TodaySummaryView: View {
    let today: MongiStatus.Today?

    var body: some View {
        GroupBox("Today Summary") {
            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), alignment: .leading)], alignment: .leading, spacing: 12) {
                    metric("Runs", numberText(today?.runs))
                    metric("Successful", numberText(today?.successful))
                    metric("Failed", numberText(today?.failed))
                    metric("Notifications", numberText(today?.notificationsSent))
                    metric("Quiet hint", boolText(today?.quietHoursSuppressionHint))
                }

                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Events")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)

                    if let events = today?.events, !events.isEmpty {
                        ForEach(events.keys.sorted(), id: \.self) { key in
                            HStack {
                                Text(key)
                                Spacer()
                                Text(numberText(events[key]))
                                    .monospacedDigit()
                            }
                            .font(.callout)
                        }
                    } else {
                        Text("none detected")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
    }

    private func numberText(_ value: Int?) -> String {
        guard let value else {
            return "unknown"
        }

        return String(value)
    }

    private func boolText(_ value: Bool?) -> String {
        guard let value else {
            return "unknown"
        }

        return value ? "yes" : "no"
    }
}
