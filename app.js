const state = {
  items: [],
  source: "all",
  tag: "all",
  shortsOnly: false,
  sort: "latest",
};

const sourceFilters = document.getElementById("sourceFilters");
const tagFilters = document.getElementById("tagFilters");
const shortsOnly = document.getElementById("shortsOnly");
const sortSelect = document.getElementById("sortSelect");

const latestList = document.getElementById("latestList");
const shortsList = document.getElementById("shortsList");
const medicationList = document.getElementById("medicationList");
const healthList = document.getElementById("healthList");
const featuredList = document.getElementById("featuredList");
const sourceSummary = document.getElementById("sourceSummary");
const allList = document.getElementById("allList");

function unique(list) {
  return [...new Set(list)];
}

function renderChips(container, values, key, labelAll) {
  const current = state[key];
  const buttons = [labelAll, ...values].map((value) => {
    const active = current === value;
    return `<button class="chip ${active ? "active" : ""}" data-key="${key}" data-value="${value}">${value}</button>`;
  });
  container.innerHTML = buttons.join("");
}

function sortItems(list) {
  const sorted = [...list];
  if (state.sort === "priority") return sorted.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  if (state.sort === "shorts") return sorted.sort((a, b) => b.shortsScore - a.shortsScore);
  return sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function filteredItems() {
  return sortItems(
    state.items.filter((item) => {
      const sourceMatch = state.source === "all" || item.source === state.source;
      const tagMatch = state.tag === "all" || item.tags.includes(state.tag);
      const shortsMatch = !state.shortsOnly || item.shortsScore >= 8;
      return sourceMatch && tagMatch && shortsMatch;
    })
  );
}

function articleHref(item) {
  return item.originalUrl;
}

function renderListCard(item, titleOverride, bodyOverride) {
  return `
    <article class="list-card">
      <p class="small-meta">${item.source} · ${item.publishedAt}</p>
      <h3>${titleOverride || item.title}</h3>
      <p>${bodyOverride || item.summary}</p>
      <div class="tags">${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
      <div class="cta-row">
        <span class="small-meta">쇼츠감 ${item.shortsScore}/10</span>
        <a class="button-link" href="${articleHref(item)}" target="_blank" rel="noopener noreferrer">원문</a>
      </div>
    </article>
  `;
}

function emptyText(message) {
  return `<p class="meta">${message}</p>`;
}

function isMedication(item) {
  const haystack = `${item.title} ${item.summary} ${item.tags.join(" ")}`;
  return ["약", "복용", "처방", "조제", "급여", "의약품", "진통제", "감기약", "고혈압", "당뇨", "병용금기"].some((word) => haystack.includes(word));
}

function isHealth(item) {
  return !isMedication(item) || item.category === "public";
}

function renderSourceSummary(items) {
  const counts = {};
  for (const item of items) counts[item.source] = (counts[item.source] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0], "ko"))
    .map(([source, count]) => `<article class="list-card"><h3>${source}</h3><p>${count}개 기사</p></article>`)
    .join("");
}

function render() {
  const list = filteredItems();
  const latest = list.slice(0, 12);
  const shorts = list.filter((item) => item.shortsScore >= 8).slice(0, 12);
  const medication = list.filter(isMedication).slice(0, 12);
  const health = list.filter(isHealth).slice(0, 12);
  const featured = list.filter((item) => item.picked).slice(0, 12);

  latestList.innerHTML = latest.map((item) => renderListCard(item)).join("") || emptyText("최신 기사가 없습니다.");
  shortsList.innerHTML = shorts.map((item) => renderListCard(item, item.shortsTitle, item.summary)).join("") || emptyText("쇼츠감 높은 기사가 없습니다.");
  medicationList.innerHTML = medication.map((item) => renderListCard(item)).join("") || emptyText("약 관련 기사가 없습니다.");
  healthList.innerHTML = health.map((item) => renderListCard(item)).join("") || emptyText("건강 관련 기사가 없습니다.");
  featuredList.innerHTML = featured.map((item) => renderListCard(item)).join("") || emptyText("추천 기사가 없습니다.");
  sourceSummary.innerHTML = renderSourceSummary(list) || emptyText("소스 정보가 없습니다.");
  allList.innerHTML = list.map((item) => renderListCard(item)).join("") || emptyText("전체 목록이 비어 있습니다.");
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (!button) return;
    state[button.dataset.key] = button.dataset.value;
    refreshFilters();
    render();
  });

  shortsOnly.addEventListener("change", (event) => {
    state.shortsOnly = event.target.checked;
    render();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
}

function refreshFilters() {
  renderChips(sourceFilters, unique(state.items.map((item) => item.source)), "source", "all");
  renderChips(tagFilters, unique(state.items.flatMap((item) => item.tags)), "tag", "all");
}

async function loadItems() {
  const response = await fetch("./data/items.json");
  if (!response.ok) throw new Error("items.json을 불러오지 못했습니다.");
  state.items = await response.json();
}

async function init() {
  bindEvents();
  try {
    await loadItems();
    refreshFilters();
    render();
  } catch (error) {
    latestList.innerHTML = `<p class="meta">데이터 로딩 실패: ${error.message}</p>`;
  }
}

init();
