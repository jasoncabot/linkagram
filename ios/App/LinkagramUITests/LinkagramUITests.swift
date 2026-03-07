import XCTest

class LinkagramUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testScreenshots() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launch()

        // Wait for the game board to load
        let board = app.otherElements["board"]
        _ = board.waitForExistence(timeout: 10)

        // Give the WebView time to fully render
        sleep(3)

        snapshot("01_GameBoard")

        // Tap the how-to-play button to show the instructions modal
        let howToPlay = app.buttons["How to play"]
        if howToPlay.waitForExistence(timeout: 5) {
            howToPlay.tap()
            sleep(1)
            snapshot("02_HowToPlay")

            // Dismiss the modal
            let playButton = app.buttons["Play"]
            if playButton.exists {
                playButton.tap()
                sleep(1)
            }
        }

        // Tap the stats button to show "Your Personal Stats" modal
        let stats = app.buttons["Stats"]
        if stats.waitForExistence(timeout: 5) {
            stats.tap()
            sleep(1)
            snapshot("03_YourPersonalStats")
        }
    }
}
