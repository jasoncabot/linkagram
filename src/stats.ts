import {
  Chart,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from "chart.js";

Chart.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler
);

interface StatsData {
  allTime: {
    completions: number;
    medianTime: number;
    p90Time: number;
    avgHintsRemaining: number;
    avgHintsUsed: number;
    maxStreak: number;
  };
  today: {
    completions: number;
    medianTime: number;
    p90Time: number;
    avgHintsUsed: number;
  };
  daily: {
    date: string;
    completions: number;
    medianTime: number;
    avgHintsUsed: number;
  }[];
}

function formatTime(ms: number): string {
  if (ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}`;
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const chartColors = {
  cyan: "rgba(0, 229, 255, 0.8)",
  cyanFill: "rgba(0, 229, 255, 0.15)",
  green: "rgba(74, 222, 128, 0.8)",
  greenFill: "rgba(74, 222, 128, 0.15)",
  grid: "rgba(255, 255, 255, 0.06)",
  tick: "rgba(255, 255, 255, 0.4)",
};

function renderCharts(daily: StatsData["daily"]) {
  const labels = daily.map((d) => formatDate(d.date));

  new Chart(document.getElementById("chart-completions") as HTMLCanvasElement, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: daily.map((d) => d.completions),
          backgroundColor: chartColors.cyan,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} completions` } } },
      scales: {
        x: {
          ticks: { color: chartColors.tick, maxRotation: 45, font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: chartColors.tick, precision: 0 },
          grid: { color: chartColors.grid },
        },
      },
    },
  });

  new Chart(document.getElementById("chart-time") as HTMLCanvasElement, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: daily.map((d) => Math.round(d.medianTime / 1000)),
          borderColor: chartColors.green,
          backgroundColor: chartColors.greenFill,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const seconds = ctx.parsed.y ?? 0;
              const m = Math.floor(seconds / 60);
              const s = seconds % 60;
              return m > 0 ? `${m}m ${s}s` : `${s}s`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: chartColors.tick, maxRotation: 45, font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: chartColors.tick,
            callback: (value) => {
              const v = Number(value);
              const m = Math.floor(v / 60);
              const s = v % 60;
              return m > 0 ? `${m}m ${s}s` : `${v}s`;
            },
          },
          grid: { color: chartColors.grid },
        },
      },
    },
  });
}

async function init() {
  const loadingEl = document.getElementById("loading")!;
  const errorEl = document.getElementById("error")!;
  const dashboardEl = document.getElementById("dashboard")!;

  try {
    const resp = await fetch("/stats/data");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data: StatsData = await resp.json();

    // Today
    setText("today-completions", data.today.completions.toLocaleString());
    setText("today-median", formatTime(data.today.medianTime));
    setText("today-p90", formatTime(data.today.p90Time));
    setText("today-hints", data.today.avgHintsUsed > 0 ? data.today.avgHintsUsed.toFixed(1) : "—");

    // All time
    setText("all-completions", data.allTime.completions.toLocaleString());
    setText("all-median", formatTime(data.allTime.medianTime));
    setText("all-p90", formatTime(data.allTime.p90Time));
    setText("all-streak", data.allTime.maxStreak > 0 ? data.allTime.maxStreak.toString() : "—");

    // Charts
    if (data.daily.length > 0) {
      renderCharts(data.daily);
    }

    loadingEl.style.display = "none";
    dashboardEl.style.display = "block";
  } catch {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
  }
}

init();
