// Phase G Spike 4 — minimal WKWebView prototype.
//
// Loads a URL in a WKWebView, persists cookies (so a login survives restarts),
// and after navigation extracts DOM text via evaluateJavaScript. Prints a short,
// redacted summary and exits. This is a STANDALONE spike tool, not wired into
// the Mongi app.
//
// Build:  swiftc MongiWebViewSpike.swift -o mongi-webview-spike
// Run:    ./mongi-webview-spike "https://example.com" 8
//   arg1 = URL, arg2 = seconds to wait before extracting (for hydration)
//
// Security: the app does not store credentials itself; it relies on WKWebView's
// own persistent cookie store (WKWebsiteDataStore.default()). No tokens are
// printed.

import Cocoa
import WebKit

final class Spike: NSObject, WKNavigationDelegate {
    let webView: WKWebView
    let waitSeconds: Double
    var didExtract = false

    init(waitSeconds: Double) {
        let cfg = WKWebViewConfiguration()
        // persistent store => cookies/session survive between runs
        cfg.websiteDataStore = WKWebsiteDataStore.default()
        self.webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1200, height: 900),
                                 configuration: cfg)
        self.waitSeconds = waitSeconds
        super.init()
        self.webView.navigationDelegate = self
        // a realistic UA helps avoid trivial bot blocks
        self.webView.customUserAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    }

    func load(_ url: URL) {
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !didExtract else { return }
        // wait for SPA hydration then extract
        DispatchQueue.main.asyncAfter(deadline: .now() + waitSeconds) { [weak self] in
            self?.extract()
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("{\"ok\":false,\"stage\":\"navigation\",\"error\":\"\(error.localizedDescription)\"}")
        NSApp.terminate(nil)
    }

    func extract() {
        didExtract = true
        let js = """
        (function(){
          var t = (document.body ? document.body.innerText : "") || "";
          var m = t.match(/(\\d{1,3})\\s*%/g) || [];
          return JSON.stringify({
            url: location.href,
            title: document.title,
            textLength: t.length,
            percentTokens: m.slice(0, 8),
            hasTurnstile: /challenge|turnstile|verify you are human/i.test(t)
          });
        })()
        """
        webView.evaluateJavaScript(js) { result, error in
            if let error = error {
                print("{\"ok\":false,\"stage\":\"evaluateJS\",\"error\":\"\(error.localizedDescription)\"}")
            } else if let json = result as? String {
                print(json)
            } else {
                print("{\"ok\":false,\"stage\":\"evaluateJS\",\"error\":\"no result\"}")
            }
            NSApp.terminate(nil)
        }
    }
}

let args = CommandLine.arguments
let urlString = args.count > 1 ? args[1] : "https://example.com"
let waitSeconds = args.count > 2 ? (Double(args[2]) ?? 6) : 6
guard let url = URL(string: urlString) else {
    FileHandle.standardError.write("invalid url\n".data(using: .utf8)!)
    exit(2)
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // no dock icon; runs without a visible window
let spike = Spike(waitSeconds: waitSeconds)
spike.load(url)

// safety timeout so the spike never hangs forever
DispatchQueue.main.asyncAfter(deadline: .now() + waitSeconds + 25) {
    print("{\"ok\":false,\"stage\":\"timeout\"}")
    NSApp.terminate(nil)
}
app.run()
