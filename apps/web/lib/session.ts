export type Session = { userId: number; expiresAt: number };
export function parseSession(value: unknown): Session {
  if (!value || typeof value !== "object" || !("userId" in value) || !("expiresAt" in value) ||
    !Number.isSafeInteger(value.userId) || Number(value.userId) < 1 ||
    !Number.isSafeInteger(value.expiresAt) || Number(value.expiresAt) <= Date.now()) {
    throw new Error("Máy chủ trả phiên đăng nhập không hợp lệ.");
  }
  return { userId: Number(value.userId), expiresAt: Number(value.expiresAt) };
}
export function proxyPath(path: string): string {
  if (!/^\/(?:api\/)?[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*(?:\?[^#]*)?$/.test(path)) throw new Error("Đường dẫn API không hợp lệ.");
  return `/api/session/proxy${path.replace(/^\/api\//, "/")}`;
}
export function passwordFitsBcrypt(password: string): boolean {
  return new TextEncoder().encode(password).byteLength <= 72;
}

export class SessionLifecycle {
  private version = 0;
  private logoutBlocked = false;
  private logoutRunning = false;
  capture() { return this.version; }
  isCurrent(version: number) { return this.version === version; }
  advance() { return ++this.version; }
  login() {
    if (this.logoutBlocked) throw new Error("Vui lòng hoàn tất đăng xuất trước khi đăng nhập lại.");
    this.advance();
  }
  beginLogout(): number | null {
    if (this.logoutRunning) return null;
    this.logoutBlocked = true;
    this.logoutRunning = true;
    return this.advance();
  }
  finishLogout(version: number, confirmed: boolean): boolean {
    if (!this.isCurrent(version)) return false;
    this.logoutRunning = false;
    if (confirmed) this.logoutBlocked = false;
    return true;
  }
  async request<T>(operation: () => Promise<T>, unauthorized: (error: unknown) => boolean, expire: () => void): Promise<T> {
    const version = this.capture();
    try { return await operation(); }
    catch (error) {
      if (this.isCurrent(version) && !this.logoutBlocked && unauthorized(error)) expire();
      throw error;
    }
  }
}
