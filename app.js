const state = {
  items: [],
  source: "all",
  tag: "all",
  shortsOnly: false,
  sort: "latest",
  activeCategory: "latest",
};

const sourceFilters = document.getElementById("sourceFilters");
const tagFilters = document.getElementById("tagFilters");
const shortsOnly = document.getElementById("shortsOnly");
const sortSelect = document.getElementById("sortSelect");
const categoryTabs = document.getElementById("categoryTabs");
const activeCategoryTitle = document.getElementById("activeCategoryTitle");
const activeCategoryList = document.getElementById("activeCategoryList");

const CATEGORIES = [
  { key: "latest", label: "최신기사" },
  { key: "shorts", label: "쇼츠감" },
  { key: "medication", label: "약 관련 기사" },
  { key: "health", label: "건강 관련 기사" },
  { key: "featured", label: "추천 기사" },
  { key: "all", label: "전체 기사" },
];

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

function renderCategoryTabs() {
  categoryTabs.innerHTML = CATEGORIES.map((category) => {
    const active = state.activeCategory === category.key;
    return `<button class="chip ${active ? "active" : ""}" data-key="activeCategory" data-value="${category.key}">${category.label}</button>`;
  }).join("");
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

function getCategoryItems(list) {
  switch (state.activeCategory) {
    case "shorts":
      return list.filter((item) => item.shortsScore >= 8);
    case "medication":
      return list.filter(isMedication);
    case "health":
      return list.filter(isHealth);
    case "featured":
      return list.filter((item) => item.picked);
    case "all":
      return list;
    case "latest":
    default:
      return list;
  }
}

function getCategoryTitle() {
  return CATEGORIES.find((category) => category.key === state.activeCategory)?.label || "기사 목록";
}

function render() {
  const list = filteredItems();
  const categoryItems = getCategoryItems(list);
  activeCategoryTitle.textContent = getCategoryTitle();
  activeCategoryList.innerHTML = categoryItems.map((item) => renderListCard(item, state.activeCategory === "shorts" ? item.shortsTitle : undefined)).join("") || emptyText("해당 카테고리에 기사가 없습니다.");
  renderCategoryTabs();
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
    activeCategoryList.innerHTML = `<p class="meta">데이터 로딩 실패: ${error.message}</p>`;
  }
}

init();
