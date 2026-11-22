import os, shutil, sqlite3, tempfile, glob

base = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
found = {}
for profile in glob.glob(os.path.join(base, "*", "Network", "Cookies")) + glob.glob(os.path.join(base, "Default", "Cookies")):
    tmp = os.path.join(tempfile.gettempdir(), "cookies_probe.db")
    try:
        shutil.copy2(profile, tmp)
    except Exception as exc:
        print("copy failed", profile, exc)
        continue
    try:
        conn = sqlite3.connect(tmp)
        rows = conn.execute(
            "select host_key, count(*), max(expires_utc) from cookies "
            "where host_key like '%rapidapi%' or host_key like '%reddit%' or host_key like '%devto%' "
            "or host_key like '%hashnode%' or host_key like '%github%' or host_key like '%cloudflare%' "
            "or host_key like '%news.ycombinator%' or host_key like '%producthunt%' "
            "group by host_key order by host_key"
        ).fetchall()
        conn.close()
        if rows:
            label = profile.replace(base, "")
            print("==", label)
            for host, count, expires in rows:
                print("   ", host, count)
        found[profile] = len(rows)
    except Exception as exc:
        print("query failed", profile, exc)
print("total profiles scanned:", len(found))
