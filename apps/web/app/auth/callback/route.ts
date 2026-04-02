export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.redirect(new URL(`/api/v1/auth/callback${url.search}`, url.origin));
}
