import { acknowledgeBlock } from "../../lib/warden-state.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  res.status(200).json(await acknowledgeBlock());
}
