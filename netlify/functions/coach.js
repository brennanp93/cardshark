import { coachAdvice } from "../../lib/coach.js";

export default async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });
  const requestBody = await req.json().catch(() => null);
  const { status, body } = await coachAdvice(requestBody);
  return Response.json(body, { status });
};

export const config = { path: "/api/coach" };
