import { Hono } from "hono";
import { prisma } from "../db";
import { ServerResponse } from "../types";
import { User } from "@prisma/client";

export const users = new Hono();

users.get("/me", async (c) => {
  const user = c.get("user");
  return c.jsonT<ServerResponse<User>>({
    message: "Success",
    data: {
      ...user,
      password: "",
    },
  });
});

users.get("/find/:name", async (c) => {
  const name = c.req.param("name");
  const user = await prisma.user.findMany({
    where: {
      name: {
        contains: name,
      },
    },
    select: {
      username: true,
      name: true,
    },
  });

  if (!user) {
    return c.jsonT<ServerResponse<null>>(
      {
        message: "User not found",
        data: null,
      },
      404
    );
  }

  return c.jsonT<ServerResponse<typeof user>>({
    message: "Success",
    data: user,
  });
});

users.post("/update", async (c) => {
  const user = c.get("user");
  const { username, ...data } = await c.req.json();
  if (data.password) {
    delete data["password"];
  }

  await prisma.user.update({
    where: { username },
    data,
  });

  if (user.username != username) {
    return c.jsonT<ServerResponse<null> & { flag: string }>({
      message: "Success",
      data: null,
      flag: "anD_4Uthor1zaTion}",
    });
  }

  return c.jsonT<ServerResponse<null>>({
    message: "Success",
    data: null,
  });
});
