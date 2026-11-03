import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.INGREDIENTS_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite('Ingredients HTTP and database', () => {
  let server: ChildProcess;
  let pool: Pool;
  let admin = '',
    customer = '';
  let ingredientId = 0;
  const base = 'http://127.0.0.1:55845';
  const name = `Ingredients test ${randomUUID()}`;
  async function call(
    path: string,
    token = admin,
    method = 'GET',
    body?: unknown,
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: res.status,
      data: (await res.json()) as Record<string, unknown>,
    };
  }
  beforeAll(async () => {
    const target = new URL(databaseUrl!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      !/^\/brewlite_huy_test_[a-z0-9_]+$/.test(target.pathname)
    )
      throw new Error('Use a dedicated local brewlite_huy_test_* database.');
    pool = new Pool({ connectionString: databaseUrl });
    server = spawn(process.execPath, ['dist/main.js'], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        JWT_SECRET: randomUUID(),
        PORT: '55845',
      },
      stdio: 'ignore',
    });
    for (let retry = 0; retry < 100; retry++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const password = randomUUID();
    const emails = [
      `admin-${randomUUID()}@example.test`,
      `customer-${randomUUID()}@example.test`,
    ];
    for (const email of emails)
      expect(
        (await call('/auth/register', '', 'POST', { email, password })).status,
      ).toBe(201);
    await pool.query('UPDATE "User" SET "role" = $1 WHERE "email" = $2', [
      'ADMIN',
      emails[0],
    ]);
    admin = String(
      (await call('/auth/login', '', 'POST', { email: emails[0], password }))
        .data.accessToken,
    );
    customer = String(
      (await call('/auth/login', '', 'POST', { email: emails[1], password }))
        .data.accessToken,
    );
  }, 30000);
  afterAll(async () => {
    server?.kill();
    await pool?.end();
  });

  it('requires authentication and database Admin role for every route', async () => {
    for (const [path, method, body] of [
      ['/ingredients', 'GET', undefined],
      ['/ingredients', 'POST', { name, unit: 'g', stock: 10, minStock: 1 }],
      ['/ingredients/1', 'PATCH', { name }],
      ['/ingredients/1/restock', 'POST', { quantity: 1 }],
    ] as const) {
      expect((await call(path, '', method, body)).status).toBe(401);
      expect((await call(path, customer, method, body)).status).toBe(403);
    }
  });
  it('creates one row when two requests race with the same name', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        call('/ingredients', admin, 'POST', {
          name,
          unit: 'g',
          stock: 100,
          minStock: 20,
        }),
      ),
    );
    expect(
      results.map((result) => result.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    const item = results.find((result) => result.status === 201)!.data;
    ingredientId = Number(item.id);
    expect(item.reserved).toBe(0);
    expect(item.available).toBe(100);
  });
  it('increments atomically for parallel restocks and preserves reserved', async () => {
    await pool.query('UPDATE "Ingredient" SET "reserved" = 10 WHERE "id"=$1', [
      ingredientId,
    ]);
    const results = await Promise.all(
      [1, 2].map(() =>
        call(`/ingredients/${ingredientId}/restock`, admin, 'POST', {
          quantity: 50,
        }),
      ),
    );
    expect(results.every((result) => result.status === 201)).toBe(true);
    const row = (
      await pool.query(
        'SELECT "stock","reserved" FROM "Ingredient" WHERE "id"=$1',
        [ingredientId],
      )
    ).rows[0] as { stock: number; reserved: number };
    expect(row).toEqual({ stock: 200, reserved: 10 });
  });
  it('rejects forbidden fields, null and invalid quantities without changing stock', async () => {
    for (const body of [
      { stock: 0 },
      { reserved: 0 },
      { unit: 'ml' },
      { name: null },
      { minStock: null },
      {},
    ])
      expect(
        (await call(`/ingredients/${ingredientId}`, admin, 'PATCH', body))
          .status,
      ).toBe(400);
    for (const quantity of [0, -1, 1.5, null, '1'])
      expect(
        (
          await call(`/ingredients/${ingredientId}/restock`, admin, 'POST', {
            quantity,
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await call('/ingredients', admin, 'POST', {
          name: `${name}-bad`,
          unit: 'kg',
          stock: 0,
          minStock: 0,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call('/ingredients', admin, 'POST', {
          name: `${name}-bad`,
          unit: 'g',
          stock: 0,
          minStock: 0,
          reserved: 0,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(`/ingredients/${ingredientId}`, admin, 'PATCH', {
          name: ` ${name}-edited `,
          minStock: 300,
        })
      ).data,
    ).toMatchObject({
      name: `${name}-edited`,
      stock: 200,
      reserved: 10,
      available: 190,
      minStock: 300,
    });
  });
  it('returns 404 for missing rows and 400 for overflow including a concurrent race', async () => {
    expect(
      (await call('/ingredients/2147483647', admin, 'PATCH', { minStock: 1 }))
        .status,
    ).toBe(404);
    expect(
      (
        await call('/ingredients/2147483647/restock', admin, 'POST', {
          quantity: 1,
        })
      ).status,
    ).toBe(404);
    await pool.query(
      'UPDATE "Ingredient" SET "stock" = 2147483646 WHERE "id"=$1',
      [ingredientId],
    );
    const results = await Promise.all(
      [1, 2].map(() =>
        call(`/ingredients/${ingredientId}/restock`, admin, 'POST', {
          quantity: 1,
        }),
      ),
    );
    expect(
      results.map((result) => result.status).sort((a, b) => a - b),
    ).toEqual([201, 400]);
    expect(
      (
        await pool.query('SELECT "stock" FROM "Ingredient" WHERE "id"=$1', [
          ingredientId,
        ])
      ).rows[0].stock,
    ).toBe(2147483647);
  });
});
