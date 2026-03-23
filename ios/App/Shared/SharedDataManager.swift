import Foundation
import WidgetKit

/// Manages shared state between the main app, widget, and iCloud.
///
/// Data flows:
///   Web → Native plugin → App Group UserDefaults (widget reads this)
///                        → NSUbiquitousKeyValueStore (iCloud sync)
///   iCloud → App launch merge → Web (via plugin callback)
final class SharedDataManager {

    static let shared = SharedDataManager()

    static let appGroupID = "group.com.jasoncabot.linkagram"

    private let iCloud = NSUbiquitousKeyValueStore.default
    private let appGroup: UserDefaults?

    // Keys stored in both App Group and iCloud
    private enum Key {
        static let streak = "streak"
        static let maxStreak = "maxStreak"
        static let played = "played"
        static let completed = "completed"
        static let hintCount = "hints"
        static let fixes = "fixes"

        // Widget-only keys (App Group only, not synced to iCloud)
        static let todayLetters = "widget.todayLetters"
        static let todayKey = "widget.todayKey"
        static let todayStatus = "widget.todayStatus" // "not_started", "in_progress", "completed"
        static let todayWordsFound = "widget.todayWordsFound"
        static let todayWordsTotal = "widget.todayWordsTotal"
    }

    private init() {
        appGroup = UserDefaults(suiteName: SharedDataManager.appGroupID)
    }

    // MARK: - Write game state (called from Capacitor plugin)

    func syncGameState(
        streak: Int,
        maxStreak: Int,
        played: [String],
        completed: [String],
        hintCount: Int,
        fixes: [String]
    ) {
        // Write to App Group for widget
        appGroup?.set(streak, forKey: Key.streak)
        appGroup?.set(maxStreak, forKey: Key.maxStreak)
        appGroup?.set(played, forKey: Key.played)
        appGroup?.set(completed, forKey: Key.completed)
        appGroup?.set(hintCount, forKey: Key.hintCount)
        appGroup?.set(fixes, forKey: Key.fixes)

        // Write to iCloud
        iCloud.set(streak as NSNumber, forKey: Key.streak)
        iCloud.set(maxStreak as NSNumber, forKey: Key.maxStreak)
        iCloud.set(played, forKey: Key.played)
        iCloud.set(completed, forKey: Key.completed)
        iCloud.set(hintCount as NSNumber, forKey: Key.hintCount)
        iCloud.set(fixes, forKey: Key.fixes)
        iCloud.synchronize()
    }

    // MARK: - Widget data

    func updateWidgetData(
        todayKey: String,
        letters: [String],
        status: String,
        wordsFound: Int,
        wordsTotal: Int
    ) {
        appGroup?.set(todayKey, forKey: Key.todayKey)
        appGroup?.set(letters, forKey: Key.todayLetters)
        appGroup?.set(status, forKey: Key.todayStatus)
        appGroup?.set(wordsFound, forKey: Key.todayWordsFound)
        appGroup?.set(wordsTotal, forKey: Key.todayWordsTotal)

        // Tell WidgetKit to refresh
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - Read widget data (called by widget)

    func widgetTodayKey() -> String? {
        return appGroup?.string(forKey: Key.todayKey)
    }

    func widgetTodayLetters() -> [String]? {
        return appGroup?.stringArray(forKey: Key.todayLetters)
    }

    func widgetTodayStatus() -> String {
        return appGroup?.string(forKey: Key.todayStatus) ?? "not_started"
    }

    func widgetWordsFound() -> Int {
        return appGroup?.integer(forKey: Key.todayWordsFound) ?? 0
    }

    func widgetWordsTotal() -> Int {
        return appGroup?.integer(forKey: Key.todayWordsTotal) ?? 0
    }

    func widgetStreak() -> Int {
        return appGroup?.integer(forKey: Key.streak) ?? 0
    }

    // MARK: - Dictionary cache

    /// Write the dictionary word list to the App Group container as a JSON file.
    func cacheDictionary(words: [String]) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SharedDataManager.appGroupID
        ) else { return }
        let fileURL = containerURL.appendingPathComponent("dictionary.json")
        if let data = try? JSONSerialization.data(withJSONObject: words) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    /// Read the cached dictionary from the App Group container.
    func cachedDictionary() -> [String]? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SharedDataManager.appGroupID
        ) else { return nil }
        let fileURL = containerURL.appendingPathComponent("dictionary.json")
        guard let data = try? Data(contentsOf: fileURL),
              let words = try? JSONSerialization.jsonObject(with: data) as? [String] else {
            return nil
        }
        return words
    }

    /// Seed the App Group dictionary cache from the bundled small.json if no cache exists yet.
    func seedDictionaryFromBundleIfNeeded() {
        // Skip if already cached
        if let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SharedDataManager.appGroupID
        ) {
            let fileURL = containerURL.appendingPathComponent("dictionary.json")
            if FileManager.default.fileExists(atPath: fileURL.path) { return }
        }

        // Look for the bundled dictionary in the main app bundle
        guard let bundleURL = Bundle.main.url(forResource: "small", withExtension: "json", subdirectory: "public/data"),
              let data = try? Data(contentsOf: bundleURL),
              let words = try? JSONSerialization.jsonObject(with: data) as? [String] else {
            return
        }
        cacheDictionary(words: words)
    }

    // MARK: - iCloud sync (called on app launch)

    /// Returns merged state from iCloud if it has newer/better data, nil otherwise.
    func mergeFromICloud() -> [String: Any]? {
        iCloud.synchronize()

        let cloudStreak = (iCloud.object(forKey: Key.streak) as? NSNumber)?.intValue
        let cloudMaxStreak = (iCloud.object(forKey: Key.maxStreak) as? NSNumber)?.intValue
        let cloudPlayed = iCloud.array(forKey: Key.played) as? [String]
        let cloudCompleted = iCloud.array(forKey: Key.completed) as? [String]
        let cloudHintCount = (iCloud.object(forKey: Key.hintCount) as? NSNumber)?.intValue
        let cloudFixes = iCloud.array(forKey: Key.fixes) as? [String]

        // If there's no cloud data at all, nothing to merge
        guard cloudPlayed != nil || cloudCompleted != nil else { return nil }

        let localPlayed = appGroup?.stringArray(forKey: Key.played) ?? []
        let localCompleted = appGroup?.stringArray(forKey: Key.completed) ?? []

        // Merge: take the union of played/completed arrays, and the max of streaks
        let mergedPlayed = Array(Set(localPlayed).union(Set(cloudPlayed ?? [])))
            .sorted()
        let mergedCompleted = Array(Set(localCompleted).union(Set(cloudCompleted ?? [])))
            .sorted()
        let mergedMaxStreak = max(
            appGroup?.integer(forKey: Key.maxStreak) ?? 0,
            cloudMaxStreak ?? 0
        )
        // For current streak, take the higher value — the web side will recalculate
        let mergedStreak = max(
            appGroup?.integer(forKey: Key.streak) ?? 0,
            cloudStreak ?? 0
        )
        let mergedHintCount = max(
            appGroup?.integer(forKey: Key.hintCount) ?? 0,
            cloudHintCount ?? 0
        )
        let mergedFixes = Array(Set(appGroup?.stringArray(forKey: Key.fixes) ?? [])
            .union(Set(cloudFixes ?? [])))

        // Write merged data back
        syncGameState(
            streak: mergedStreak,
            maxStreak: mergedMaxStreak,
            played: mergedPlayed,
            completed: mergedCompleted,
            hintCount: mergedHintCount,
            fixes: mergedFixes
        )

        // Only return if cloud had data the local didn't
        let cloudHasMore = (cloudPlayed?.count ?? 0) > localPlayed.count
            || (cloudCompleted?.count ?? 0) > localCompleted.count

        guard cloudHasMore else { return nil }

        return [
            "streak": mergedStreak,
            "maxStreak": mergedMaxStreak,
            "played": mergedPlayed,
            "completed": mergedCompleted,
            "hintCount": mergedHintCount,
            "fixes": mergedFixes
        ]
    }

    /// Register for iCloud change notifications.
    func startObservingICloudChanges(handler: @escaping () -> Void) {
        NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: iCloud,
            queue: .main
        ) { _ in
            handler()
        }
        iCloud.synchronize()
    }
}
