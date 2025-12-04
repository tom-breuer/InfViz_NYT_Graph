import json
import os
from statistics import median
from collections import defaultdict, Counter

DATA_DIR = "./data/subset"
GRAPH_FILE = "./project/nyt_keyword_graph.json"
OUTPUT_FILE = "./project/nyt_keyword_timeseries.json"


def load_graph_keywords(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    keywords = {node["keyword"] for node in data.get("nodes", [])}
    print(f"Loaded {len(keywords)} keywords from graph.")
    return keywords


def load_monthly_articles(path):
    monthly_articles = {}

    for file in os.listdir(path):
        if file.startswith("rsp_") and file.endswith(".json"):
            parts = file[:-5].split("_")
            if len(parts) < 3:
                continue

            year, month = parts[1], parts[2]
            time_key = f"{year}-{month.zfill(2)}"

            try:
                with open(os.path.join(path, file), encoding="utf-8") as f:
                    data = json.load(f)
                monthly_articles[time_key] = data.get("response", {}).get("docs", [])
            except:
                print(f"Could not load {file}")

    return dict(sorted(monthly_articles.items()))


def compute_timeseries(monthly_articles, allowed_keywords):
    total_counts = Counter()

    for articles in monthly_articles.values():
        for article in articles:
            kws = {
                k.get("value") for k in article.get("keywords", []) if k.get("value")
            }
            kws = kws & allowed_keywords
            for kw in kws:
                total_counts[kw] += 1

    print(f"Total tracked keywords: {len(total_counts)}")

    result = defaultdict(list)

    for month, articles in monthly_articles.items():
        temp = defaultdict(lambda: {"wc": [], "sections": Counter(), "count": 0})

        for article in articles:
            wc = article.get("word_count")
            section = article.get("section_name")
            kws = {
                k.get("value") for k in article.get("keywords", []) if k.get("value")
            }
            kws = kws & allowed_keywords

            for kw in kws:
                temp[kw]["count"] += 1
                if isinstance(wc, int):
                    temp[kw]["wc"].append(wc)
                if section:
                    temp[kw]["sections"][section] += 1

        for kw, d in temp.items():
            if d["count"] == 0:
                continue

            month_count = d["count"]
            total = total_counts[kw]

            result[kw].append(
                {
                    "time": month,
                    "count": month_count,
                    "median_word_count": median(d["wc"]) if d["wc"] else None,
                    "top_section": d["sections"].most_common(1)[0][0]
                    if d["sections"]
                    else None,
                    "proportion": month_count / total if total > 0 else None,
                }
            )

    return result


def main():
    allowed_keywords = load_graph_keywords(GRAPH_FILE)
    monthly_articles = load_monthly_articles(DATA_DIR)
    result = compute_timeseries(monthly_articles, allowed_keywords)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print("Timeseries JSON created")


if __name__ == "__main__":
    main()
