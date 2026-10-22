export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, name: "Jade Lotus Ascension", time: new Date().toISOString() });
}
