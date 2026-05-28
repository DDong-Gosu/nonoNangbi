import Foundation

enum LogTailReader {
    static func tail(url: URL, maxBytes: UInt64 = 64 * 1024, maxLines: Int = 140) -> String {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return "아직 생성된 로그 파일이 없습니다."
        }

        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let size = try handle.seekToEnd()
            let offset = size > maxBytes ? size - maxBytes : 0
            try handle.seek(toOffset: offset)
            let data = handle.readDataToEndOfFile()
            let text = String(data: data, encoding: .utf8) ?? ""
            let lines = text.split(separator: "\n", omittingEmptySubsequences: false).suffix(maxLines)
            return DiagnosticsRedactor.redact(lines.joined(separator: "\n"))
        } catch {
            return "로그를 읽지 못했습니다: \(DiagnosticsRedactor.redact(error.localizedDescription))"
        }
    }
}
