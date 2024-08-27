import { MiddlewareHandler } from "hono";
import { prisma } from "../db";
import { JWTPayload, ServerResponse } from "../types";
import { User } from "@prisma/client";

declare module "hono" {
  interface ContextVariableMap {
    user: User;
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const payload: JWTPayload = c.get("jwtPayload");
  const user = await prisma.user.findUnique({
    where: { username: payload.sub },
  });

  if (!user) {
    c.jsonT<ServerResponse<null>>(
      {
        message: "Unauthorized",
        data: null,
      },
      401
    );
    return;
  }

  c.set("user", user);
  await next();
};
