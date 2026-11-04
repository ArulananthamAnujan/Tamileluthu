import UIKit
import WebKit

/// Shows the live website (Info.plist key ThiruthiAppURL, set from the APP_URL
/// build setting) in a full-screen web view and connects it to the phone:
/// - photo buttons use the camera and photo library (built into WKWebView),
/// - window.ThiruthiNative.sharePdf / savePdf (the same bridge the Android app has)
///   open the iPhone share sheet with the PDF (WhatsApp, Mail, Save to Files…),
/// - alert / confirm / prompt dialogs work,
/// - links to other websites and apps (WhatsApp, email, phone) open outside the app.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {

    private static let brand = UIColor(red: 11 / 255, green: 53 / 255, blue: 54 / 255, alpha: 1)
    private static let bridgeName = "thiruthi"
    private static let maxPdfBytes = 30 * 1024 * 1024

    /// The page script that gives the website the same window.ThiruthiNative bridge as the Android app.
    private static let bridgeScript = """
    (function () {
      if (window.ThiruthiNative) return;
      function send(data, name) {
        try {
          window.webkit.messageHandlers.\(bridgeName).postMessage({ action: 'sharePdf', data: String(data || ''), name: String(name || 'report.pdf') });
          return 'ok';
        } catch (e) { return String(e && e.message || e); }
      }
      window.ThiruthiNative = {
        sharePdf: function (data, name, target) { return send(data, name); },
        savePdf: function (data, name) { var r = send(data, name); return r === 'ok' ? 'shared' : r; }
      };
    })();
    """

    private var webView: WKWebView!
    private var startURL: URL?
    private var appHost = ""

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let contents = WKUserContentController()
        contents.addUserScript(WKUserScript(source: Self.bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        contents.add(WeakMessageHandler(self), name: Self.bridgeName)

        let config = WKWebViewConfiguration()
        config.userContentController = contents
        // The website shows its app layout and hides purchases when it sees this.
        config.applicationNameForUserAgent = "Mobile/15E148 ThiruthiApp/1.0 ThiruthiIOS/1.0"
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = Self.brand
        web.scrollView.backgroundColor = Self.brand
        // The website handles the notch and home bar itself (viewport-fit=cover + safe-area insets).
        web.scrollView.contentInsetAdjustmentBehavior = .never
        webView = web
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let raw = (Bundle.main.object(forInfoDictionaryKey: "ThiruthiAppURL") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: raw), url.scheme?.lowercased() == "https", let host = url.host, !host.isEmpty else {
            showMessage(title: "Website address missing",
                        text: "This copy of the app was built without the website address (APP_URL). Please install the latest version.",
                        retry: false)
            return
        }
        startURL = url
        appHost = host.lowercased()
        webView.load(URLRequest(url: url))
    }

    // MARK: - Which pages open inside the app

    private func isOwnSite(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host == appHost
    }

    private func openOutside(_ url: URL) {
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let scheme = url.scheme?.lowercased() ?? ""
        switch scheme {
        case "about", "blob", "data":
            decisionHandler(.allow)
        case "http", "https":
            // Pages inside frames (e.g. embedded audio or video) load normally.
            if isOwnSite(url) || navigationAction.targetFrame?.isMainFrame == false {
                decisionHandler(.allow)
            } else {
                openOutside(url)          // other websites open in Safari
                decisionHandler(.cancel)
            }
        default:
            openOutside(url)              // whatsapp:, mailto:, tel:, sms: …
            decisionHandler(.cancel)
        }
    }

    /// Links that ask for a new window (target="_blank").
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isOwnSite(url) { webView.load(URLRequest(url: url)) } else { openOutside(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled || code == 102 { return } // 102: a link we opened outside the app
        showMessage(title: "No connection", text: "Check your internet connection and try again.", retry: true)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: - alert(), confirm() and prompt()

    private func topController() -> UIViewController {
        var top: UIViewController = self
        while let next = top.presentedViewController { top = next }
        return top
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        topController().present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        topController().present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        topController().present(alert, animated: true)
    }

    // MARK: - PDF sharing (window.ThiruthiNative)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only our own website's pages may use the bridge.
        guard message.name == Self.bridgeName, message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host.lowercased() == appHost,
              let body = message.body as? [String: Any],
              let base64 = body["data"] as? String, base64.count < Self.maxPdfBytes * 4 / 3 + 16,
              let data = Data(base64Encoded: base64), !data.isEmpty, data.count <= Self.maxPdfBytes else { return }
        sharePdf(data, name: body["name"] as? String ?? "report.pdf")
    }

    private func sharePdf(_ data: Data, name: String) {
        // A plain file name ending in .pdf, inside the app's own temporary folder.
        var safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>").union(.newlines)).joined(separator: "-")
        safe = String(safe.prefix(80)).trimmingCharacters(in: .whitespaces)
        if safe.isEmpty { safe = "report" }
        if !safe.lowercased().hasSuffix(".pdf") { safe += ".pdf" }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("pdf", isDirectory: true)
        try? FileManager.default.removeItem(at: folder)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent(safe)
        do { try data.write(to: file, options: .atomic) } catch { return }

        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        if let popover = sheet.popoverPresentationController {   // iPad
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1)
        }
        topController().present(sheet, animated: true)
    }

    // MARK: - Offline / setup message

    private func showMessage(title: String, text: String, retry: Bool) {
        let esc = { (s: String) in s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;") }
        let button = retry && startURL != nil ? "<p><a href=\"\(startURL!.absoluteString)\">Try again</a></p>" : ""
        let html = """
        <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B3536;color:#fff;font:17px -apple-system,sans-serif;text-align:center">
        <div style="padding:32px"><div style="font-size:48px">அ</div><h2>\(esc(title))</h2><p style="opacity:.8">\(esc(text))</p>
        <style>a{display:inline-block;margin-top:12px;padding:12px 28px;border-radius:12px;background:#E3B04B;color:#0B3536;font-weight:700;text-decoration:none}</style>\(button)</div>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}

/// Lets the web view call us without keeping this screen alive forever.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
