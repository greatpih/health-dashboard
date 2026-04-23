import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ITEMS_PATH = DATA_DIR / "items.json"
SOURCES_PATH = DATA_DIR / "sources.json"
USER_AGENT = "Mozilla/5.0 (compatible; BugaanDashboard/1.0)"

KORMEDI_FEED = "https://kormedi.com/feed/"
DAILYPHARM_LIST_URL = "https://www.dailypharm.com/user/news?group=%EC%A2%85%ED%95%A9"
HIDOC_LIST_URL = "https://news.hidoc.co.kr/news/articleList.html"
KPANEWS_LIST_URL = "https://www.kpanews.co.kr/"
MAX_ITEMS_PER_SOURCE = 8

KEYWORD_RULES = {
    "운전주의": ["운전", "졸음", "항히스타민", "수면", "집중력"],
    "고혈압": ["고혈압", "혈압"],
    "당뇨": ["당뇨", "혈당"],
    "감기약": ["감기약", "감기"],
    "진통제": ["진통제", "소염진통제"],
    "병용금기": ["같이 먹", "병용", "함께 복용", "상호작용"],
    "부작용": ["부작용", "이상반응", "주의"],
}

EXCLUDE_KEYWORDS = [
    "제약사", "제약·바이오", "공동개발", "투자", "매출", "실적", "임상", "신약 개발", "MOU",
    "병원장", "의료원", "학술대회", "박람회", "부스", "협약", "대통령 표창", "기업", "상장",
    "전시", "오픈이노베이션", "주총", "인사발령", "IR", "증권", "수상", "기념식",
    "대한약사회", "약사회", "약국가", "약국 경영", "반품", "품절", "수가", "급여", "약가",
    "정책", "정책·법률", "법률", "행정처분", "처방목록", "대체조제", "약사법", "심평원",
    "건보", "복지부", "식약처", "제도", "인하", "등재", "바이오", "주사제 시장",
    "GMP", "수출 확대", "진출 본격화", "파트너십", "선정", "사업", "의료시스템", "헬스케어 진출",
    "그룹", "재단", "지원사업", "시장", "약국 현장", "약국계", "유통"
]


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read().decode("utf-8", errors="ignore")


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def to_kst(pub_date: str) -> str:
    dt = parsedate_to_datetime(pub_date)
    return dt.astimezone().strftime("%Y-%m-%d %H:%M")


def infer_tags(title: str, summary: str):
    haystack = f"{title} {summary}"
    tags = []
    for tag, keywords in KEYWORD_RULES.items():
        if any(keyword in haystack for keyword in keywords):
            tags.append(tag)
    if not tags:
        tags.append("건강상식")
    if any(word in haystack for word in ["주의", "경고", "위험"]):
        tags.append("쇼츠유망")
    return list(dict.fromkeys(tags))


def score_item(title: str, summary: str, tags):
    score = 5
    for strong_tag in ["운전주의", "병용금기", "부작용", "고혈압", "당뇨", "감기약"]:
        if strong_tag in tags:
            score += 1
    if "쇼츠유망" in tags:
        score += 1
    return min(score, 10)


def simple_summary(title: str, summary: str, tags):
    cleaned = summary.replace("The post", "").replace("appeared first on", "")
    cleaned = re.sub(r'코메디닷컴.*$', '', cleaned).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    first_sentence = re.split(r'(?<=[.!?])\s+|(?<=다)\s+', cleaned)[0].strip() if cleaned else ""

    if first_sentence and len(first_sentence) >= 25:
        return first_sentence[:90] + ("..." if len(first_sentence) > 90 else "")
    if "병용금기" in tags:
        return "같이 먹는 약 조합에 따라 문제가 생길 수 있어 확인이 필요한 기사예요."
    if "운전주의" in tags:
        return "복용 후 졸림이나 집중력 저하가 생길 수 있는지 살펴볼 만한 기사예요."
    if "고혈압" in tags:
        return "혈압 관리나 혈압약 복용 중인 사람이 체크해볼 만한 내용이에요."
    if "당뇨" in tags:
        return "혈당 조절이나 당뇨 관리에 참고할 만한 포인트가 담긴 기사예요."
    if "감기약" in tags:
        return "감기약을 먹을 때 주의할 점을 확인해볼 만한 기사예요."
    if "진통제" in tags:
        return "진통제를 자주 먹는 사람이라면 확인해둘 만한 기사예요."
    if "부작용" in tags:
        return "부작용이나 주의사항을 가볍게 넘기지 말아야 한다는 점을 짚는 기사예요."
    return title[:80] + ("..." if len(title) > 80 else "")


def should_exclude(title: str, summary: str):
    haystack = f"{title} {summary}"
    return any(keyword in haystack for keyword in EXCLUDE_KEYWORDS)


def pick_category(tags):
    if "식약처" in tags:
        return "official"
    if any(tag in tags for tag in ["운전주의", "병용금기", "고혈압", "당뇨", "감기약", "진통제"]):
        return "public"
    return "public"


def shorts_title(title: str, tags):
    if "운전주의" in tags:
        return f"{title} 꼭 조심해야 하는 이유"
    if "병용금기" in tags:
        return f"{title} 같이 먹으면 안 될 수 있습니다"
    return title


def normalize_kormedi_item(item):
    title = (item.findtext("title") or "").strip()
    link = (item.findtext("link") or "").strip()
    pub_date = (item.findtext("pubDate") or "").strip()
    description = strip_html(item.findtext("description") or "")
    if should_exclude(title, description):
        return None
    tags = infer_tags(title, description)
    shorts_score = score_item(title, description, tags)
    return {
        "id": f"kormedi-{link.rstrip('/').split('/')[-1]}",
        "title": title,
        "source": "코메디닷컴",
        "publishedAt": to_kst(pub_date),
        "category": pick_category(tags),
        "tags": tags,
        "summary": description[:140] + ("..." if len(description) > 140 else ""),
        "whyItMatters": "대중 관심이 높은 건강 이슈인지, 복약 주의 포인트가 있는지 빠르게 확인할 가치가 있다.",
        "simpleSummary": simple_summary(title, description, tags),
        "shortsScore": shorts_score,
        "shortsTitle": shorts_title(title, tags),
        "cautionNote": "제목만 보지 말고 원문 맥락까지 확인 필요",
        "originalUrl": link,
        "picked": shorts_score >= 8,
        "priority": 70 + shorts_score,
    }


def normalize_dailypharm_item(url: str, html: str):
    title_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
    desc_match = re.search(r'<meta property="og:description" content="([^"]*)"', html)
    published_match = re.search(r'<meta property="article:published_time"\s+content="([^"]+)"', html)

    title = strip_html(title_match.group(1)) if title_match else url.rsplit('/', 1)[-1]
    title = re.sub(r'^\[데일리팜\]', '', title).strip()
    summary = strip_html(desc_match.group(1)) if desc_match else ""
    published = published_match.group(1).replace('T', ' ')[:16] if published_match else ""
    if should_exclude(title, summary):
        return None
    tags = infer_tags(title, summary)
    if any(word in f"{title} {summary}" for word in ["약", "처방", "조제", "급여", "복약"]):
        tags.append("대중관심")
    tags = list(dict.fromkeys(tags))
    shorts_score = score_item(title, summary, tags)
    return {
        "id": f"dailypharm-{url.rstrip('/').split('/')[-1]}",
        "title": title,
        "source": "데일리팜",
        "publishedAt": published,
        "category": "industry" if not any(tag in tags for tag in ["고혈압", "당뇨", "감기약", "진통제", "병용금기", "운전주의"]) else "public",
        "tags": tags,
        "summary": summary[:140] + ("..." if len(summary) > 140 else ""),
        "whyItMatters": "약 제도, 처방, 복약 흐름 중 대중화 가능한 이슈인지 빠르게 확인할 수 있다.",
        "simpleSummary": simple_summary(title, summary, tags),
        "shortsScore": shorts_score,
        "shortsTitle": shorts_title(title, tags),
        "cautionNote": "업계 기사라도 실제 복약 의미가 있는지 추가 선별 필요",
        "originalUrl": url,
        "picked": shorts_score >= 8,
        "priority": 68 + shorts_score,
    }


def collect_kormedi():
    xml_text = fetch_text(KORMEDI_FEED)
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []
    items = channel.findall("item")[:MAX_ITEMS_PER_SOURCE]
    return [normalized for item in items if (normalized := normalize_kormedi_item(item))]


def collect_dailypharm():
    html = fetch_text(DAILYPHARM_LIST_URL)
    urls = re.findall(r'href="(https://www\.dailypharm\.com/user/news/\d+)"', html)
    seen = []
    for url in urls:
        if url not in seen:
            seen.append(url)
    articles = []
    for url in seen[:MAX_ITEMS_PER_SOURCE]:
        try:
            article_html = fetch_text(url)
            normalized = normalize_dailypharm_item(url, article_html)
            if normalized:
                articles.append(normalized)
        except Exception:
            continue
    return articles


def normalize_hidoc_item(url: str, html: str):
    title_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
    desc_match = re.search(r'<meta name="description" content="([^"]+)"', html)
    published_match = re.search(r'<meta property="article:published_time" content="([^"]+)"', html)

    title = strip_html(title_match.group(1)) if title_match else url
    title = re.sub(r'\s*-\s*하이닥$', '', title).strip()
    summary = strip_html(desc_match.group(1)) if desc_match else ""
    published = published_match.group(1).replace('T', ' ')[:16] if published_match else ""
    if should_exclude(title, summary):
        return None
    tags = infer_tags(title, summary)
    if any(word in f"{title} {summary}" for word in ["당뇨", "혈압", "진통제", "복용", "약", "연구"]):
        tags.append("대중관심")
    tags = list(dict.fromkeys(tags))
    shorts_score = score_item(title, summary, tags)
    return {
        "id": f"hidoc-{urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('idxno', ['0'])[0]}",
        "title": title,
        "source": "하이닥",
        "publishedAt": published,
        "category": "public",
        "tags": tags,
        "summary": summary[:140] + ("..." if len(summary) > 140 else ""),
        "whyItMatters": "질환, 복약, 최신연구 중 대중이 실제로 궁금해할 포인트를 빠르게 추릴 수 있다.",
        "simpleSummary": simple_summary(title, summary, tags),
        "shortsScore": shorts_score,
        "shortsTitle": shorts_title(title, tags),
        "cautionNote": "기사형 정보이므로 실제 복용 판단은 별도 확인 필요",
        "originalUrl": url,
        "picked": shorts_score >= 8,
        "priority": 66 + shorts_score,
    }


def collect_hidoc():
    html = fetch_text(HIDOC_LIST_URL)
    urls = re.findall(r'href="(https://news\.hidoc\.co\.kr/news/articleView\.html\?idxno=\d+)"', html)
    seen = []
    for url in urls:
        if url not in seen:
            seen.append(url)
    articles = []
    for url in seen[:MAX_ITEMS_PER_SOURCE]:
        try:
            article_html = fetch_text(url)
            normalized = normalize_hidoc_item(url, article_html)
            if normalized:
                articles.append(normalized)
        except Exception:
            continue
    return articles


def normalize_kpanews_item(url: str, html: str):
    title_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
    desc_match = re.search(r'<meta name="description" content="([^"]+)"', html)
    published_match = re.search(r'<meta property="article:published_time" content="([^"]+)"', html)

    title = strip_html(title_match.group(1)) if title_match else url
    title = re.sub(r'\s*-\s*약사공론$', '', title).strip()
    summary = strip_html(desc_match.group(1)) if desc_match else ""
    published = published_match.group(1).replace('T', ' ')[:16] if published_match else ""
    if should_exclude(title, summary):
        return None
    tags = infer_tags(title, summary)
    if any(word in f"{title} {summary}" for word in ["약국", "품절", "감기", "코로나", "복약", "의약품"]):
        tags.append("대중관심")
    tags = list(dict.fromkeys(tags))
    shorts_score = score_item(title, summary, tags)
    category = "public"
    return {
        "id": f"kpanews-{urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('idxno', ['0'])[0]}",
        "title": title,
        "source": "약사공론",
        "publishedAt": published,
        "category": category,
        "tags": tags,
        "summary": summary[:140] + ("..." if len(summary) > 140 else ""),
        "whyItMatters": "약국 현장과 의약품 수급, 복약 이슈 중 대중화 가능한 주제를 빠르게 추릴 수 있다.",
        "simpleSummary": simple_summary(title, summary, tags),
        "shortsScore": shorts_score,
        "shortsTitle": shorts_title(title, tags),
        "cautionNote": "업계 현장 기사이므로 대중용 설명으로 재가공 필요할 수 있음",
        "originalUrl": url,
        "picked": shorts_score >= 8,
        "priority": 65 + shorts_score,
    }


def collect_kpanews():
    html = fetch_text(KPANEWS_LIST_URL)
    urls = re.findall(r'href="(https://www\.kpanews\.co\.kr/news/articleView\.html\?idxno=\d+)"', html)
    seen = []
    for url in urls:
        if url not in seen:
            seen.append(url)
    articles = []
    for url in seen[:MAX_ITEMS_PER_SOURCE]:
        try:
            article_html = fetch_text(url)
            normalized = normalize_kpanews_item(url, article_html)
            if normalized:
                articles.append(normalized)
        except Exception:
            continue
    return articles


def build_dashboard_items():
    items = []
    items.extend(collect_kormedi())
    items.extend(collect_dailypharm())
    items.extend(collect_hidoc())
    items.extend(collect_kpanews())
    items.sort(key=lambda item: (item.get('publishedAt', ''), item.get('priority', 0)), reverse=True)
    return items


def main():
    sources = load_json(SOURCES_PATH)
    print(f"Loaded {len(sources)} sources")

    items = build_dashboard_items()
    save_json(ITEMS_PATH, items)

    print(f"Saved {len(items)} dashboard items")
    print("Currently live: Kormedi RSS collector, DailyPharm collector, HiDoc collector, Kpanews collector")
    print("No remaining active source scaffolds in the current 4-source setup")


if __name__ == "__main__":
    main()
