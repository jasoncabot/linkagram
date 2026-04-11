import UIKit
import WebKit
import Capacitor

class ViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LinkagramNativePlugin())

        guard ProcessInfo.processInfo.arguments.contains("-screenshotMode") else {
            return
        }

        let script = """
        window.__screenshotMode = true;

        const _today = new Date();
        const _pad = n => String(n).padStart(2, '0');
        const _fmt = d => String(d.getFullYear()) + _pad(d.getMonth() + 1) + _pad(d.getDate());

        const _played = [];
        for (let i = 88; i >= 0; i--) {
            const d = new Date(_today);
            d.setDate(d.getDate() - i);
            _played.push(_fmt(d));
        }

        window.__screenshotStats = {
            played: _played,
            completed: _played.slice(0, 76),
            streak: 12,
            maxStreak: 18,
            fixes: ['streaks2']
        };
        """

        let userScript = WKUserScript(
            source: script,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        webView?.configuration.userContentController.addUserScript(userScript)
    }
}
