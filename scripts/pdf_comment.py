import pathlib
p = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\apps\docparse\src\lib\pdf.ts")
t = p.read_text(encoding="utf-8")
old_doc = t[t.index("/**\n * CPU safety valve."):t.index("export const AUTO_PDF_MAX_BYTES")]
new_doc = ('/**\n'
 ' * Size guard for the full-document extraction path.\n'
 ' *\n'
 ' * Measured behaviour: a 775 KB, 16-page PDF kills the worker before it can answer, and the\n'
 ' * same file extracts fine one page at a time. The failure arrives after roughly 10 ms of CPU\n'
 ' * with outcome "exceededCpu", which does not fit a plain CPU ceiling (a sibling worker was\n'
 ' * measured at 158 ms CPU on a successful request). Cause is unconfirmed; the guard is\n'
 ' * justified by the outcome, not by a theory: callers get a readable 413 instead of a\n'
 ' * Cloudflare HTML page, and /v1/pdf/pages keeps working for the same file.\n'
 ' */\n')
t = t.replace(old_doc, new_doc)
p.write_text(t, encoding="utf-8")
print("comment rewritten")
