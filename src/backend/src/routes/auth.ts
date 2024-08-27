import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../db";
import * as bcrypt from "bcrypt";
import { ServerResponse } from "../types";
import { sign } from "hono/jwt";
export const auth = new Hono();

const zAuthObject = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const zRegisterObject = zAuthObject.extend({
  name: z.string().min(1),
  line: z.string().max(32).optional(),
  whatsapp: z.string().max(13).optional(),
  instagram: z.string().max(32).optional(),
});

auth.post("/login", zValidator("json", zAuthObject), async (c) => {
  const data = c.req.valid("json");
  const user = await prisma.user.findUnique({
    where: { username: data.username },
  });
  if (!user) {
    return c.jsonT<ServerResponse<null>>(
      {
        message: "Invalid username or password",
        data: null,
      },
      401
    );
  }

  const isValid = await bcrypt.compare(data.password, user.password);
  if (!isValid) {
    return c.jsonT<ServerResponse<null>>(
      {
        message: "Invalid username or password",
        data: null,
      },
      401
    );
  }

  const token = await sign(
    {
      sub: user.username,
    },
    process.env.SECRET!,
    "HS256"
  );
  return c.jsonT<ServerResponse<string>>({
    message: "Authenticated",
    data: token,
  });
});

auth.post("/register", zValidator("json", zRegisterObject), async (c) => {
  const data = c.req.valid("json");
  const hashedPassword = await bcrypt.hash(data.password, 10);
  try {
    await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
    return c.jsonT<ServerResponse<null>>({
      message: "Success",
      data: null,
    });
  } catch {
    return c.jsonT<ServerResponse<null>>(
      {
        message: "Username already exists",
        data: null,
      },
      400
    );
  }
});
