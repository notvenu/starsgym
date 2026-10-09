import { activateByOrder, verifyWebhook } from "@/lib/razorpay";

// Razorpay Dashboard → Webhooks → this URL, events: payment.captured. Backstop for buyers who close the tab after paying.
export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyWebhook(body, request.headers.get("x-razorpay-signature") ?? "")) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(body);
  const payment = event.payload?.payment?.entity;
  if (event.event === "payment.captured" && payment?.order_id) {
    await activateByOrder(payment.order_id, payment.id);
  }
  return Response.json({ ok: true });
}
