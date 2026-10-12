export const inventory = {
  apple: { price: 2, quantity: 10 },
  banana: { price: 1, quantity: 5 },
  orange: { price: 3, quantity: 8 },
};

export function getPrice(item) {
  return inventory[item]?.price ?? 0;
}

export function getQuantity(item) {
  return inventory[item]?.quantity ?? 0;
}