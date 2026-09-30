// A knowledge graph in a SwiftUI app (iOS 16+ / macOS 13+):
// the standalone script is bundled as a resource, the graph data is written into
// the page as window.KnowledgeGraphConfig, and the page talks back through the
// `knowledgeGraph` script message handler (opened nodes and changed settings).
//
// Add to your target: this file and dist/standalone/knowledge-graph.js (or
// force3d-graph.js / semantic-graph.js) from the 2d-3d-knowledge-graph package.
//
// 2D-3D Knowledge Graph Package by Hung Ngo (MIT).
import SwiftUI
import WebKit

public struct KnowledgeGraphView {
    /// "knowledge-graph", "force3d-graph" or "semantic-graph"
    public var script: String = "knowledge-graph"
    /// window.KnowledgeGraphConfig as JSON: sources (with `data` inline), semantic, compact …
    public var configJSON: String
    /// A node was opened: `note` is the path to show, `quote` a passage to highlight.
    public var onOpen: (_ note: String, _ quote: String) -> Void

    public init(script: String = "knowledge-graph", configJSON: String, onOpen: @escaping (String, String) -> Void) {
        self.script = script
        self.configJSON = configJSON
        self.onOpen = onOpen
    }

    static let handler = "knowledgeGraph"
    static let settingsPrefix = "kg."

    func html() -> String? {
        guard let url = Bundle.main.url(forResource: script, withExtension: "js"),
              let js = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        // Saved settings go back in, so the graph reopens as the user left it.
        let saved = UserDefaults.standard.dictionaryRepresentation()
            .filter { $0.key.hasPrefix(Self.settingsPrefix) }.compactMapValues { $0 as? String }
        let settings = (try? JSONSerialization.data(withJSONObject: saved)).map { String(decoding: $0, as: UTF8.self) } ?? "{}"
        // `</` is escaped so no note title can close the script element.
        let config = configJSON.dropLast().appending(",\"settings\":\(settings)}")
            .replacingOccurrences(of: "</", with: "<\\/")
        return """
        <!doctype html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
        <script>window.KnowledgeGraphConfig = \(config);</script></head>
        <body><div id="app"></div><script>\(js)</script></body></html>
        """
    }

    public final class Coordinator: NSObject, WKScriptMessageHandler {
        var onOpen: (String, String) -> Void
        init(onOpen: @escaping (String, String) -> Void) { self.onOpen = onOpen }
        public func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "open":
                guard let note = body["note"] as? String else { return }
                onOpen(note, body["quote"] as? String ?? "")
            case "settings":
                guard let key = body["key"] as? String, key.hasPrefix(KnowledgeGraphView.settingsPrefix),
                      let json = body["json"] as? String, json.utf8.count < 64_000 else { return }
                UserDefaults.standard.set(json, forKey: key)
            default: break
            }
        }
    }

    public func makeCoordinator() -> Coordinator { Coordinator(onOpen: onOpen) }

    func makeWebView(_ coordinator: Coordinator) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(coordinator, name: Self.handler)
        let web = WKWebView(frame: .zero, configuration: config)
        #if os(iOS)
        web.isOpaque = false
        web.scrollView.isScrollEnabled = false
        #endif
        if let page = html() { web.loadHTMLString(page, baseURL: nil) }
        return web
    }
}

#if os(iOS)
extension KnowledgeGraphView: UIViewRepresentable {
    public func makeUIView(context: Context) -> WKWebView { makeWebView(context.coordinator) }
    public func updateUIView(_ view: WKWebView, context: Context) { context.coordinator.onOpen = onOpen }
    public static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName: handler)
    }
}
#else
extension KnowledgeGraphView: NSViewRepresentable {
    public func makeNSView(context: Context) -> WKWebView { makeWebView(context.coordinator) }
    public func updateNSView(_ view: WKWebView, context: Context) { context.coordinator.onOpen = onOpen }
    public static func dismantleNSView(_ view: WKWebView, coordinator: Coordinator) {
        view.configuration.userContentController.removeScriptMessageHandler(forName: handler)
    }
}
#endif

// Usage:
//
//   let links = try String(contentsOf: Bundle.main.url(forResource: "links", withExtension: "json")!)
//   KnowledgeGraphView(configJSON: """
//     {"sources":[{"id":"links","label":"Links","settingsKey":"kg.links","groups":[],"data":\(links)}]}
//     """) { note, quote in router.open(note, highlighting: quote) }
