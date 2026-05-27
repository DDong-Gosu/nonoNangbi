import XCTest
@testable import MongiCore

final class RefreshCadenceTests: XCTestCase {
    func testSupportedValues() {
        XCTAssertEqual(RefreshCadence.allCases.map(\.rawValue), ["manual", "5m", "10m", "15m"])
    }

    func testIntervals() {
        XCTAssertNil(RefreshCadence.manual.intervalSeconds)
        XCTAssertEqual(RefreshCadence.fiveMinutes.intervalSeconds, 300)
        XCTAssertEqual(RefreshCadence.tenMinutes.intervalSeconds, 600)
        XCTAssertEqual(RefreshCadence.fifteenMinutes.intervalSeconds, 900)
    }

    func testValidationDefaultsSafely() {
        XCTAssertEqual(RefreshCadence.validated(rawValue: "manual"), .manual)
        XCTAssertEqual(RefreshCadence.validated(rawValue: "5m"), .fiveMinutes)
        XCTAssertEqual(RefreshCadence.validated(rawValue: "10m"), .tenMinutes)
        XCTAssertEqual(RefreshCadence.validated(rawValue: "15m"), .fifteenMinutes)
        XCTAssertEqual(RefreshCadence.validated(rawValue: "1m"), .fiveMinutes)
        XCTAssertEqual(RefreshCadence.validated(rawValue: nil), .fiveMinutes)
    }
}
