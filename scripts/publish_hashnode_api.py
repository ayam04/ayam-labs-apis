"""Publish the prepared article to Hashnode through the GraphQL API.

Needs HASHNODE_TOKEN and HASHNODE_PUBLICATION_ID in the environment.
Creates a draft by default; pass --publish to make it public.
"""
import json, os, pathlib, sys, urllib.request

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")
TOKEN = os.environ.get("HASHNODE_TOKEN", "").strip()
PUB = os.environ.get("HASHNODE_PUBLICATION_ID", "").strip()
TITLE = (ROOT / ".tmp" / "article-title.txt").read_text(encoding="utf-8").strip()
BODY = (ROOT / ".tmp" / "article-body.txt").read_text(encoding="utf-8")

QUERY = """
mutation PublishPost($input: PublishPostInput!) {
  publishPost(input: $input) { post { id url } }
}
"""

def main() -> int:
    if not TOKEN or not PUB:
        print("HASHNODE_TOKEN and HASHNODE_PUBLICATION_ID must be set.")
        return 2
    publish = "--publish" in sys.argv
    variables = {
        "input": {
            "title": TITLE,
            "publicationId": PUB,
            "contentMarkdown": BODY,
            "tags": [{"name": "Cloudflare Workers", "slug": "cloudflare-workers"},
                     {"name": "API", "slug": "api"},
                     {"name": "TypeScript", "slug": "typescript"}],
            "disableComments": False,
            "publishedAt": None,
        }
    }
    if not publish:
        print("dry run: pass --publish to create the post publicly")
        return 0
    req = urllib.request.Request(
        "https://gql.hashnode.com/",
        data=json.dumps({"query": QUERY, "variables": variables}).encode("utf-8"),
        headers={"Authorization": TOKEN, "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            post = (data.get("data") or {}).get("publishPost", {}).get("post")
            if post:
                print("published:", post.get("url"))
                return 0
            print("response:", json.dumps(data)[:400])
            return 1
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode("utf-8", "replace")[:300])
        return 1
    except Exception as e:
        print("failed:", e)
        return 1

if __name__ == "__main__":
    sys.exit(main())
