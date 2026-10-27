export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function requestJson(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      let message = `Không thể xử lý yêu cầu (HTTP ${response.status}).`;
      if (response.status === 401)
        message = "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.";
      else if (response.status === 404 && path === "/payments")
        message =
          "Chức năng thanh toán trên máy chủ chưa sẵn sàng. Giỏ hàng được giữ nguyên.";
      else if (response.status === 503)
        message = "Dịch vụ chưa sẵn sàng. Vui lòng thử lại sau.";
      else if (isObject(data) && typeof data.message === "string")
        message = data.message;
      else if (isObject(data) && Array.isArray(data.message))
        message = data.message
          .filter((item) => typeof item === "string")
          .join(". ");
      throw new ApiError(message, response.status);
    }
    if (data === null)
      throw new Error(
        "Máy chủ trả dữ liệu không hợp lệ. Vui lòng kiểm tra lại kết quả.",
      );
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      "Không nhận được kết quả từ máy chủ. Vui lòng kiểm tra kết nối rồi thử lại.",
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
