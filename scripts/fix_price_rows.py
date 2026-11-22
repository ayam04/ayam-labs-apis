import pathlib, re
c = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public\compare-pricing.html")
t = c.read_text(encoding="utf-8")

old_100 = re.search(r"<tr><td>DocParse, 100-page PDF</td>[\s\S]*?</tr>", t)
new_100 = ("<tr><td>DocParse, 100-page PDF</td><td class='mono'>$1.25 (25 calls of 4 pages)</td>"
           "<td class='mono'>$0.00075 per page (PennyOCR)</td><td>17x the market at $0.0125 per page</td></tr>")
if old_100:
    t = t.replace(old_100.group(0), new_100, 1)
    print("100-page row corrected")

old_one = re.search(r"<tr><td>DocParse, one-page file</td>[\s\S]*?</tr>", t)
new_one = ("<tr><td>DocParse, one call (up to 4 pages)</td><td class='mono'>$0.05 per call</td>"
           "<td class='mono'>$0.00075 per page</td><td>66x the market on a single page, 17x at four</td></tr>")
if old_one:
    t = t.replace(old_one.group(0), new_one, 1)
    print("one-page row corrected")

# the summary sentence above the table may still promise parity at scale
t = t.replace("parity at $0.0005 per page", "$0.0125 per page, 17x the market")
c.write_text(t, encoding="utf-8")

rows = re.findall(r"<tr><td>(DocParse[^<]*)</td>", t)
print("docparse rows now:", rows)
