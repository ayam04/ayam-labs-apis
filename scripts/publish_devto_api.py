"""Publish the prepared article to dev.to through the Forem API.

Needs DEVTO_API_KEY in the environment (dev.to > Settings > Extensions > DEV Community API Keys).
Creates a draft by default; pass --publish to make it public.
"""
import json, os, pathlib, sys, urllib.request

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")
KEY = os.environ.get("DEVTO_API_KEY", "").strip()
TITLE = (ROOT / ".tmp" / "article-title.txt").read_text(encoding="utf-8").strip()
BODY = (ROOT / ".tmp" / "article-body.txt").read_text(encoding="utf-8")
TAGS = ["cloudflare", "api", "typescript", "webdev"]

def main() -> int:
    if not KEY:
        print("DEVTO_API_KEY is not set. Create one at dev.to/settings/extensions and export it.")
        return 2
    publish = "--publish" in sys.argv
    payload = {
        "article": {
            "title": TITLE,
            "published": publish,
            "body_markdown": BODY,
            "tags": TAGS,
            "canonical_url": "https://labs.ayamk.in/blog-five-apis.html",
        }
    }
    req = urllib.request.Request(
        "https://dev.to/api/articles",
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": KEY, "content-type": "application/json", "accept": "application/vnd.forem.api-v1+json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print("status:", resp.status)
            print("id:", data.get("id"))
            print("url:", data.get("url"))
            print("published:", data.get("published"))
            return 0
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode("utf-8", "replace")[:400])
        return 1
    except Exception as e:
        print("failed:", e)
        return 1

if __name__ == "__main__":
    sys.exit(main())
