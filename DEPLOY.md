# 배포 준비 가이드

대장님용으로 가장 쉬운 방향은 정적 사이트 배포입니다.
추천: GitHub Pages

## 이미 준비된 것
- 사이트 파일 구성 완료
- 브라우저에서 바로 열 수 있는 정적 구조
- 배포 전 파일 체크 스크립트 포함

## 집에 가서 맥미니에서 할 일

### 1) 폴더 위치로 이동
```bash
cd ~/.openclaw/workspace/health-dashboard
```

### 2) 파일 체크
```bash
python3 scripts/check_files.py
```
또는
```bash
npm run deploy:check
```

### 3) 로컬에서 미리 보기
```bash
python3 -m http.server 8000
```
브라우저에서:
```text
http://localhost:8000
```

### 4) GitHub 새 저장소 만들기
예시 이름:
- health-dashboard
- bugaan-health-dashboard

### 5) 이 폴더를 GitHub에 올리기
대장님이 집에서 하면 내가 그 다음 명령도 맞춰줄 수 있음.

기본 흐름 예시:
```bash
git init
git add .
git commit -m "Initial health dashboard"
git branch -M main
git remote add origin <GITHUB_REPO_URL>
git push -u origin main
```

### 6) GitHub Pages 켜기
GitHub 저장소에서:
- Settings
- Pages
- Branch: main
- Folder: /(root)
- Save

몇 분 뒤 주소가 생김.
예시:
```text
https://githubusername.github.io/health-dashboard/
```

## 중요한 점
- 지금 구조는 서버 없이 배포 가능한 정적 사이트
- 원문 기사 본문 복제 없이 요약+링크 중심
- 현재는 샘플 데이터 기반, 이후 자동 수집 붙일 예정

## 내가 다음에 해줄 일
- GitHub 올리는 명령 맞춤형으로 안내
- 실제 기사 데이터 구조 연결
- 자동 수집기 초안 추가
- 선별 규칙 자동화
