import { describe, expect, it } from "vitest";
import { loginUser, registerUser, validCredentials } from "./helpers.js";

describe("POST /auth/login", () => {
  it("повертає 200 з парою токенів і публічним користувачем", async () => {
    await registerUser();
    const res = await loginUser();

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: validCredentials.email });
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("повертає 401 на невірний пароль", async () => {
    await registerUser();
    const res = await loginUser({ password: "definitely-not-the-password" });

    expect(res.status).toBe(401);
  });

  it("на неіснуючий email відповідає тим самим кодом і побайтово тим самим текстом, що й на невірний пароль", async () => {
    await registerUser();

    const wrongPassword = await loginUser({ password: "definitely-not-the-password" });
    const unknownEmail = await loginUser({ email: "nobody@example.com" });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);

    // Порівнюємо самі відповіді між собою, а не з хардкодом: будь-яка розбіжність —
    // це user enumeration, атакуючий за текстом помилки дізнається, чи є такий email.
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(unknownEmail.text).toBe(wrongPassword.text);
  });
});
