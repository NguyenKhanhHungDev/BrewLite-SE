export type Product = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
};

export function parseProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) throw new Error("Invalid products response");
  const ids = new Set<number>();
  return value.map((item: unknown) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "number" ||
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      ids.has(item.id) ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !("price" in item) ||
      typeof item.price !== "number" ||
      !Number.isSafeInteger(item.price) ||
      item.price < 0 ||
      !("imageUrl" in item) ||
      typeof item.imageUrl !== "string" ||
      !("stock" in item) ||
      typeof item.stock !== "number" ||
      !Number.isSafeInteger(item.stock) ||
      item.stock < 0
    )
      throw new Error("Invalid product fields");
    ids.add(item.id);
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      stock: item.stock,
    };
  });
}
