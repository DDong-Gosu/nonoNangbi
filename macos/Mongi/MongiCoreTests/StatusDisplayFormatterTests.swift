import XCTest
@testable import MongiCore

final class StatusDisplayFormatterTests: XCTestCase {
    func testOutputMeanings() {
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning("NO_OUTPUT"), "No shipped or local Git output detected.")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning("LOCAL_ONLY"), "Local work exists. Ship it today.")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning("SHIPPED"), "Git output detected today.")
        XCTAssertEqual(StatusDisplayFormatter.outputMeaning(nil), "Git output status unavailable.")
    }

    func testPercentTextAndProgress() {
        XCTAssertEqual(StatusDisplayFormatter.percentText(37), "37%")
        XCTAssertEqual(StatusDisplayFormatter.percentText(nil), "unavailable")
        XCTAssertEqual(StatusDisplayFormatter.percentText(130), "100%")
        XCTAssertEqual(StatusDisplayFormatter.percentText(-10), "0%")
        XCTAssertEqual(StatusDisplayFormatter.progress(59), 0.59)
        XCTAssertEqual(StatusDisplayFormatter.progress(nil), 0)
    }

    func testResetCountdown() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: "2027-01-15T10:30:00Z", now: now), "2h 30m")
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: "2027-01-18T13:00:00Z", now: now), "3d 5h")
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: nil, now: now), "unavailable")
        XCTAssertEqual(StatusDisplayFormatter.resetCountdown(resetAt: "not-a-date", now: now), "unavailable")
    }

    func testCadenceLabels() {
        XCTAssertEqual(RefreshCadence.manual.label, "Manual")
        XCTAssertEqual(RefreshCadence.fiveMinutes.label, "5m")
        XCTAssertEqual(RefreshCadence.tenMinutes.label, "10m")
        XCTAssertEqual(RefreshCadence.fifteenMinutes.label, "15m")
    }
}
