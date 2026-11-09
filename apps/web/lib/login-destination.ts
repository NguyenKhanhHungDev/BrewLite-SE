const adminPages = new Set([
  '/admin', '/admin/ingredients', '/admin/recipes', '/admin/orders', '/admin/payments',
]);
const customerPages = new Set(['/account', '/checkout', '/history', '/cart']);

// Role must come from the authenticated /auth/me response, never email or input.
export function loginDestination(role: unknown, requested: string | null): string {
  if (role === 'ADMIN') return requested && adminPages.has(requested) ? requested : '/admin';
  if (role !== 'CUSTOMER') throw new Error('Không xác nhận được quyền tài khoản. Vui lòng thử lại.');
  if (requested && (
    customerPages.has(requested) || /^\/confirmation\/[1-9]\d*$/.test(requested) ||
    /^\/payment\/result\?orderId=[1-9]\d*$/.test(requested)
  )) return requested;
  return '/';
}
