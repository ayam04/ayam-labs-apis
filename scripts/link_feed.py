import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
r = PUB / "robots.txt"
t = r.read_text(encoding="utf-8")
if "feed.xml" not in t:
    t = t.rstrip() + "\n\n# feed: https://labs.ayamk.in/feed.xml\n"
    r.write_text(t, encoding="utf-8")
    print("robots updated")
l = PUB / "llms.txt"
t = l.read_text(encoding="utf-8")
if "feed.xml" not in t:
    t = t.replace("## Listings", "## Feed\n\nhttps://labs.ayamk.in/feed.xml - build notes and guides.\n\n## Listings")
    l.write_text(t, encoding="utf-8")
    print("llms updated")
