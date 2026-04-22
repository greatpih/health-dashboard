const state = {
  items: [],
  source: "all",
  tag: "all",
  shortsOnly: false,
  sort: "priority",
};

const sourceFilters = document.getElementById("sourceFilters");
const tagFilters = document.getElementById("tagFilters");
const shortsOnly = document.getElementById("shortsOnly");
const sortSelect = document.getElementById("sortSelect");

const featuredList = document.getElementById("featuredList");
const officialList = document.getElementById("officialList");
const shortsList = document.getElementById("shortsList");
const industryList = document.getElementById("industryList");
const publicList = document.getElementById("publicList");
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
  if (state.sort === "latest") return sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (state.sort === "shorts") return sorted.sort((a, b) => b.shortsScore - a.shortsScore);
  return sorted.sort((a, b) => (b.priority || 0) - (a.priority || 0));
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

function renderStoryCard(item) {
  return `
    <article class="story-card">
      <p class="small-meta">${item.source} · ${item.publishedAt}</p>
      <h3>${item.title}</h3>
      <p>${item.summary}</p>
      <div class="tags">${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
      <p><strong>왜 중요한지:</strong> ${item.whyItMatters}</p>
      <div class="cta-row">
        <span class="score">쇼츠감 ${item.shortsScore}/10</span>
        <a class="button-link" href="${articleHref(item)}" target="_blank" rel="noopener noreferrer">원문 보기</a>
      </div>
    </article>
  `;
}

function renderListCard(item, extraTitle, extraBody) {
  return `
    <article class="list-card">
      <p class="small-meta">${item.source} · ${item.publishedAt}</p>
      <h3>${extraTitle || item.title}</h3>
      <p>${extraBody || item.summary}</p>
      <div class="tags">${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
      <div class="cta-row">
        <span class="small-meta">${item.cautionNote}</span>
        <a class="button-link" href="${articleHref(item)}" target="_blank" rel="noopener noreferrer">원문</a>
      </div>
    </article>
  `;
}

function render() {
  const list = filteredItems();
  const featured = list.filter((item) => item.picked).slice(0, 5);
  const official = list.filter((item) => item.category === "official");
  const shorts = list.filter((item) => item.shortsScore >= 8);
  const industry = list.filter((item) => item.category === "industry");
  const publicItems = list.filter((item) => item.category === "public");

  featuredList.innerHTML = featured.map(renderStoryCard).join("") || '<p class="meta">조건에 맞는 항목이 아직 없습니다.</p>';
  officialList.innerHTML = official.map((item) => renderListCard(item)).join("") || '<p class="meta">공식 항목 없음</p>';
  shortsList.innerHTML = shorts.map((item) => renderListCard(item, item.shortsTitle, item.summary)).join("") || '<p class="meta">쇼츠감 높은 항목 없음</p>';
  industryList.innerHTML = industry.map((item) => renderListCard(item)).join("") || '<p class="meta">업계 이슈 없음</p>';
  publicList.innerHTML = publicItems.map((item) => renderListCard(item)).join("") || '<p class="meta">대중 기사 없음</p>';
  allList.innerHTML = list.map((item) => renderListCard(item)).join("") || '<p class="meta">전체 목록이 비어 있습니다.</p>';
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
    featuredList.innerHTML = `<p class="meta">데이터 로딩 실패: ${error.message}</p>`;
    officialList.innerHTML = "";
    shortsList.innerHTML = "";
    industryList.innerHTML = "";
    publicList.innerHTML = "";
    allList.innerHTML = "";
  }
}

init();
