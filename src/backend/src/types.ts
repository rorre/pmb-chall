export interface JWTPayload {
  sub: string;
}

export interface ServerResponse<T> {
  message: string;
  data: T;
}
