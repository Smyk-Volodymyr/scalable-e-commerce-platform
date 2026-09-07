import { AppError } from "@shop/shared/errors";
import { env } from "../config/env.js";

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  stock: number;
  isActive: boolean;
}

export async function getProduct(id: string): Promise<CatalogProduct | null> {
  let res: Response;

  try {
    res = await fetch(`${env.PRODUCT_SERVICE_URL}/products/${id}`, {
      signal: AbortSignal.timeout(3000),
      headers: { accept: "application/json" },
    });
  } catch {
    throw new AppError(503, "Каталог тимчасово недоступний");
  }

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new AppError(502, "Каталог повернув помилку");
  }

  return (await res.json()) as CatalogProduct;
}