import Foundation

struct StatusLoadResult: Sendable {
    let status: MongiStatus?
    let command: ShellResult
    let errorMessage: String?
}

struct MongiStatusService: Sendable {
    let projectRoot: String

    private var runner: ShellRunner {
        ShellRunner(workingDirectory: projectRoot)
    }

    func refreshAndLoadStatus() async -> StatusLoadResult {
        let refreshResult = await runner.run(
            ShellRunner.npmCommand("monitor -- --dry-run-notifications"),
            description: "npm run monitor -- --dry-run-notifications"
        )
        let statusResult = await loadStatus()

        if refreshResult.succeeded {
            return statusResult
        }

        if statusResult.status != nil {
            return StatusLoadResult(
                status: statusResult.status,
                command: refreshResult,
                errorMessage: refreshResult.errorSummary ?? "Quiet usage refresh failed; showing last saved status."
            )
        }

        return StatusLoadResult(
            status: nil,
            command: refreshResult,
            errorMessage: refreshResult.errorSummary ?? "Quiet usage refresh failed."
        )
    }

    func loadStatus() async -> StatusLoadResult {
        let result = await runner.run(ShellRunner.npmCommand("status:json"), description: "npm run status:json")

        guard result.succeeded else {
            return StatusLoadResult(
                status: nil,
                command: result,
                errorMessage: result.errorSummary ?? "status:json failed with exit code \(result.exitCode)."
            )
        }

        guard let data = result.stdout.data(using: .utf8) else {
            return StatusLoadResult(
                status: nil,
                command: result,
                errorMessage: "status:json output was not UTF-8."
            )
        }

        do {
            let decoder = JSONDecoder()
            let status = try decoder.decode(MongiStatus.self, from: data)
            return StatusLoadResult(status: status, command: result, errorMessage: nil)
        } catch {
            let sample = String(ShellResult.sanitize(result.stdout).prefix(1000))
            return StatusLoadResult(
                status: nil,
                command: result,
                errorMessage: "status:json did not return valid JSON. Run npm run status:json in Terminal to debug.\n\n\(sample)"
            )
        }
    }

    func startMongi() async -> ShellResult {
        await runner.run(ShellRunner.npmCommand("start:chrome"), description: "npm run start:chrome")
    }

    func runHealth() async -> ShellResult {
        await runner.run(ShellRunner.npmCommand("health"), description: "npm run health")
    }

    func runDailySummary() async -> ShellResult {
        await runner.run(ShellRunner.npmCommand("daily:summary"), description: "npm run daily:summary")
    }

    func runValueReview() async -> ShellResult {
        await runner.run(ShellRunner.npmCommand("value:review"), description: "npm run value:review")
    }
}
