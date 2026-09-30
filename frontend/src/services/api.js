const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createApi(getToken, onUnauthorized) {
  return async function request(path, { method = 'GET', body, params } = {}) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, String(value));
    });
    const token = getToken();
    let response;
    try {
      response = await fetch(`${baseUrl}${path}${query.size ? `?${query}` : ''}`, {
        method,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) onUnauthorized();
      const fallback = response.status === 403 ? 'No tienes permiso para esta operación.'
        : response.status === 409 ? 'El registro entra en conflicto con datos existentes o referencias inactivas.'
          : response.status === 400 ? 'Revisa los datos ingresados.' : 'Ocurrió un error. Inténtalo de nuevo.';
      throw new ApiError(response.status, payload.message || fallback);
    }
    return payload;
  };
}
