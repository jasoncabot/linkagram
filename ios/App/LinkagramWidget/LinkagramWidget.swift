import WidgetKit
import SwiftUI

// MARK: - Timeline Provider

struct LinkagramProvider: TimelineProvider {

    func placeholder(in context: Context) -> LinkagramEntry {
        LinkagramEntry(
            date: Date(),
            letters: "etaoinsrhdlucmfy".map { String($0) },
            streak: 5,
            status: "not_started",
            wordsFound: 0,
            wordsTotal: 24
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (LinkagramEntry) -> Void) {
        completion(entryForNow())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LinkagramEntry>) -> Void) {
        let entry = entryForNow()

        // Refresh at midnight so the widget shows the new puzzle
        let cal = Calendar.current
        let tomorrow = cal.startOfDay(for: cal.date(byAdding: .day, value: 1, to: Date())!)
        let timeline = Timeline(entries: [entry], policy: .after(tomorrow))
        completion(timeline)
    }

    private func entryForNow() -> LinkagramEntry {
        let data = SharedDataManager.shared
        let todayKey = BoardGenerator.keyForDate(Date())

        // Use App Group data if it's for today, otherwise generate from JS
        let letters: [String]
        if data.widgetTodayKey() == todayKey, let stored = data.widgetTodayLetters() {
            letters = stored
        } else {
            letters = BoardGenerator.lettersForToday()
        }

        return LinkagramEntry(
            date: Date(),
            letters: letters,
            streak: data.widgetStreak(),
            status: data.widgetTodayKey() == todayKey ? data.widgetTodayStatus() : "not_started",
            wordsFound: data.widgetTodayKey() == todayKey ? data.widgetWordsFound() : 0,
            wordsTotal: data.widgetTodayKey() == todayKey ? data.widgetWordsTotal() : 0
        )
    }
}

// MARK: - Entry

struct LinkagramEntry: TimelineEntry {
    let date: Date
    let letters: [String]
    let streak: Int
    let status: String   // "not_started", "in_progress", "completed"
    let wordsFound: Int
    let wordsTotal: Int
}

// MARK: - Widget Views

struct LetterGridView: View {
    let letters: [String]
    let completed: Bool

    var body: some View {
        VStack(spacing: 3) {
            ForEach(0..<4, id: \.self) { row in
                HStack(spacing: 3) {
                    ForEach(0..<4, id: \.self) { col in
                        let index = row * 4 + col
                        Text(letters[index].uppercased())
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(completed ? .green : .white)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .aspectRatio(1, contentMode: .fit)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(completed
                                          ? Color(red: 0.15, green: 0.35, blue: 0.15)
                                          : Color(red: 0.2, green: 0.1, blue: 0.4))
                            )
                    }
                }
            }
        }
    }
}

struct LinkagramWidgetEntryView: View {
    var entry: LinkagramEntry

    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallWidget
        case .systemMedium:
            mediumWidget
        default:
            smallWidget
        }
    }

    var smallWidget: some View {
        VStack(spacing: 6) {
            LetterGridView(letters: entry.letters, completed: entry.status == "completed")
                .padding(.horizontal, 2)

            HStack(spacing: 4) {
                if entry.streak > 0 {
                    Image(systemName: "flame.fill")
                        .font(.caption2)
                        .foregroundColor(.orange)
                    Text("\(entry.streak)")
                        .font(.caption2.bold())
                        .foregroundColor(.orange)
                }

                Spacer()

                statusLabel
            }
            .padding(.horizontal, 2)
        }
        .padding(8)
        .containerBackground(for: .widget) {
            Color(red: 0.1, green: 0.04, blue: 0.18)
        }
    }

    var mediumWidget: some View {
        HStack(spacing: 12) {
            LetterGridView(letters: entry.letters, completed: entry.status == "completed")
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 8) {
                Text("Linkagram")
                    .font(.headline.bold())
                    .foregroundColor(.white)

                if entry.streak > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                            .foregroundColor(.orange)
                        Text("\(entry.streak) day streak")
                            .font(.subheadline)
                            .foregroundColor(.orange)
                    }
                }

                Spacer()

                statusBadge
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .containerBackground(for: .widget) {
            Color(red: 0.1, green: 0.04, blue: 0.18)
        }
    }

    @ViewBuilder
    var statusLabel: some View {
        switch entry.status {
        case "completed":
            Text("Done!")
                .font(.caption2.bold())
                .foregroundColor(.green)
        case "in_progress":
            Text("\(entry.wordsFound)/\(entry.wordsTotal)")
                .font(.caption2)
                .foregroundColor(.white.opacity(0.7))
        default:
            Text("Play")
                .font(.caption2.bold())
                .foregroundColor(.white.opacity(0.9))
        }
    }

    @ViewBuilder
    var statusBadge: some View {
        switch entry.status {
        case "completed":
            Label("Completed!", systemImage: "checkmark.circle.fill")
                .font(.subheadline.bold())
                .foregroundColor(.green)
        case "in_progress":
            VStack(alignment: .leading, spacing: 2) {
                Text("\(entry.wordsFound) of \(entry.wordsTotal) words")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.8))
                ProgressView(value: Double(entry.wordsFound), total: Double(max(entry.wordsTotal, 1)))
                    .tint(.purple)
            }
        default:
            Label("Tap to play", systemImage: "play.circle.fill")
                .font(.subheadline.bold())
                .foregroundColor(.white.opacity(0.9))
        }
    }
}

// MARK: - Widget Definition

@main
struct LinkagramWidget: Widget {
    let kind: String = "LinkagramWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LinkagramProvider()) { entry in
            LinkagramWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Linkagram")
        .description("See today's puzzle and track your streak.")
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabled()
    }
}
