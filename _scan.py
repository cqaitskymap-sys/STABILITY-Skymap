import os
import re

root = r"D:\PATRI\STABILITY-skymap\src"
print("SRC:", os.listdir(root))
print("SERVICES:", os.listdir(os.path.join(root, "services")))
print("LIB:", os.listdir(os.path.join(root, "lib")))
print("HOOKS:", os.listdir(os.path.join(root, "hooks")))
print("CONTEXTS:", os.listdir(os.path.join(root, "contexts")))
print("COMPONENTS:", os.listdir(os.path.join(root, "components")))

pages = []
for dp, _, fs in os.walk(os.path.join(root, "app")):
    if "page.tsx" in fs:
        pages.append(os.path.relpath(os.path.join(dp, "page.tsx"), root).replace("\\", "/"))
print("PAGE_COUNT", len(pages))
for p in sorted(pages):
    print("PAGE", p)

pat = re.compile(
    r"(TODO|FIXME|XXX|HACK|not implemented|coming soon|under construction|\bSTUB\b|\bWIP\b)",
    re.I,
)
print("==== MARKERS ====")
for dp, _, fs in os.walk(root):
    for fn in fs:
        if not fn.endswith((".ts", ".tsx")):
            continue
        path = os.path.join(dp, fn)
        rel = os.path.relpath(path, root).replace("\\", "/")
        text = open(path, encoding="utf-8").read()
        for i, line in enumerate(text.splitlines(), 1):
            if (
                pat.search(line)
                and "placeholder" not in line.lower()
                and "ListTodo" not in line
            ):
                print(f"{rel}:{i}: {line.strip()[:160]}")

print("==== SHORT PAGES ====")
for p in sorted(pages):
    path = os.path.join(root, p.replace("/", os.sep))
    lines = open(path, encoding="utf-8").read().splitlines()
    text = "\n".join(lines)
    flags = []
    if len(lines) < 45:
        flags.append(f"short:{len(lines)}")
    if "redirect(" in text:
        flags.append("redirect")
    if re.search(
        r"coming soon|not yet|Reminders only|cannot execute|not marked complete|managed by Firebase|stub",
        text,
        re.I,
    ):
        flags.append("stubbish")
    if flags:
        print(p, ",".join(flags))

print("==== PARAM USAGE ====")
for dp, _, fs in os.walk(os.path.join(root, "app")):
    for fn in fs:
        if not fn.endswith((".ts", ".tsx")):
            continue
        path = os.path.join(dp, fn)
        rel = os.path.relpath(path, root).replace("\\", "/")
        text = open(path, encoding="utf-8").read()
        if "useParams" in text or "searchParams" in text or (
            "params" in text and "[" in path
        ):
            for i, line in enumerate(text.splitlines(), 1):
                if re.search(r"useParams|searchParams|\bparams\b|await params", line):
                    print(f"{rel}:{i}: {line.strip()[:140]}")

print("==== DUPLICATE URLS ====")
routes = {}
for p in pages:
    parts = [x for x in p.replace("\\", "/").split("/") if x != "page.tsx"]
    parts = parts[1:]  # drop app
    parts = [x for x in parts if not (x.startswith("(") and x.endswith(")"))]
    url = "/" + "/".join(parts)
    routes.setdefault(url, []).append(p)
for url, ps in sorted(routes.items()):
    if len(ps) > 1:
        print("CONFLICT", url, ps)

print("==== MISSING USE CLIENT ====")
for p in pages:
    path = os.path.join(root, p.replace("/", os.sep))
    text = open(path, encoding="utf-8").read()
    uses_hooks = bool(
        re.search(
            r"\buse(State|Effect|Router|Pathname|SearchParams|Auth|Async|Memo|Callback|Ref)\b",
            text,
        )
    )
    has_client = "use client" in text[:200]
    if uses_hooks and not has_client:
        print("MISSING", p)

print("==== IMPORT PATH CHECK ====")
for dp, _, fs in os.walk(root):
    for fn in fs:
        if not fn.endswith((".ts", ".tsx")):
            continue
        path = os.path.join(dp, fn)
        rel = os.path.relpath(path, root).replace("\\", "/")
        text = open(path, encoding="utf-8").read()
        for i, line in enumerate(text.splitlines(), 1):
            if "@/hooks/" in line or "@/hook/" in line:
                print(f"{rel}:{i}: {line.strip()}")
            if "@/contexts/" in line or "@/context/" in line:
                print(f"{rel}:{i}: {line.strip()}")
