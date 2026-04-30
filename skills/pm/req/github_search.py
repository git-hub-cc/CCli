import sys
import json
import urllib.request
import urllib.parse
import os

def search_github(query):
    # 构建 GitHub Search API URL
    url = f"https://api.github.com/search/repositories?q={urllib.parse.quote(query)}&sort=stars&order=desc&per_page=5"

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CCLI-Skill-PM-Req-Agent"
    }

    # 尝试从环境变量获取 TOKEN 以提升 API 速率限制
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                items = data.get("items", [])

                if not items:
                    print(json.dumps({"status": "success", "data": "未找到相关的开源仓库"}, ensure_ascii=False))
                    return

                results = []
                for item in items:
                    results.append({
                        "name": item["full_name"],
                        "description": item["description"],
                        "url": item["html_url"],
                        "stars": item["stargazers_count"],
                        "language": item["language"]
                    })

                print(json.dumps({"status": "success", "data": results}, ensure_ascii=False, indent=2))
            else:
                print(json.dumps({"status": "error", "message": f"HTTP {response.status}"}, ensure_ascii=False))
    except urllib.error.URLError as e:
        print(json.dumps({"status": "error", "message": f"网络请求失败: {str(e)}"}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "缺失查询关键字参数"}, ensure_ascii=False))
        sys.exit(1)

    search_query = sys.argv[1]
    search_github(search_query)