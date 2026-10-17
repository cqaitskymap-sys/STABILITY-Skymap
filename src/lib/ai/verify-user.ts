type IdentityUser = { localId: string; email?: string };
type FirestoreValue = { booleanValue?: boolean };
type FirestoreDoc = { fields?: Record<string, FirestoreValue> };

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function lookupIdentity(token: string): Promise<IdentityUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !token) return null;

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { users?: IdentityUser[] };
  return data.users?.[0] ?? null;
}

function boolField(fields: FirestoreDoc["fields"], key: string) {
  const value = fields?.[key]?.booleanValue;
  return typeof value === "boolean" ? value : undefined;
}

export async function requireSignedInUser(request: Request) {
  return lookupIdentity(bearerToken(request));
}

/** Accepts a valid ID token only when the Firestore profile is active and unlocked. */
export async function requireActiveSignedInUser(request: Request) {
  const token = bearerToken(request);
  const user = await lookupIdentity(token);
  if (!user) return null;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${user.localId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;

  const doc = (await res.json()) as FirestoreDoc;
  if (boolField(doc.fields, "active") === false) return null;
  if (boolField(doc.fields, "accountLocked") === true) return null;
  return user;
}
