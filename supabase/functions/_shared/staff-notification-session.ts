import { SignJWT, jwtVerify } from "https://esm.sh/jose@5.9.6";

const key = () => {
  const secret = Deno.env.get("PARENT_PROGRESS_SESSION_SECRET");
  if (!secret) throw new Error("Notification authentication unavailable");
  return new TextEncoder().encode(secret);
};
export async function issueNotificationSession(id: string, role: string) {
  return new SignJWT({ role }).setProtectedHeader({ alg: "HS256" }).setSubject(id)
    .setIssuer("daarul-staff").setAudience("result-notifications").setIssuedAt()
    .setExpirationTime("7d").sign(key());
}
export async function verifyNotificationSession(token: string, className: string) {
  const { payload } = await jwtVerify(token, key(), {
    algorithms: ["HS256"], issuer: "daarul-staff", audience: "result-notifications",
  });
  const section = /^Primary\b/i.test(className) ? "primary" : /^Senior\b/i.test(className) ? "secondary" : "nursery";
  if (!payload.sub || (payload.role !== "admin" && payload.role !== `head_${section}`)) throw new Error("Not authorized");
  return payload;
}