import AppIntents

@available(iOS 16.0, *)
struct OpenLinkagramIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Today's Linkagram"
    static var description = IntentDescription("Open today's daily word puzzle")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

@available(iOS 16.0, *)
struct LinkagramShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenLinkagramIntent(),
            phrases: [
                "Open today's \(.applicationName)",
                "Play \(.applicationName)",
                "Open \(.applicationName)",
                "Start \(.applicationName) puzzle"
            ],
            shortTitle: "Play Linkagram",
            systemImageName: "character.textbox"
        )
    }
}
