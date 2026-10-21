// y for a given x on a cubic-bezier easing, solved by bisection.
export function ease([x1, y1, x2, y2]: number[], x: number) {
  const at = (a: number, b: number, t: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 24; i++) {
    t = (lo + hi) / 2;
    if (at(x1, x2, t) < x) lo = t;
    else hi = t;
  }
  return at(y1, y2, t);
}

// y for a given x on curve points from `curvePoints`: four cubic-bezier values, or evenly spaced linear() stops.
export function curveAt(points: number[], x: number) {
  if (points.length === 4) return ease(points, x);
  const position = Math.min(Math.max(x, 0), 1) * (points.length - 1);
  const index = Math.min(Math.floor(position), points.length - 2);
  return points[index] + (points[index + 1] - points[index]) * (position - index);
}
