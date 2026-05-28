import AppKit
import SwiftUI

struct DiagnosticsView: View {
    @EnvironmentObject private var viewModel: MongiAppViewModel
    @State private var runtime = RuntimeDiagnosticsSnapshot()
    @State private var monitorLog = ""
    @State private var errorLog = ""
    @State private var healthLog = ""
    @State private var actionMessage: String?
    @State private var healthResult: String?
    @State private var selectedTab = "overview"

    var body: some View {
        VStack(spacing: 0) {
            header
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            TabView(selection: $selectedTab) {
                overviewTab
                    .tabItem { Label("Overview", systemImage: "gauge") }
                    .tag("overview")
                sourcesTab
                    .tabItem { Label("Sources", systemImage: "point.3.connected.trianglepath.dotted") }
                    .tag("sources")
                recoveryTab
                    .tabItem { Label("Recovery", systemImage: "arrow.clockwise.circle") }
                    .tag("recovery")
                runtimeTab
                    .tabItem { Label("Runtime", systemImage: "terminal") }
                    .tag("runtime")
                backgroundTab
                    .tabItem { Label("Background", systemImage: "bolt.horizontal.circle") }
                    .tag("background")
                actionsTab
                    .tabItem { Label("Actions", systemImage: "wrench.and.screwdriver") }
                    .tag("actions")
                logsTab
                    .tabItem { Label("Logs", systemImage: "doc.text.magnifyingglass") }
                    .tag("logs")
            }
            .padding(16)
        }
        .frame(minWidth: 920, minHeight: 640)
        .task {
            await reloadAll()
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Mongi Diagnostics")
                    .font(.title2.weight(.semibold))
                Text("최근 갱신: \(format(viewModel.lastRefreshedAt))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            statusPill(viewModel.monitorStatusText, color: monitorPillColor)

            Button {
                Task { await reloadAll() }
            } label: {
                Label("새로고침", systemImage: "arrow.clockwise")
            }
            .disabled(viewModel.isRunningCommand)
        }
    }

    private var overviewTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                section("Overview") {
                    gridRows([
                        ("App version", appVersion),
                        ("Monitor status", viewModel.monitorStatusText),
                        ("Monitor pid", runtime.pid.map(String.init) ?? viewModel.monitorRunner.pid.map(String.init) ?? "-"),
                        ("CDP status", boolText(viewModel.status?.health?.cdpReachable)),
                        ("Browser mode", viewModel.status?.health?.browserMode ?? "unknown"),
                        ("Last updated", viewModel.status?.generatedAt ?? "-")
                    ])
                }

                HStack(alignment: .top, spacing: 14) {
                    sourceSummary("Codex", usage: viewModel.status?.usage?.codex)
                    sourceSummary("Claude", usage: viewModel.status?.usage?.claude)
                }

                if let actionMessage {
                    messageBox(actionMessage)
                }
            }
        }
    }

    private var sourcesTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                sourceDetails("Codex", usage: viewModel.status?.usage?.codex)
                sourceDetails("Claude", usage: viewModel.status?.usage?.claude)
            }
        }
    }

    private var recoveryTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                recoveryDetails("Codex", usage: viewModel.status?.usage?.codex)
                recoveryDetails("Claude", usage: viewModel.status?.usage?.claude)
            }
        }
    }

    private var runtimeTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                section("Monitor") {
                    gridRows([
                        ("Effective status", viewModel.monitorStatusText),
                        ("Recorded status", runtime.status ?? "-"),
                        ("PID", runtime.pid.map(String.init) ?? viewModel.monitorRunner.pid.map(String.init) ?? "-"),
                        ("PID alive", runtime.pidAlive ? "yes" : "no"),
                        ("Heartbeat", runtime.lastHeartbeatAt ?? "-"),
                        ("Heartbeat age", heartbeatAgeText(runtime.heartbeatAgeSeconds)),
                        ("Started", runtime.startedAt ?? "-"),
                        ("Updated", runtime.updatedAt ?? "-"),
                        ("Owner", runtime.owner ?? "-"),
                        ("Mode", runtime.mode ?? "-"),
                        ("Last error", runtime.lastError ?? viewModel.monitorRunner.lastError ?? "-")
                    ])
                }

                section("Paths") {
                    gridRows([
                        ("State", MongiRuntimePaths.stateFile.path),
                        ("Config", MongiRuntimePaths.configFile.path),
                        ("Runtime", MongiRuntimePaths.runtimeFile.path),
                        ("Commands", MongiRuntimePaths.commandsFile.path),
                        ("Monitor log", MongiRuntimePaths.logsDirectory.appendingPathComponent("monitor.log").path),
                        ("Error log", MongiRuntimePaths.logsDirectory.appendingPathComponent("error.log").path),
                        ("Health log", MongiRuntimePaths.logsDirectory.appendingPathComponent("health.log").path),
                        ("Lock", MongiRuntimePaths.lockFile.path),
                        ("Node path", runtime.nodePath ?? viewModel.monitorRunner.nodePath ?? "-"),
                        ("Monitor entrypoint", runtime.entrypoint ?? "-")
                    ])
                }
            }
        }
    }

    private var backgroundTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                section("Start at Login") {
                    VStack(alignment: .leading, spacing: 10) {
                        Toggle(isOn: Binding(
                            get: { viewModel.loginItemState == .enabled },
                            set: { viewModel.setLoginItemEnabled($0) }
                        )) {
                            Text("로그인 시 Mongi 자동 실행")
                        }
                        .toggleStyle(.switch)
                        .disabled(viewModel.loginItemState == .unsupported)

                        gridRows([
                            ("Login Item 상태", viewModel.loginItemState.displayText)
                        ])

                        if let message = viewModel.loginItemMessage {
                            messageBox(message)
                        }

                        Text("켜기 전에는 자동으로 등록되지 않습니다. macOS가 승인을 요구하면 시스템 설정 > 일반 > 로그인 항목에서 허용하세요.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                section("Background Monitor") {
                    gridRows([
                        ("Effective status", viewModel.monitorStatusText),
                        ("Recorded status", runtime.status ?? "-"),
                        ("Owner", runtime.owner ?? "-"),
                        ("Mode", runtime.mode ?? "-"),
                        ("PID", runtime.pid.map(String.init) ?? "-"),
                        ("PID alive", runtime.pidAlive ? "yes" : "no"),
                        ("Heartbeat", runtime.lastHeartbeatAt ?? "-"),
                        ("Heartbeat age", heartbeatAgeText(runtime.heartbeatAgeSeconds))
                    ])
                }

                section("Lock") {
                    gridRows([
                        ("Lock present", runtime.hasLock ? "yes" : "no"),
                        ("Lock PID", runtime.lockPid.map(String.init) ?? "-"),
                        ("Lock owner", runtime.lockOwner ?? "-"),
                        ("Lock mode", runtime.lockMode ?? "-"),
                        ("Lock holder alive", runtime.hasLock ? (runtime.lockAlive ? "yes" : "no (stale)") : "-")
                    ])
                }

                HStack(spacing: 10) {
                    Button {
                        viewModel.restartMonitor()
                        Task { await reloadAll() }
                    } label: {
                        Label("Restart Monitor", systemImage: "power")
                    }
                    .disabled(viewModel.isRunningCommand)

                    Button {
                        viewModel.refreshMonitorRuntime()
                        viewModel.refreshLoginItemState()
                        refreshDiagnostics()
                    } label: {
                        Label("배경 상태 새로고침", systemImage: "arrow.clockwise")
                    }
                }

                if let summary = viewModel.monitorRunner.lastStartSummary {
                    messageBox(summary)
                }
            }
        }
    }

    private var monitorPillColor: Color {
        if viewModel.monitorIsHealthy { return .green }
        switch viewModel.monitorRuntime.effective {
        case .stale, .crashed, .failed: return .red
        default: return .orange
        }
    }

    private func heartbeatAgeText(_ seconds: Double?) -> String {
        guard let seconds else { return "-" }
        if seconds < 0 { return "방금" }
        return "\(Int(seconds))s 전"
    }

    private var actionsTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                section("Actions") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 10)], alignment: .leading, spacing: 10) {
                        actionButton("Refresh Now", icon: "arrow.clockwise") {
                            await writeCommandAndRefresh(type: "refresh-now", source: nil)
                        }
                        actionButton("Reconnect Browser", icon: "link") {
                            await writeCommandAndRefresh(type: "reconnect-browser", source: nil)
                        }
                        actionButton("Reload Codex Tab", icon: "arrow.triangle.2.circlepath") {
                            await writeCommandAndRefresh(type: "reload-source", source: "codex")
                        }
                        actionButton("Reload Claude Tab", icon: "arrow.triangle.2.circlepath") {
                            await writeCommandAndRefresh(type: "reload-source", source: "claude")
                        }
                        actionButton("Restart Monitor", icon: "power") {
                            viewModel.restartMonitor()
                            await reloadAll()
                        }
                        actionButton("Run Health Check", icon: "stethoscope") {
                            await runHealthCheck()
                        }
                        actionButton("Open State Folder", icon: "folder") {
                            open(MongiRuntimePaths.appSupportDirectory)
                        }
                        actionButton("Open Logs Folder", icon: "doc.text") {
                            open(MongiRuntimePaths.logsDirectory)
                        }
                        actionButton("Copy Diagnostics Summary", icon: "doc.on.doc") {
                            copySummary()
                        }
                    }
                }

                if let actionMessage {
                    messageBox(actionMessage)
                }

                if let healthResult {
                    section("Health Check Result") {
                        Text(healthResult)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }

    private var logsTab: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Logs")
                    .font(.headline)
                Spacer()
                Button {
                    refreshDiagnostics()
                } label: {
                    Label("로그 새로고침", systemImage: "arrow.clockwise")
                }
            }

            TabView {
                logText(monitorLog)
                    .tabItem { Text("monitor.log") }
                logText(errorLog)
                    .tabItem { Text("error.log") }
                logText(healthLog)
                    .tabItem { Text("health.log") }
            }
        }
    }

    private func sourceSummary(_ title: String, usage: MongiStatus.ServiceUsage?) -> some View {
        section(title) {
            gridRows([
                ("Backend", usage?.backend ?? "unknown"),
                ("Status", usage?.status ?? "unknown"),
                ("Freshness", usage?.freshness ?? "unknown"),
                ("Usage", usageText(usage)),
                ("Last fresh read", usage?.lastFreshReadAt ?? usage?.lastSuccessfulCheckedAt ?? "-"),
                ("Failures", usage?.consecutiveFailures.map(String.init) ?? usage?.failures.map(String.init) ?? "0"),
                ("Last recovery", usage?.lastRecoveryAction ?? "-")
            ])
        }
    }

    private func sourceDetails(_ title: String, usage: MongiStatus.ServiceUsage?) -> some View {
        section(title) {
            gridRows([
                ("Backend", usage?.backend ?? "unknown"),
                ("Status", usage?.status ?? "unknown"),
                ("Freshness", usage?.freshness ?? "unknown"),
                ("Short remaining", percent(usage?.shortRemaining)),
                ("Weekly remaining", percent(usage?.weeklyRemaining)),
                ("Short used", percent(usage?.shortUsed)),
                ("Weekly used", percent(usage?.weeklyUsed)),
                ("Last fresh read", usage?.lastFreshReadAt ?? usage?.lastSuccessfulCheckedAt ?? "-"),
                ("Last attempt", usage?.lastAttemptAt ?? usage?.lastAttemptedAt ?? "-"),
                ("Consecutive failures", usage?.consecutiveFailures.map(String.init) ?? usage?.failures.map(String.init) ?? "0"),
                ("Last error", summarize(usage?.lastError ?? usage?.lastParseFailureReason)),
                ("Target found", optionalBoolText(usage?.targetFound))
            ])
        }
    }

    private func recoveryDetails(_ title: String, usage: MongiStatus.ServiceUsage?) -> some View {
        section(title) {
            gridRows([
                ("Last recovery action", usage?.lastRecoveryAction ?? "-"),
                ("Last reload", usage?.lastReloadAt ?? "-"),
                ("Cooldown remaining", cooldownText(usage?.reloadCooldownRemainingMs)),
                ("Target rediscovery", targetRecoveryText(usage)),
                ("Status", usage?.status ?? "unknown"),
                ("Freshness", usage?.freshness ?? "unknown")
            ])
        }
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 8))
    }

    private func gridRows(_ rows: [(String, String)]) -> some View {
        Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 7) {
            ForEach(rows, id: \.0) { label, value in
                GridRow {
                    Text(label)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    Text(DiagnosticsRedactor.redact(value))
                        .font(.caption)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func actionButton(_ title: String, icon: String, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            Label(title, systemImage: icon)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .disabled(viewModel.isRunningCommand)
    }

    private func logText(_ value: String) -> some View {
        ScrollView {
            Text(value)
                .font(.system(.caption, design: .monospaced))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
        }
        .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))
    }

    private func messageBox(_ message: String) -> some View {
        Text(DiagnosticsRedactor.redact(message))
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(nsColor: .separatorColor).opacity(0.16), in: RoundedRectangle(cornerRadius: 8))
    }

    private func statusPill(_ value: String, color: Color) -> some View {
        Text(value)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(color, in: Capsule())
    }

    private func reloadAll() async {
        await viewModel.loadStatus(showOutput: false)
        viewModel.refreshMonitorRuntime()
        viewModel.refreshLoginItemState()
        refreshDiagnostics()
    }

    private func refreshDiagnostics() {
        runtime = RuntimeDiagnosticsReader.read()
        monitorLog = LogTailReader.tail(url: MongiRuntimePaths.logsDirectory.appendingPathComponent("monitor.log"))
        errorLog = LogTailReader.tail(url: MongiRuntimePaths.logsDirectory.appendingPathComponent("error.log"))
        healthLog = LogTailReader.tail(url: MongiRuntimePaths.logsDirectory.appendingPathComponent("health.log"))
    }

    private func writeCommandAndRefresh(type: String, source: String?) async {
        do {
            let commandId = try DiagnosticsCommandWriter.write(type: type, source: source)
            actionMessage = "\(type) command 기록 완료: \(commandId)"
            await viewModel.refreshStatus(showOutput: false)
        } catch {
            actionMessage = "command 기록 실패: \(error.localizedDescription)"
        }
        refreshDiagnostics()
    }

    private func runHealthCheck() async {
        do {
            _ = try DiagnosticsCommandWriter.write(type: "run-health-check")
        } catch {
            actionMessage = "health command 기록 실패: \(error.localizedDescription)"
        }

        await viewModel.runHealth()
        healthResult = viewModel.selectedOutput?.output ?? "health-check 출력이 없습니다."
        refreshDiagnostics()
    }

    private func copySummary() {
        let summary = DiagnosticsRedactor.redact([
            "Mongi Diagnostics Summary",
            "App version: \(appVersion)",
            "Monitor status: \(runtime.status ?? viewModel.monitorStatusText)",
            "Monitor pid: \(runtime.pid.map(String.init) ?? viewModel.monitorRunner.pid.map(String.init) ?? "-")",
            "Heartbeat: \(runtime.lastHeartbeatAt ?? "-")",
            "State path: \(MongiRuntimePaths.stateFile.path)",
            "Commands path: \(MongiRuntimePaths.commandsFile.path)",
            "Node path: \(runtime.nodePath ?? viewModel.monitorRunner.nodePath ?? "-")",
            "Codex: \(sourceLine(viewModel.status?.usage?.codex))",
            "Claude: \(sourceLine(viewModel.status?.usage?.claude))"
        ].joined(separator: "\n"))

        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(summary, forType: .string)
        actionMessage = "Diagnostics summary를 클립보드에 복사했습니다."
    }

    private func open(_ url: URL) {
        MongiRuntimePaths.ensureRuntimeDirectories()
        NSWorkspace.shared.open(url)
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        if let version, let build {
            return "\(version) (\(build))"
        }
        return "local"
    }

    private func sourceLine(_ usage: MongiStatus.ServiceUsage?) -> String {
        "backend=\(usage?.backend ?? "unknown"), status=\(usage?.status ?? "unknown"), freshness=\(usage?.freshness ?? "unknown"), usage=\(usageText(usage)), failures=\(usage?.consecutiveFailures.map(String.init) ?? "0"), recovery=\(usage?.lastRecoveryAction ?? "-")"
    }

    private func usageText(_ usage: MongiStatus.ServiceUsage?) -> String {
        let short = percent(usage?.shortRemaining)
        let weekly = percent(usage?.weeklyRemaining)
        return "short \(short), weekly \(weekly)"
    }

    private func percent(_ value: Int?) -> String {
        guard let value else { return "unknown" }
        return "\(value)%"
    }

    private func cooldownText(_ value: Int?) -> String {
        guard let value else { return "unknown" }
        if value <= 0 { return "ready" }
        return "\(value / 1000)s"
    }

    private func targetRecoveryText(_ usage: MongiStatus.ServiceUsage?) -> String {
        if usage?.targetFound == true {
            return "target available"
        }
        if usage?.targetFound == false {
            return "target missing"
        }
        return usage?.lastRecoveryAction?.contains("target-rediscovery") == true ? usage?.lastRecoveryAction ?? "unknown" : "unknown"
    }

    private func summarize(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "-" }
        return String(DiagnosticsRedactor.redact(value).prefix(180))
    }

    private func boolText(_ value: Bool?) -> String {
        guard let value else { return "unknown" }
        return value ? "reachable" : "unreachable"
    }

    private func optionalBoolText(_ value: Bool?) -> String {
        guard let value else { return "unknown" }
        return value ? "true" : "false"
    }

    private func format(_ date: Date?) -> String {
        guard let date else { return "아직 없음" }
        return date.formatted(date: .abbreviated, time: .standard)
    }
}
