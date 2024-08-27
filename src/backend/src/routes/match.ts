import { Hono } from "hono";
import { prisma } from "../db";
import { ServerResponse } from "../types";

export const match = new Hono();

match.post("/:username/match", async (c) => {
  const currentUser = c.get("user");
  const username = c.req.param("username");
  const user = await prisma.user.findUnique({
    where: {
      username,
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

  const hasInitiated = await prisma.matches.count({
    where: {
      firstUsername: currentUser.username,
      secondUsername: username,
    },
  });

  if (hasInitiated) {
    return c.jsonT<ServerResponse<null>>(
      {
        message: "You already matched with this person!",
        data: null,
      },
      400
    );
  }

  const otherWhereFilter = {
    firstUsername_secondUsername: {
      firstUsername: username,
      secondUsername: currentUser.username,
    },
  };
  const otherInitiated = await prisma.matches.findUnique({
    where: otherWhereFilter,
  });

  if (otherInitiated) {
    await prisma.matches.update({
      where: otherWhereFilter,
      data: {
        mutual: true,
      },
    });
  } else {
    await prisma.matches.create({
      data: {
        firstUsername: currentUser.username,
        secondUsername: username,
      },
    });
  }

  return c.jsonT<ServerResponse<null>>({
    message: "Successfully matched!",
    data: null,
  });
});

match.get("/", async (c) => {
  const currentUser = c.get("user");
  const matches = await prisma.matches.findMany({
    where: {
      OR: [
        {
          firstUsername: currentUser.username,
        },
        {
          secondUsername: currentUser.username,
        },
      ],
    },
  });

  const allUsernames = matches.flatMap((match) => [
    match.firstUsername,
    match.secondUsername,
  ]);
  const users = await prisma.user.findMany({
    where: {
      username: {
        in: allUsernames,
      },
    },
    select: {
      username: true,
      name: true,
      whatsapp: true,
      instagram: true,
      line: true,
    },
  });

  const pendingUsernames = matches
    .filter((m) => !m.mutual)
    .flatMap((m) => [m.firstUsername, m.secondUsername]);

  const finalUsers = users.map((u) => {
    if (!pendingUsernames.includes(u.username)) return u;
    return {
      username: u.username,
      name: u.name,
      whatsapp: "NETSOS{Ch3CK_y0UR_P3rmisSion_",
      instagram: "NETSOS{Ch3CK_y0UR_P3rmisSion_",
      line: "NETSOS{Ch3CK_y0UR_P3rmisSion_",
    };
  });

  const responseData = {
    matches,
    users: finalUsers,
  };

  return c.jsonT<ServerResponse<typeof responseData>>({
    message: "Success",
    data: responseData,
  });
});
