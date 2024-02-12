import MersenneTwister from 'mersenne-twister';


let RNG_ = new MersenneTwister();

export function set_seed(seed: number) {
  RNG_ = new MersenneTwister(seed);
}

export function clamp(x: number, a: number, b: number) {
  return Math.min(Math.max(x, a), b);
}

export function sat(x: number) {
  return Math.min(Math.max(x, 0.0), 1.0);
}

export function in_range(x: number, a: number, b: number) {
  return x >= a && x <= b;
}

export function easeOut(x: number, t: number) {
  return 1.0 - Math.pow(1.0 - x, t);
}

export function easeIn(x: number, t: number) {
  return Math.pow(x, t);
}

export function rand_range(a: number, b: number) {
  return RNG_.random() * (b - a) + a;
}

export function rand_normalish() {
  const r = RNG_.random() + RNG_.random() + RNG_.random() + RNG_.random();
  return (r / 4.0) * 2.0 - 1;
}

export function rand_int(a: number, b: number) {
  return Math.round(RNG_.random() * (b - a) + a);
}

export function lerp(x: number, a: number, b: number) {
  return x * (b - a) + a;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = sat((x - edge0) / (edge1 - edge0));
  return t * t * (3.0 - 2.0 * t);
}

export function smootherstep(edge0: number, edge1: number, x: number) {
  const t = sat((x - edge0) / (edge1 - edge0));
  return (t * t * t * (t * (t * 6 - 15) + 10));
}