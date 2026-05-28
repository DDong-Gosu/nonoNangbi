import XCTest
@testable import MongiCore

final class StatusDisplayFormatterTests: XCTestCase {
    func testOutputMeanings() {
        XCTAssertEqual(StatusDisplayFormatter.outputLabel("NO_OUTPUT"), "산출물 없음")
        XCTAssertEqual(StatusDisplayFormatter.outputLabel("LOCAL_ONLY"), "로컬 작업만 있음")
        XCTAssertEqual(StatusDisplayFormatter.outputLabel("SHIPPED"), "오늘 푸시함")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning("NO_OUTPUT"), "오늘 감지된 로컬 변경이나 푸시가 없습니다.")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning("LOCAL_ONLY"), "로컬 변경이 있습니다. 아직 푸시되지 않았습니다.")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning("SHIPPED"), "오늘 GitHub에 올라간 작업이 있습니다.")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning(nil), "Git output 상태를 아직 읽지 못했습니다.")
    }

    func testPercentTextAndProgress() {
        XCTAssertEqual(StatusDisplayFormatter.percentText(37), "37%")
        XCTAssertEqual(StatusDisplayFormatter.percentText(nil), "확인 안 됨")
        XCTAssertEqual(StatusDisplayFormatter.percentText(130), "100%")
        XCTAssertEqual(StatusDisplayFormatter.percentText(-10), "0%")
        XCTAssertEqual(StatusDisplayFormatter.progress(59), 0.59)
        XCTAssertEqual(StatusDisplayFormatter.progress(nil), 0)
    }

    func testResetCountdown() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: "2027-01-15T10:30:00Z", now: now), "2h 30m")
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: "2027-01-18T13:00:00Z", now: now), "3d 5h")
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: nil, now: now), "확인 안 됨")
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: "not-a-date", now: now), "확인 안 됨")
    }

    func testUsageSummaryLabels() {
        XCTAssertEqual(StatusDisplayFormatter.usageSummary(provider: "Codex", shortRemaining: 99, weeklyRemaining: 69), "Codex 남음 99% / 69%")
        XCTAssertEqual(StatusDisplayFormatter.usageSummary(provider: "Claude", shortRemaining: 33, weeklyRemaining: 96), "Claude 남음 33% / 96%")
        XCTAssertEqual(StatusDisplayFormatter.shortRemainingLabel(provider: "Codex"), "5시간 남음")
        XCTAssertEqual(StatusDisplayFormatter.weeklyRemainingLabel(provider: "Codex"), "주간 남음")
        XCTAssertEqual(StatusDisplayFormatter.shortRemainingLabel(provider: "Claude"), "5시간 남음")
        XCTAssertEqual(StatusDisplayFormatter.weeklyRemainingLabel(provider: "Claude"), "주간 남음")
    }

    func testGaugeTitles() {
        XCTAssertEqual(StatusDisplayFormatter.shortGaugeTitle(provider: "Codex"), "5시간")
        XCTAssertEqual(StatusDisplayFormatter.weeklyGaugeTitle(provider: "Codex"), "주간")
        XCTAssertEqual(StatusDisplayFormatter.shortGaugeTitle(provider: "Claude"), "5시간")
        XCTAssertEqual(StatusDisplayFormatter.weeklyGaugeTitle(provider: "Claude"), "주간")
    }

    func testCadenceLabels() {
        XCTAssertEqual(RefreshCadence.manual.label, "Manual")
        XCTAssertEqual(RefreshCadence.fiveMinutes.label, "5m")
        XCTAssertEqual(RefreshCadence.tenMinutes.label, "10m")
        XCTAssertEqual(RefreshCadence.fifteenMinutes.label, "15m")
        XCTAssertEqual(RefreshCadence.manual.koreanLabel, "수동")
        XCTAssertEqual(RefreshCadence.fiveMinutes.koreanLabel, "5분")
        XCTAssertEqual(RefreshCadence.tenMinutes.koreanLabel, "10분")
        XCTAssertEqual(RefreshCadence.fifteenMinutes.koreanLabel, "15분")
    }
}
