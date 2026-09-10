export function formatEGP(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "EG —";
  return `${new Intl.NumberFormat("ar-EG-u-nu-latn").format(number)} EG`;
}