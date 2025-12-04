import json
import glob
from collections import Counter, defaultdict
from statistics import mean, median
import random

NODE_KEEP_PERCENT = 0.2
LINK_KEEP_PERCENT = 0.02
MIN_KEYWORD_COUNT = 5


def load_articles(pattern="rsp_*.json"):
    articles = []
    for file in glob.glob(pattern):
        with open(file, "r") as f:
            data = json.load(f)
            if "response" in data and "docs" in data["response"]:
                articles.extend(data["response"]["docs"])
    return articles


def build_keyword_graph(articles):
    keyword_data = defaultdict(
        lambda: {"count": 0, "word_counts": [], "sections": Counter()}
    )
    article_keywords = []

    for article in articles:
        kws = {
            (kw.get("value") or "").strip()
            for kw in article.get("keywords", [])
            if kw.get("value")
        }
        if not kws:
            continue

        wc = article.get("word_count")
        sec = article.get("section_name")

        for kw in kws:
            keyword_data[kw]["count"] += 1
            if wc:
                keyword_data[kw]["word_counts"].append(wc)
            if sec:
                keyword_data[kw]["sections"][sec] += 1

        article_keywords.append(list(kws))

    keyword_data = {
        kw: d for kw, d in keyword_data.items() if d["count"] >= MIN_KEYWORD_COUNT
    }
    print(f"Keywords >= {MIN_KEYWORD_COUNT}: {len(keyword_data)}")

    sorted_keywords = sorted(
        keyword_data.items(), key=lambda x: x[1]["count"], reverse=True
    )
    keep_n = max(1, int(len(sorted_keywords) * NODE_KEEP_PERCENT))
    selected_keywords = {kw for kw, _ in sorted_keywords[:keep_n]}
    print(
        f"Kept {len(selected_keywords)} keywords (top {NODE_KEEP_PERCENT * 100:.0f}%)"
    )

    link_counter = Counter()

    for kws in article_keywords:
        kws = [k for k in kws if k in selected_keywords]
        kws.sort()
        for i in range(len(kws)):
            for j in range(i + 1, len(kws)):
                link_counter[(kws[i], kws[j])] += 1

    adjacency = defaultdict(list)
    for (a, b), c in link_counter.items():
        adjacency[a].append((b, c))
        adjacency[b].append((a, c))

    filtered_links = set()
    for node, neighbors in adjacency.items():
        neighbors.sort(key=lambda x: x[1], reverse=True)
        keep = max(1, int(len(neighbors) * LINK_KEEP_PERCENT))
        for target, count in neighbors[:keep]:
            filtered_links.add(
                tuple(sorted((node, target)))
                + (
                    count
                    / min(keyword_data[node]["count"], keyword_data[target]["count"]),
                )
            )

    print(f"Links after per-node filtering: {len(filtered_links)}")

    nodes = []
    for kw in selected_keywords:
        d = keyword_data[kw]
        nodes.append(
            {
                "keyword": kw,
                "count": d["count"],
                "mean_word_count": mean(d["word_counts"]) if d["word_counts"] else None,
                "median_word_count": median(d["word_counts"])
                if d["word_counts"]
                else None,
                "top_section": d["sections"].most_common(1)[0][0]
                if d["sections"]
                else None,
                "x": random.randrange(1000),
                "y": random.randrange(1000),
            }
        )

    links = [{"source": a, "target": b, "strength": c} for (a, b, c) in filtered_links]

    return {"nodes": nodes, "links": links}


if __name__ == "__main__":
    articles = load_articles("data/subset/rsp_*.json")
    graph = build_keyword_graph(articles)

    with open("project/nyt_keyword_graph.json", "w") as f:
        json.dump(graph, f, indent=2)

    print("\nSaved\n")
