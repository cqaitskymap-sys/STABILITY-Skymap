import os
import re
import ast

root = r"D:\PATRI\STABILITY-skymap"


def read(rel):
    path = os.path.join(root, rel.replace("/", os.sep))
    return open(path, encoding="utf-8").read()


def dump(rel, start=1, end=None):
    lines = read(rel).splitlines()
    end = end or len(lines)
    print(f"\n===== {rel} ({start}-{end}/{len(lines)}) =====")
    for i in range(start - 1, min(end, len(lines))):
        print(f"{i+1}|{lines[i]}")


# Key architecture files
for rel in [
    "src/app/layout.tsx",
    "src/app/(app)/layout.tsx",
    "src/app/page.tsx",
    "src/app/login/page.tsx",
    "src/hooks/useAsync.ts",
    "src/lib/modules.ts",
    "src/lib/firebase/config.ts",
    "src/lib/remember-login.ts",
]:
    dump(rel)

print("\n===== permissions exports/roles =====")
text = read("src/lib/permissions.ts")
for i, line in enumerate(text.splitlines(), 1):
    if re.search(
        r"permission:|ROLE_|function |export |Admin|control\.|users\.|moduleAccess|effective",
        line,
    ):
        print(f"{i}|{line}")

print("\n===== auth-context key lines =====")
text = read("src/contexts/auth-context.tsx")
for i, line in enumerate(text.splitlines(), 1):
    if re.search(
        r"bootstrap|moduleAccess|active|createUser|secondary|remember|signIn|hasPermission|can\(|ensureProfile|NEXT_PUBLIC",
        line,
    ):
        print(f"{i}|{line.strip()}")

print("\n===== sidebar hrefs =====")
text = read("src/components/layout/sidebar.tsx")
for i, line in enumerate(text.splitlines(), 1):
    if "href:" in line or "label:" in line and "NAV" not in line:
        if "href:" in line or (
            "label:" in line and ("permission" in text.splitlines()[i - 1] or True)
        ):
            if "href:" in line or re.match(r"\s*\{ label:", line):
                print(f"{i}|{line.strip()}")

print("\n===== firestore.rules risk patterns =====")
rules = read("firestore.rules")
for i, line in enumerate(rules.splitlines(), 1):
    if re.search(
        r"allow |isQAStaff|bootstrap|auditLogs|counters|isSignedIn\(\)|canControl|moduleAccess|delete|update",
        line,
    ):
        print(f"{i}|{line.rstrip()}")

print("\n===== daily-collection service symbols =====")
text = read("src/services/daily-collection.ts")
# find names used vs defined
defined = set(re.findall(r"^(?:async\s+)?function\s+(\w+)|^(?:export\s+)?async\s+function\s+(\w+)|^(?:export\s+)?function\s+(\w+)", text, re.M))
defined = {a or b or c for a, b, c in re.findall(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)", text)}
imported = set()
for m in re.finditer(r"import\s+\{([^}]+)\}", text):
    for part in m.group(1).split(","):
        name = part.strip().split(" as ")[0].strip()
        if name:
            imported.add(name)
used = set(re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(", text))
print("defined", sorted(defined))
print("imported", sorted(imported))
print("possibly undefined calls", sorted(used - defined - imported - {"Error", "Number", "String", "Boolean", "Array", "Object", "Date", "Promise", "Math", "JSON", "RegExp", "Map", "Set", "parseInt", "parseFloat", "isNaN", "encodeURIComponent", "decodeURIComponent"}))

print("\n===== masters.ts import/use check =====")
text = read("src/services/masters.ts")
print("has deleteDoc import", "deleteDoc" in text.split("from \"firebase/firestore\"")[0] if "firebase/firestore" in text else "n/a")
print("uses deleteDoc", "deleteDoc(" in text)
print("uses updateDoc", "updateDoc(" in text)
print("MasterStatus type used", "MasterStatus" in text)
# undefined MasterStatus in setMasterStatus?
for i, line in enumerate(text.splitlines(), 1):
    if "MasterStatus" in line or "deleteDoc" in line or "updateDoc" in line and i > 130:
        print(f"{i}|{line}")

print("\n===== users.ts issues =====")
text = read("src/services/users.ts")
print(text)

print("\n===== inventory suspicious =====")
text = read("src/services/inventory.ts")
print("lines", len(text.splitlines()))
# look for race-y patterns, wrong field names, TODO
for i, line in enumerate(text.splitlines(), 1):
    if re.search(r"TODO|FIXME|any\b|as any|@ts-|catch\s*\{\s*\}|console\.|throw new Error|availableQuantity|reservedQuantity|writeBatch|runTransaction", line):
        if i < 250 or "Transaction" in line or "TODO" in line or "as any" in line or "catch {" in line:
            print(f"{i}|{line.strip()[:160]}")

print("\n===== control-samples throw Direct =====")
text = read("src/services/control-samples.ts")
print("lines", len(text.splitlines()))
for i, line in enumerate(text.splitlines(), 1):
    if "Direct " in line or "not allowed" in line or "TODO" in line or "FIXME" in line:
        print(f"{i}|{line.strip()[:160]}")

print("\n===== tasks page links vs existing routes =====")
tasks = read("src/app/(app)/stability/tasks/page.tsx")
hrefs = re.findall(r'href:\s*"([^"]+)"', tasks)
# build existing urls
pages = []
for dp, _, fs in os.walk(os.path.join(root, "src", "app")):
    if "page.tsx" in fs:
        parts = os.path.relpath(dp, os.path.join(root, "src", "app")).replace("\\", "/").split("/")
        parts = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]
        pages.append("/" + "/".join(parts) if parts != ["."] else "/")
for h in hrefs:
    ok = h in pages or any(p.startswith(h) for p in pages)
    print(("OK " if ok else "BROKEN "), h)

print("\n===== collection page import errors =====")
text = read("src/app/(app)/stability/control-samples/collection/page.tsx")
for i, line in enumerate(text.splitlines()[:50], 1):
    print(f"{i}|{line}")
