export function getBuildVersion(...candidates) {
  const valid = candidates.find((value) => typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value));
  return valid ? valid.slice(0, 8).toLowerCase() : 'unknown';
}
