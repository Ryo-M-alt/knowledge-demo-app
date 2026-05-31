export async function POST() {
  return new Response("SUCCESS", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
