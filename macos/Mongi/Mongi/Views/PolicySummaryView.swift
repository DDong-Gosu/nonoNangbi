import SwiftUI

struct PolicySummaryView: View {
    let policy: MongiStatus.Policy?

    var body: some View {
        GroupBox("Policy Summary") {
            VStack(alignment: .leading, spacing: 14) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), alignment: .leading)], alignment: .leading, spacing: 12) {
                    metric("Recovered short", boolText(policy?.notifications?.recoveredShort))
                    metric("Recovered weekly", boolText(policy?.notifications?.recoveredWeekly))
                    metric("Session stopped", boolText(policy?.notifications?.sessionStopped))
                    metric("Weekly idle", boolText(policy?.notifications?.weeklyIdle))
                    metric("Diagnostics", boolText(policy?.notifications?.diagnostics))
                    metric("Message intensity", policy?.message?.intensity ?? "unknown")
                }

                Divider()

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), alignment: .leading)], alignment: .leading, spacing: 12) {
                    metric("Session stopped minutes", numberText(policy?.thresholds?.sessionStoppedMinutes))
                    metric("Weekly idle reminder hours", numberText(policy?.thresholds?.weeklyIdleReminderHours))
                    metric("Diagnostic reminder hours", numberText(policy?.thresholds?.diagnosticReminderHours))
                    metric("Quiet hours", quietHoursText(policy?.quietHours))
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
                .font(.callout.weight(.medium))
        }
    }

    private func boolText(_ value: Bool?) -> String {
        guard let value else {
            return "unknown"
        }

        return value ? "enabled" : "disabled"
    }

    private func numberText(_ value: Int?) -> String {
        guard let value else {
            return "unknown"
        }

        return String(value)
    }

    private func quietHoursText(_ quietHours: MongiStatus.QuietHours?) -> String {
        guard let quietHours, quietHours.enabled == true else {
            return "disabled"
        }

        return "\(quietHours.startHour ?? 0):00-\(quietHours.endHour ?? 0):00"
    }
}
