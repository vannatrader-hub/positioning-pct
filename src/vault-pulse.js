/**
 * Family-only loader. The week index lives with the Vault pack, so this file
 * stays on the vault- prefix and the public renderer never names that path.
 */
import { buildPulse } from "./pulse-pack.js";
import { WEEKS, buildReading } from "./readings.js";

export async function loadFamilyPulse() {
  const base = import.meta.env.BASE_URL;
  const [indexRes, csrRes, svbRes] = await Promise.all([
    fetch(`${base}data/vault/soft-crowded/index.json`),
    fetch(`${base}data/vault/credit-spread-regime/csr.json`),
    fetch(`${base}data/vault/spot-vol-beta/latest.json`),
  ]);
  if (!indexRes.ok || !csrRes.ok || !svbRes.ok) throw new Error("desk brief unavailable");
  const [index, csr, svb] = await Promise.all([indexRes.json(), csrRes.json(), svbRes.json()]);
  const financials = buildReading("jpm", WEEKS.length - 1, 4).sectors.XLF;
  return buildPulse({
    csr,
    vol: svb.gauge,
    asOf: svb.session,
    financials: financials ? { points: financials.points } : null,
    weeks: index.weeks ?? [],
  });
}
