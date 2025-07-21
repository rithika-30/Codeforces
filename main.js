const userForm = document.getElementById("user-form");
const inputBox = document.getElementById("handle-input");
const toast = document.getElementById("toast");
const loader = document.getElementById("loading-indicator");
const displayedUser = document.getElementById("displayed-user");
const cardContainer = document.querySelector(".cards-container");

const API_URL = "https://codeforces.com/api/";
let handle = "";
let verdictStats = {};
let languageStats = {};
let ratingStats = {};
let heatmapData = {};

let problemsTried = new Set();
let problemsSolved = new Set();
let attemptCounts = {};
let maxAttempts = 0;
let maxAttemptedProblem = "";
let solveFrequency = {};
let maxAC = 0;
let mostSolvedProblem = "";
let activeYears = 0;

function showToast(message) {
  toast.textContent = message;
  toast.className = "show";
  setTimeout(() => {
    toast.className = toast.className.replace("show", "");
  }, 3000);
}

document.getElementById("dark-toggle").addEventListener("change", () => {
  document.body.classList.toggle("dark-mode");
});

userForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loader.style.display = "block";
  handle = inputBox.value.trim();

  verdictStats = {};
  languageStats = {};
  ratingStats = {};
  heatmapData = {};
  problemsTried.clear();
  problemsSolved.clear();
  attemptCounts = {};
  maxAttempts = 0;
  maxAttemptedProblem = "";
  solveFrequency = {};
  maxAC = 0;
  mostSolvedProblem = "";

  try {
    const submissionRes = await fetch(`${API_URL}user.status?handle=${handle}`);
    const submissionData = await submissionRes.json();

    if (!submissionData.result || submissionData.status !== "OK") {
      throw new Error("Invalid handle");
    }

    const submissions = submissionData.result;
    processSubmissions(submissions);
    loader.style.display = "none";

    displayedUser.innerText = `${handle}'s Insights`;
    drawCards();
    drawVerdictChart();
    drawLanguageChart();
    drawRatingChart();
    drawHeatMap();

  } catch (err) {
    loader.style.display = "none";
    showToast("Error: Invalid handle or network issue.");
    console.error(err);
  }
});

function processSubmissions(submissions) {
  submissions.forEach((submission) => {
    const verdict = submission.verdict || "UNKNOWN";
    verdictStats[verdict] = (verdictStats[verdict] || 0) + 1;

    const lang = submission.programmingLanguage || "Unknown";
    languageStats[lang] = (languageStats[lang] || 0) + 1;

    const rating = submission.problem.rating;
    if (rating) ratingStats[rating] = (ratingStats[rating] || 0) + 1;

    const key = `${submission.problem.contestId}-${submission.problem.name}-${submission.problem.index}`;
    problemsTried.add(key);

    if (submission.verdict === "OK") {
      problemsSolved.add(key);
      solveFrequency[key] = (solveFrequency[key] || 0) + 1;
      if (solveFrequency[key] > maxAC) {
        maxAC = solveFrequency[key];
        mostSolvedProblem = `${submission.problem.contestId}-${submission.problem.index}`;
      }
    }

    attemptCounts[key] = (attemptCounts[key] || 0) + 1;
    if (attemptCounts[key] > maxAttempts) {
      maxAttempts = attemptCounts[key];
      maxAttemptedProblem = `${submission.problem.contestId}-${submission.problem.index}`;
    }

    const date = new Date(submission.creationTimeSeconds * 1000);
    date.setHours(0, 0, 0, 0);
    const timeKey = date.valueOf();
    heatmapData[timeKey] = (heatmapData[timeKey] || 0) + 1;
  });

  const yearsStart = new Date(submissions.at(-1).creationTimeSeconds * 1000).getYear();
  const yearsEnd = new Date(submissions[0].creationTimeSeconds * 1000).getYear();
  activeYears = Math.abs(yearsEnd - yearsStart) + 1;
}

function drawCards() {
  cardContainer.innerHTML = "";

  const totalAttempts = Object.values(attemptCounts).reduce((sum, x) => sum + x, 0);
  const avgAttempts = (totalAttempts / problemsTried.size).toFixed(2);
  const oneShotSolved = Object.entries(solveFrequency).filter(
    ([key, val]) => attemptCounts[key] === 1 && val > 0
  ).length;

  const oneShotRate = ((oneShotSolved / problemsSolved.size) * 100).toFixed(1);

  const stats = [
    { title: "Problems Tried", value: problemsTried.size },
    { title: "Problems Solved", value: problemsSolved.size },
    { title: "Avg Attempts", value: avgAttempts },
    { title: "Max Attempts", value: `${maxAttempts} (${maxAttemptedProblem})` },
    { title: "One-Shot Solves", value: `${oneShotSolved} (${oneShotRate}%)` },
    { title: "Most Solved", value: `${maxAC} (${mostSolvedProblem})` }
  ];

  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.classList.add("stat-card");
    card.innerHTML = `<h3>${stat.title}</h3><p>${stat.value}</p>`;
    cardContainer.appendChild(card);
  });
}

function drawVerdictChart() {
  const data = [["Verdict", "Count"]];
  const colors = [];

  for (let key in verdictStats) {
    const shortKey = {
      OK: "AC", WRONG_ANSWER: "WA", TIME_LIMIT_EXCEEDED: "TLE",
      MEMORY_LIMIT_EXCEEDED: "MLE", RUNTIME_ERROR: "RTE",
      COMPILATION_ERROR: "CPE", SKIPPED: "SKIP", CHALLENGED: "CHLG"
    }[key] || key;

    data.push([shortKey, verdictStats[key]]);
    colors.push({ color: "#"+Math.floor(Math.random()*16777215).toString(16) });
  }

  const chartData = google.visualization.arrayToDataTable(data);
  const options = {
    title: `Submission Verdicts for ${handle}`,
    height: 300,
    pieHole: 0.3,
    slices: colors,
    fontName: "Fira Code"
  };
  new google.visualization.PieChart(document.getElementById("verdict-pie")).draw(chartData, options);
}

function drawLanguageChart() {
  const data = [["Language", "Count"]];
  for (let lang in languageStats) {
    data.push([lang, languageStats[lang]]);
  }

  const chartData = google.visualization.arrayToDataTable(data);
  const options = {
    title: `Languages Used by ${handle}`,
    height: 300,
    is3D: true,
    fontName: "Fira Code"
  };
  new google.visualization.PieChart(document.getElementById("lang-pie")).draw(chartData, options);
}

function drawRatingChart() {
  const data = [["Rating", "Solved"]];
  for (let r in ratingStats) {
    data.push([r, ratingStats[r]]);
  }

  const chartData = google.visualization.arrayToDataTable(data);
  const options = {
    title: `Problem Ratings Solved by ${handle}`,
    height: 300,
    fontName: "Fira Code"
  };
  new google.visualization.ColumnChart(document.getElementById("rating-bar")).draw(chartData, options);
}

function drawHeatMap() {
  const data = [];
  for (let date in heatmapData) {
    data.push([new Date(parseInt(date)), heatmapData[date]]);
  }

  const chartData = new google.visualization.DataTable();
  chartData.addColumn({ type: "date", id: "Date" });
  chartData.addColumn({ type: "number", id: "Submissions" });
  chartData.addRows(data);

  const options = {
    height: activeYears * 140,
    colorAxis: {
      minValue: 0,
      colors: ["#9be9a8", "#30a14e", "#216e39"]
    },
    calendar: {
      cellSize: 14
    }
  };

  new google.visualization.Calendar(document.getElementById("submission-heatmap")).draw(chartData, options);
}
