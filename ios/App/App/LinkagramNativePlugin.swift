import Foundation
import Capacitor
import UserNotifications
import WidgetKit

@objc(LinkagramNativePlugin)
public class LinkagramNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LinkagramNativePlugin"
    public let jsName = "LinkagramNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncGameState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCloudState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleDailyReminder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelDailyReminder", returnType: CAPPluginReturnPromise),
    ]

    /// Sync account-level game state to App Group + iCloud.
    @objc func syncGameState(_ call: CAPPluginCall) {
        let streak = call.getInt("streak") ?? 0
        let maxStreak = call.getInt("maxStreak") ?? 0
        let played = call.getArray("played", String.self) ?? []
        let completed = call.getArray("completed", String.self) ?? []
        let hintCount = call.getInt("hintCount") ?? 0
        let fixes = call.getArray("fixes", String.self) ?? []

        SharedDataManager.shared.syncGameState(
            streak: streak,
            maxStreak: maxStreak,
            played: played,
            completed: completed,
            hintCount: hintCount,
            fixes: fixes
        )

        call.resolve(["status": "ok"])
    }

    /// Update widget-specific data (today's board state).
    @objc func updateWidgetData(_ call: CAPPluginCall) {
        let todayKey = call.getString("todayKey") ?? ""
        let letters = call.getArray("letters", String.self) ?? []
        let status = call.getString("status") ?? "not_started"
        let wordsFound = call.getInt("wordsFound") ?? 0
        let wordsTotal = call.getInt("wordsTotal") ?? 0

        SharedDataManager.shared.updateWidgetData(
            todayKey: todayKey,
            letters: letters,
            status: status,
            wordsFound: wordsFound,
            wordsTotal: wordsTotal
        )

        call.resolve(["status": "ok"])
    }

    /// Get merged state from iCloud (call on app launch to detect cross-device data).
    @objc func getCloudState(_ call: CAPPluginCall) {
        if let merged = SharedDataManager.shared.mergeFromICloud() {
            call.resolve(merged )
        } else {
            call.resolve(["status": "no_update"])
        }
    }

    /// Request notification permission. Only call after the user hits a 2-game streak.
    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                self.scheduleDailyReminderInternal()
            }
            call.resolve([
                "granted": granted,
                "error": error?.localizedDescription ?? ""
            ])
        }
    }

    /// Schedule or update the daily reminder notification.
    @objc func scheduleDailyReminder(_ call: CAPPluginCall) {
        scheduleDailyReminderInternal()
        call.resolve(["status": "ok"])
    }

    /// Cancel the daily reminder.
    @objc func cancelDailyReminder(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["daily-reminder"]
        )
        call.resolve(["status": "ok"])
    }

    // MARK: - Private

    private func scheduleDailyReminderInternal() {
        let content = UNMutableNotificationContent()
        content.title = "Linkagram"
        content.body = "Today's puzzle is ready! Can you find all the words?"
        content.sound = .default

        // Fire daily at 7:30 AM local time
        var dateComponents = DateComponents()
        dateComponents.hour = 7
        dateComponents.minute = 30

        let trigger = UNCalendarNotificationTrigger(
            dateMatching: dateComponents,
            repeats: true
        )

        let request = UNNotificationRequest(
            identifier: "daily-reminder",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to schedule daily reminder: \(error)")
            }
        }
    }
}
