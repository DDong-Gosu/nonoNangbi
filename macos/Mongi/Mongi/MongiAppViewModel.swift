import AppKit
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

    private var backgroundRefreshTask: Task<Void, Never>?
    private var refreshInFlight = false

    init() {
        let savedCadence = UserDefaults.standard.string(forKey: Self.refreshCadenceDefaultsKey)
        refreshCadence = RefreshCadence.validated(rawValue: savedCadence)
        restartBackgroundRefresh()
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

    func refreshStatus(showOutput: Bool = false) async {
        guard !refreshInFlight, !isRunningCommand else { return }
        guard validateProjectRoot(for: .refresh) else { return }

        refreshInFlight = true
        defer { refreshInFlight = false }

        setCommand(.refresh, status: .running, summary: "Running quiet usage refresh")
        let service = MongiStatusService(projectRoot: projectRoot)
        let result = await service.refreshAndLoadStatus()
        let now = Date()

        status = result.status ?? status
        errorMessage = result.errorMessage

        if result.status != nil {
            lastRefreshedAt = now
            setCommand(.refresh, status: .success, exitCode: result.command.exitCode, ranAt: now, summary: "Status refreshed.")
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
        setCommand(kind, status: .running, summary: "Running \(kind.title)")

        let result = await action()
        let now = Date()
        let runStatus: CommandRunStatus = result.succeeded ? .success : .failed
        let summary = result.succeeded ? "Completed." : result.errorSummary

        setCommand(kind, status: runStatus, exitCode: result.exitCode, ranAt: now, summary: summary)
        selectedOutput = makeOutput(kind: kind, result: result, ranAt: now, fallback: summary)

        return result
    }

    private func validateProjectRoot(for kind: CommandKind) -> Bool {
        if projectRootExists && projectRootLooksValid { return true }

        let message = projectRootExists
            ? "Selected folder does not look like the Mongi Node project. package.json was not found."
            : "Mongi project folder not found. Choose the correct project folder."
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
        let body = output.isEmpty ? (fallback ?? "Command completed with no output.") : output
        return CommandOutput(title: "\(kind.title) - exit \(result.exitCode)", output: body, result: result, ranAt: ranAt)
    }
}
