import { coachEnabled } from "../../lib/coach.js";

export default async () => Response.json({ coach: coachEnabled() });

export const config = { path: "/api/status" };
