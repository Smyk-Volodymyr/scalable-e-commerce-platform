import { z } from "zod";

export const createReservationSchema = z.object({
  orderId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Резерв не може бути порожнім")
    .max(50),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;