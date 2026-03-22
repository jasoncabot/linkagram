import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Prevent white flash before the WebView background loads
        window?.backgroundColor = UIColor(red: 0x1A/255.0, green: 0x0A/255.0, blue: 0x2E/255.0, alpha: 1.0)

        // Start observing iCloud key-value store changes
        SharedDataManager.shared.startObservingICloudChanges {
            // iCloud data changed externally — the web layer will pick it up next launch
        }

        // Ensure widget has today's grid even before web layer loads
        let todayKey = BoardGenerator.keyForDate(Date())
        if SharedDataManager.shared.widgetTodayKey() != todayKey {
            let letters = BoardGenerator.lettersForToday()
            SharedDataManager.shared.updateWidgetData(
                todayKey: todayKey,
                letters: letters,
                status: "not_started",
                wordsFound: 0,
                wordsTotal: 0
            )
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
