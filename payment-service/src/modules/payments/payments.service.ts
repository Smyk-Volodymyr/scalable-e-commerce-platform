import type Stripe from "stripe";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { withTransaction } from "../../db/pool.js";
import { stripe } from "../../lib/stripe.js";
import * as ordersClient from "../../clients/orders.client.js";
import * as repo from "./payments.repository.js";

export interface PaymentIntentResponse {
  paymentId: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
  status: string;
}

export async function createIntent(
  userId: string,
  orderId: string,
  authHeader: string,
): Promise<PaymentIntentResponse> {
  const existing = await repo.findByOrderId(orderId);
  if (existing) {
    if (existing.status === "succeeded") throw conflict("Замовлення вже оплачене");
    if (existing.provider_intent_id) {
      const intent = await stripe.paymentIntents.retrieve(existing.provider_intent_id);
      return {
        paymentId: existing.id,
        clientSecret: intent.client_secret!,
        amountCents: existing.amount_cents,
        currency: existing.currency,
        status: existing.status,
      };
    }
  }

  const order = await ordersClient.getOrder(orderId, authHeader);
  if (order.status !== "pending") {
    throw badRequest(`Не можна оплатити замовлення у статусі "${order.status}"`);
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: order.totalCents,    
      currency: order.currency.toLowerCase(),
      metadata: { orderId, userId },
       automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    },
    {
      idempotencyKey: `order_${orderId}`,
    },
  );

  const payment = await repo.insert({
    orderId,
    userId,
    amountCents: order.totalCents,
    currency: order.currency,
    intentId: intent.id,
  });

  return {
    paymentId: payment.id,
    clientSecret: intent.client_secret!,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    status: payment.status,
  };
}

export async function handleEvent(event: Stripe.Event): Promise<void> {
  const isNew = await withTransaction((client) =>
    repo.markEventProcessed(client, event.id, event.type),
  );
  if (!isNew) {
    console.log(`Подію ${event.id} вже оброблено, пропускаю`);
    return;
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const changed = await repo.setStatus(intent.id, "succeeded");
      if (!changed) break;

      const orderId = intent.metadata.orderId;
      if (orderId) {
        await ordersClient.markPaid(orderId);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await repo.setStatus(intent.id, "failed", intent.last_payment_error?.message);
      break;
    }

    default:
      console.log(`Подія ${event.type} не потребує обробки`);
  }
}

export async function getByOrderId(userId: string, orderId: string) {
  const row = await repo.findByOrderId(orderId);
  if (!row || row.user_id !== userId) throw notFound("Платіж не знайдено");
  return {
    id: row.id,
    orderId: row.order_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  };
}