import { getPrice } from "./inventory.js";

export function calculateOrderTotal(order) {
  let total = 0;
  for (const item of order) {
    const price = getPrice(item.name);
    const quantity = item.quantity;
    total += price * quantity;
  }
  return total;
}

export function processOrder(order) {
  const total = calculateOrderTotal(order);
  console.log(total);
  return total;
}