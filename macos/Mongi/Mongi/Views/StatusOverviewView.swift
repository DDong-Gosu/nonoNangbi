import SwiftUI

struct StatusOverviewView: View {
    let status: MongiStatus?

    var body: some View {
        GroupBox("상태 요약") {
            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), alignment: .leading)], alignment: .leading, spacing: 12) {
                    metric("CDP 연결", boolText(status?.health?.cdpReachable))
                    metric("launchd 로드", boolText(status?.health?.launchdLoaded))
                    metric("조용한 시간", boolText(status?.health?.quietHoursActive))
                    metric("브라우저 모드", status?.health?.browserMode ?? "확인 안 됨")
                }

                Divider()

                VStack(alignment: .leading, spacing: 6) {
                    Text("다음 행동")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(status?.nextAction ?? "상태 새로고침으로 Mongi 상태를 불러오세요.")
                        .font(.body.weight(.medium))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
    }

    private func boolText(_ value: Bool?) -> String {
        guard let value else {
            return "확인 안 됨"
        }

        return value ? "예" : "아니오"
    }
}
