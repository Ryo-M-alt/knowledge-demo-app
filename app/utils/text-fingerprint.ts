/**
 * サーバー側 `fingerprintText`（SHA-256 の hex の先頭 32 文字）と同じ値を
 * ブラウザの Web Crypto で算出する。
 */
export async function fingerprintTextBrowser(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 32);
}
