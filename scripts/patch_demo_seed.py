import pathlib, re
p = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\scripts\build_demos.py")
t = p.read_text(encoding="utf-8")

# form_text gains a default seed value
t = t.replace(
'''def form_text(id_, placeholder):
    return (f'      <form id="demo-form" style="margin:34px 0 10px;max-width:680px">\\n'
            f'        <textarea id="{id_}" required rows="4" placeholder="{placeholder}"\\n'
            '          style="width:100%;padding:12px 14px;background:var(--bg-raised);border:1px solid var(--line-bright);border-radius:10px;color:var(--text);font-family:var(--font-mono);font-size:.9rem;resize:vertical">The deploy was smooth and the tests all passed, but the docs are still thin.</textarea>\\n' ''',
'''def form_text(id_, placeholder, default=None):
    seed = default or "The deploy was smooth and the tests all passed, but the docs are still thin."
    return (f'      <form id="demo-form" style="margin:34px 0 10px;max-width:680px">\\n'
            f'        <textarea id="{id_}" required rows="4" placeholder="{placeholder}"\\n'
            f'          style="width:100%;padding:12px 14px;background:var(--bg-raised);border:1px solid var(--line-bright);border-radius:10px;color:var(--text);font-family:var(--font-mono);font-size:.9rem;resize:vertical">{seed}</textarea>\\n' ''')

# PII page gets a realistic ticket
t = t.replace(
    '''form=form_text("demo-text", "Paste text containing personal data"),''',
    '''form=form_text("demo-text", "Paste text containing personal data", "Hi, I am Jane Doe. Email jane.doe@example.com or call 555-123-4567. Card on file: 4111 1111 1111 1111. IP 203.0.113.42."),''')
p.write_text(t, encoding="utf-8")
print("generator patched")
