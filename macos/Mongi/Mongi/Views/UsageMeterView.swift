import MongiCore
import SwiftUI

struct UsageMeterView: View {
    let label: String
    let value: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(StatusDisplayFormatter.percentText(value))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(percentColor)
            }

            ProgressView(value: StatusDisplayFormatter.progress(value), total: 1)
                .tint(percentColor)
                .controlSize(.small)
        }
    }

    private var percentColor: Color {
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
