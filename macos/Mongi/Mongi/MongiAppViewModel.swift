import AppKit
import Combine
import MongiCore
import SwiftUI

@MainActor
final class MongiAppViewModel: ObservableObject {
    private static let refreshCadenceDefaultsKey = "mongi.refreshCadence"

    @Published var projectRoot = ProjectRootStore.current
    @Published var status: MongiStatus?
    @Published var errorMessage: String?
    @Published var lastRefreshedAt: Date?
    @Published var refreshCadence: RefreshCadence {
        didSet {
            guard refreshCadence != oldValue else { return }
            UserDefaults.standard.set(refreshCadence.rawValue, forKey: Self.refreshCadenceDefaultsKey)
            restartBackgroundRefresh()
        }
    }
    @Published var commandRecords: [CommandKind: CommandRecord] = Dictionary(
        uniqueKeysWithValues: CommandKind.allCases.map { ($0, CommandRecord()) }
    )
    @Published var selectedOutput: CommandOutput?
    @Published var loginItemState: LoginItemState = .unknown
    @Published var loginItemMessage: String?
    @Published var monitorRuntime: MonitorRuntimeStatus = MonitorStatusEvaluator.evaluate()

    private var backgroundRefreshTask: Task<Void, Never>?
    private var refreshInFlight = false
    private var monitorCancellable: AnyCancellable?
    let monitorRunner: MonitorRunner

    init(monitorRunner: MonitorRunner = .shared) {
        self.monitorRunner = monitorRunner
        let savedCadence = UserDefaults.standard.string(forKey: Self.refreshCadenceDefaultsKey)
        refreshCadence = RefreshCadence.validated(rawValue: savedCadence)
        monitorCancellable = monitorRunner.objectWillChange.sink { [weak self] _ in
            DispatchQueue.main.async {
                self?.objectWillChange.send()
            }
        }
        monitorRunner.start(preferredDevRoot: projectRoot)
        refreshMonitorRuntime()
        refreshLoginItemState()
        restartBackgroundRefresh()
    }

    func refreshMonitorRuntime() {
        monitorRuntime = MonitorStatusEvaluator.evaluate()
    }

    func refreshLoginItemState() {
        loginItemState = LoginItemService.currentState()
    }

    func setLoginItemEnabled(_ enabled: Bool) {
        let error = enabled ? LoginItemService.enable() : LoginItemService.disable()
        loginItemMessage = error
        refreshLoginItemState()
    }

    var projectRootExists: Bool {
        ProjectRootStore.exists(projectRoot)
    }

    var projectRootLooksValid: Bool {
        ProjectRootStore.looksLikeMongiProject(projectRoot)
    }

    var isRunningCommand: Bool {
        commandRecords.values.contains { record in
            if case .running = record.status { return true }
            return false
        }
    }

    var monitorStatusText: String {
        switch monitorRuntime.effective {
        case .running:
            return "실행 중"
        case .starting:
            return "시작 중"
        case .stopped:
            return "정지"
        case .stale:
            return "응답 없음 (heartbeat 멈춤)"
        case .crashed:
            return "비정상 종료"
        case .failed:
            return "실패"
        case .unknown:
            return fallbackMonitorStatusText
        }
    }

    private var fallbackMonitorStatusText: String {
        switch monitorRunner.status {
        case .idle: return "대기"
        case .starting: return "시작 중"
        case .running: return "실행 중"
        case .stopped: return "정지"
        case .failed: return "실패"
        }
    }

    var monitorIsHealthy: Bool {
        monitorRuntime.effective == .running
    }

    var monitorIsRunning: Bool {
        monitorRuntime.effective == .running || monitorRunner.status == .running || monitorRunner.isRunning
    }

    func refreshStatus(showOutput: Bool = false) async {
        guard !refreshInFlight, !isRunningCommand else { return }
        guard validateProjectRoot(for: .refresh) else { return }

        refreshInFlight = true
        defer { refreshInFlight = false }

        setCommand(.refresh, status: .running, summary: "조용히 사용량을 새로고침 중")
        let service = MongiStatusService(projectRoot: projectRoot)
        let result = await service.refreshAndLoadStatus()
        let now = Date()

        status = result.status ?? status
        errorMessage = result.errorMessage

        if result.status != nil {
            lastRefreshedAt = now
            setCommand(.refresh, status: .success, exitCode: result.command.exitCode, ranAt: now, summary: "상태를 새로고침했습니다.")
        } else {
            setCommand(.refresh, status: .failed, exitCode: result.command.exitCode, ranAt: now, summary: result.errorMessage)
        }

        if showOutput || result.status == nil {
            selectedOutput = makeOutput(kind: .refresh, result: result.command, ranAt: now, fallback: result.errorMessage)
        }
    }

    func loadStatus(showOutput: Bool = false) async {
        guard !refreshInFlight, !isRunningCommand else { return }
        guard validateProjectRoot(for: .refresh) else { return }

        refreshInFlight = true
        defer { refreshInFlight = false }

        setCommand(.refresh, status: .running, summary: "저장된 상태를 읽는 중")
        let service = MongiStatusService(projectRoot: projectRoot)
        let result = await service.loadStatus()
        let now = Date()

        status = result.status ?? status
        errorMessage = result.errorMessage

        if result.status != nil {
            lastRefreshedAt = now
            setCommand(.refresh, status: .success, exitCode: result.command.exitCode, ranAt: now, summary: "상태를 읽었습니다.")
        } else {
            setCommand(.refresh, status: .failed, exitCode: result.command.exitCode, ranAt: now, summary: result.errorMessage)
        }

        if showOutput || result.status == nil {
            selectedOutput = makeOutput(kind: .refresh, result: result.command, ranAt: now, fallback: result.errorMessage)
        }
    }

    func startMongi() async {
        guard validateProjectRoot(for: .start) else { return }

        let result = await runCommand(.start) {
            await MongiStatusService(projectRoot: self.projectRoot).startMongi()
        }

        if result.succeeded {
            await refreshStatus(showOutput: false)
        }
    }

    func runHealth() async {
        await runSimpleCommand(.health) {
            await MongiStatusService(projectRoot: self.projectRoot).runHealth()
        }
    }

    func runDailySummary() async {
        await runSimpleCommand(.daily) {
            await MongiStatusService(projectRoot: self.projectRoot).runDailySummary()
        }
    }

    func runValueReview() async {
        await runSimpleCommand(.value) {
            await MongiStatusService(projectRoot: self.projectRoot).runValueReview()
        }
    }

    func chooseProjectFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Choose the Mongi Node project folder."
        panel.directoryURL = URL(fileURLWithPath: projectRoot)

        if panel.runModal() == .OK, let url = panel.url {
            projectRoot = url.path
            ProjectRootStore.save(url.path)
            status = nil
            errorMessage = nil
            selectedOutput = nil
            Task { await refreshStatus(showOutput: false) }
        }
    }

    func resetProjectRoot() {
        ProjectRootStore.reset()
        projectRoot = ProjectRootStore.current
        status = nil
        errorMessage = nil
        selectedOutput = nil
        Task { await refreshStatus(showOutput: false) }
    }

    func restartMonitor() {
        monitorRunner.restart(preferredDevRoot: projectRoot)
        refreshMonitorRuntime()
    }

    func clearOutput() {
        selectedOutput = nil
    }

    private func restartBackgroundRefresh() {
        backgroundRefreshTask?.cancel()
        backgroundRefreshTask = nil

        guard let seconds = refreshCadence.intervalSeconds else { return }

        backgroundRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    try await Task.sleep(nanoseconds: UInt64(seconds) * 1_000_000_000)
                } catch {
                    return
                }

                if Task.isCancelled {
                    return
                }

                await self?.refreshStatus(showOutput: false)
            }
        }
    }

    private func runSimpleCommand(_ kind: CommandKind, action: () async -> ShellResult) async {
        guard validateProjectRoot(for: kind) else { return }
        _ = await runCommand(kind, action: action)
    }

    private func runCommand(_ kind: CommandKind, action: () async -> ShellResult) async -> ShellResult {
        setCommand(kind, status: .running, summary: "\(kind.title) 실행 중")

        let result = await action()
        let now = Date()
        let runStatus: CommandRunStatus = result.succeeded ? .success : .failed
        let summary = result.succeeded ? "완료했습니다." : result.errorSummary

        setCommand(kind, status: runStatus, exitCode: result.exitCode, ranAt: now, summary: summary)
        selectedOutput = makeOutput(kind: kind, result: result, ranAt: now, fallback: summary)

        return result
    }

    private func validateProjectRoot(for kind: CommandKind) -> Bool {
        if MonitorBundleResolver.resolve(preferredDevRoot: projectRoot) != nil {
            return true
        }

        if projectRootExists && projectRootLooksValid { return true }

        let message = projectRootExists
            ? "선택한 폴더가 Mongi Node project로 보이지 않습니다. package.json을 찾지 못했습니다."
            : "Mongi project folder를 찾지 못했습니다. 올바른 폴더를 선택하세요."
        let now = Date()
        let result = ShellResult(
            stdout: "",
            stderr: message,
            exitCode: 127,
            commandDescription: "npm run \(kind.script)",
            workingDirectory: projectRoot,
            errorSummary: message,
            npmPathCandidates: ShellRunner.npmPathCandidates,
            resolvedNpmPath: nil
        )

        errorMessage = message
        setCommand(kind, status: .failed, exitCode: result.exitCode, ranAt: now, summary: message)
        selectedOutput = makeOutput(kind: kind, result: result, ranAt: now, fallback: message)

        return false
    }

    private func setCommand(
        _ kind: CommandKind,
        status: CommandRunStatus,
        exitCode: Int32? = nil,
        ranAt: Date? = nil,
        summary: String? = nil
    ) {
        var record = commandRecords[kind] ?? CommandRecord()
        record.status = status
        record.exitCode = exitCode ?? record.exitCode
        record.lastRunAt = ranAt ?? record.lastRunAt
        record.summary = summary
        commandRecords[kind] = record
    }

    private func makeOutput(kind: CommandKind, result: ShellResult, ranAt: Date, fallback: String?) -> CommandOutput {
        let output = result.sanitizedCombinedOutput.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = output.isEmpty ? (fallback ?? "출력 없이 완료했습니다.") : output
        return CommandOutput(title: "\(kind.title) - exit \(result.exitCode)", output: body, result: result, ranAt: ranAt)
    }
}
