import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { authMiddleware } from "./middleware/auth";
import { users } from "./routes/user";
import { auth } from "./routes/auth";
import { match } from "./routes/match";
import { cors } from "hono/cors";

const app = new Hono();
app.use(
  "*",
  cors({
    // This is actually a security issue!
    // However, it is not part of the challenge
    origin: (origin) => origin,
    credentials: true,
  })
);
app.use(
  "/users/*",
  jwt({
    secret: process.env.SECRET!,
  })
);
app.use("/users/*", authMiddleware);
app.use(
  "/match/*",
  jwt({
    secret: process.env.SECRET!,
  })
);
app.use("/match/*", authMiddleware);
app.get("/", (c) => c.text("Hello Hono!"));
app.route("/users", users);
app.route("/match", match);
app.route("/auth", auth);

console.log("Serving on http://localhost:3000");
serve(app);
