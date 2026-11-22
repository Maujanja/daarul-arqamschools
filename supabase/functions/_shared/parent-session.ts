import { SignJWT, jwtVerify } from "https://esm.sh/jose@5.9.6";

const issuer = "daarul-parent-progress";
function sessionKey() {
  const secret = Deno.env.get("PARENT_PROGRESS_SESSION_SECRET");
  if (!secret) throw new Error("Parent progress session service is unavailable");
  return new TextEncoder().encode(secret);
}

export async function issueParentSession(studentId: string, parentId: string) {
  return new SignJWT({ studentId, parentId, role: "parent" })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience("child-progress")
    .setSubject(studentId).setIssuedAt().setExpirationTime("7d").sign(sessionKey());
}

export async function verifyParentSession(token: string) {
  const { payload } = await jwtVerify(token, sessionKey(), {
    algorithms: ["HS256"], issuer, audience: "child-progress",
  });
  if (payload.role !== "parent" || typeof payload.studentId !== "string" ||
    payload.sub !== payload.studentId || typeof payload.parentId !== "string") {
    throw new Error("Invalid parent session");
  }
  return { studentId: payload.studentId, parentId: payload.parentId };
}