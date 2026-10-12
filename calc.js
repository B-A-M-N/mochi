export function computeCartTotal(items) {
  let t = 0;
  for (const it of items) {
    t += it.price * it.qty;
  }
  return t;
}