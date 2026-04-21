from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
    root / "index.html",
    root / "styles.css",
    root / "app.js",
    root / "data.js",
    root / "README.md",
]
missing = [str(path.relative_to(root)) for path in required if not path.exists()]
if missing:
    print("Missing files:")
    for item in missing:
        print(f"- {item}")
    raise SystemExit(1)
print("All required dashboard files are present.")
