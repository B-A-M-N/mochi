import { formatPrice } from "./util.js";

export function renderCart(items) {
  return items.map(i => formatPrice(i.cents)).join(", ");
}