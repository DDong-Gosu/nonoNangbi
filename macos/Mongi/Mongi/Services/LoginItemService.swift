import Foundation
import ServiceManagement

enum LoginItemState: String, Sendable {
    case enabled
    case disabled
    case requiresApproval
    case notFound
    case unsupported
    case unknown

    var displayText: String {
        switch self {
        case .enabled: return "켜짐 (로그인 시 자동 실행)"
        case .disabled: return "꺼짐"
        case .requiresApproval: return "시스템 설정에서 승인 필요"
        case .notFound: return "등록 항목을 찾을 수 없음"
        case .unsupported: return "이 macOS 버전에서 미지원"
        case .unknown: return "알 수 없음"
        }
    }
}

// Wraps SMAppService.mainApp so the app can register/unregister itself as a
// Login Item. The app NEVER registers automatically: registration happens only
// when the user explicitly toggles it on. macOS 13+ provides SMAppService;
// older systems report .unsupported.
enum LoginItemService {
    static func currentState() -> LoginItemState {
        guard #available(macOS 13.0, *) else { return .unsupported }

        switch SMAppService.mainApp.status {
        case .enabled:
            return .enabled
        case .notRegistered:
            return .disabled
        case .requiresApproval:
            return .requiresApproval
        case .notFound:
            return .notFound
        @unknown default:
            return .unknown
        }
    }

    // Registers the app for launch at login. Returns nil on success or an error
    // description on failure (e.g. running an unbundled binary, or approval
    // required). Only call in response to an explicit user action.
    @discardableResult
    static func enable() -> String? {
        guard #available(macOS 13.0, *) else {
            return "이 macOS 버전에서는 Login Item을 지원하지 않습니다."
        }

        do {
            if SMAppService.mainApp.status == .enabled {
                return nil
            }
            try SMAppService.mainApp.register()
            return nil
        } catch {
            return "Login Item 등록 실패: \(error.localizedDescription)"
        }
    }

    @discardableResult
    static func disable() -> String? {
        guard #available(macOS 13.0, *) else {
            return "이 macOS 버전에서는 Login Item을 지원하지 않습니다."
        }

        do {
            try SMAppService.mainApp.unregister()
            return nil
        } catch {
            return "Login Item 해제 실패: \(error.localizedDescription)"
        }
    }
}
