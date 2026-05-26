import SwiftUI

struct NextActionView: View {
    let status: MongiStatus?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Next Action")
                    .font(.headline)
                Spacer()
                Text((status?.overallStatus ?? "unknown").uppercased())
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor, in: Capsule())
            }

            Text(status?.nextAction ?? "Refresh status to get the next action.")
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(statusColor.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    }

    private var statusColor: Color {
        switch status?.overallStatus {
        case "ok":
            return .green
        case "warning":
            return .orange
        case "error":
            return .red
        default:
            return .gray
        }
    }
}
