import { getResource } from "../../lib/warden-state.js";

export default async function handler(_req, res) {
  res.status(200).json(await getResource("registry"));
}
