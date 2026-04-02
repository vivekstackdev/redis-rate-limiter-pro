export function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function msToSeconds(ms: number): number {
  return Math.ceil(ms / 1000);
}
