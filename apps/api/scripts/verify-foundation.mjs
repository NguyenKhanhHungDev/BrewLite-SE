import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { resolve, delimiter } from 'node:path';

// Intentionally accepts only the isolated local database used by this verification.
const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.port, '55439');
assert.match(url.pathname, /^\/brewlite_auth_check(?:_\d+)?$/);
assert.equal(process.env.VERIFY_FOUNDATION, '1');
const env = {
  ...process.env,
  JWT_SECRET: 'foundation-test-only-secret',
  PORT: '55440',
  PATH: resolve('node_modules/.bin') + delimiter + process.env.PATH,
};
const pool = new Pool({ connectionString: url.toString() });
let server;
let serverLog = '';
const run = (...args) =>
  execFileSync(process.execPath, args, { env, stdio: 'pipe' });
const query = (sql, params) => pool.query(sql, params);
try {
  run(
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--config',
    './prisma7.config.ts',
  );
  assert.equal(
    Number((await query('SELECT count(*) FROM "User"')).rows[0].count),
    0,
    'Use a fresh verification database',
  );
  await query(`INSERT INTO "User" (id,email,"passwordHash") VALUES (100,'legacy@example.invalid','fixture');
    INSERT INTO "Product" (id,name,price,"imageUrl",stock) VALUES (100,'Legacy',10000,'/legacy.jpg',5);
    INSERT INTO "Order" (id,"userId",status,total) VALUES (100,100,'PAID',10000);
    INSERT INTO "OrderItem" ("orderId","productId",quantity,toppings,"unitPrice",subtotal) VALUES (100,100,1,'[]',10000,10000);
    INSERT INTO "Payment" ("orderId",amount,"transactionRef",status) VALUES (100,10000,'legacy-payment','SUCCESS');`);
  run(
    'node_modules/prisma/build/index.js',
    'db',
    'seed',
    '--config',
    './prisma7.config.ts',
  );
  await query(
    `UPDATE "Ingredient" SET stock=1500,reserved=40 WHERE name='Cà phê bột'`,
  );
  run(
    'node_modules/prisma/build/index.js',
    'db',
    'seed',
    '--config',
    './prisma7.config.ts',
  );
  const counts = (
    await query(`SELECT (SELECT count(*) FROM "Ingredient") AS ingredients,
    (SELECT count(*) FROM "Recipe") AS recipes, (SELECT count(*) FROM "RecipeIngredient") AS links`)
  ).rows[0];
  assert.deepEqual(counts, { ingredients: '15', recipes: '10', links: '42' });
  assert.deepEqual(
    (
      await query(
        `SELECT stock,reserved FROM "Ingredient" WHERE name='Cà phê bột'`,
      )
    ).rows[0],
    { stock: 1500, reserved: 40 },
  );
  assert.equal(
    (await query(`SELECT "transactionRef" FROM "Payment" WHERE "orderId"=100`))
      .rows[0].transactionRef,
    'legacy-payment',
  );
  assert.equal(
    (await query(`SELECT "productId" FROM "OrderItem" WHERE "orderId"=100`))
      .rows[0].productId,
    100,
  );
  // A mismatch late in the ingredient list must roll back earlier metadata changes too.
  await query(
    `UPDATE "Ingredient" SET "minStock"=123 WHERE name='Cà phê bột'; UPDATE "Ingredient" SET unit='ml' WHERE name='Trân châu'`,
  );
  assert.throws(() =>
    run(
      'node_modules/prisma/build/index.js',
      'db',
      'seed',
      '--config',
      './prisma7.config.ts',
    ),
  );
  assert.equal(
    (await query(`SELECT "minStock" FROM "Ingredient" WHERE name='Cà phê bột'`))
      .rows[0].minStock,
    123,
  );
  await query(`UPDATE "Ingredient" SET unit='g' WHERE name='Trân châu'`);
  console.log(
    'PASS: migrations, seed twice, stock/reserved preservation, legacy data, seed rollback',
  );

  server = spawn(process.execPath, ['dist/main.js'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (data) => {
    serverLog += data;
  });
  server.stderr.on('data', (data) => {
    serverLog += data;
  });
  const base = 'http://127.0.0.1:55440';
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`API exited: ${serverLog}`);
    try {
      await fetch(base, { signal: AbortSignal.timeout(500) });
      ready = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(ready, `API did not start: ${serverLog}`);
  const request = async (path, token, body, method) => {
    const response = await fetch(base + path, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json() };
  };
  const credentials = {
    email: 'customer@example.invalid',
    password: 'Foundation-test-123!',
  };
  assert.equal(
    (await request('/auth/register', null, { ...credentials, role: 'ADMIN' }))
      .status,
    400,
  );
  assert.equal(
    (await request('/auth/register', null, credentials)).status,
    201,
  );
  const token = (await request('/auth/login', null, credentials)).body
    .accessToken;
  assert.ok(token);
  assert.equal((await request('/auth/me', token)).body.role, 'CUSTOMER');
  assert.equal((await request('/admin/orders')).status, 401);
  assert.equal((await request('/admin/orders', 'invalid')).status, 401);
  assert.equal((await request('/admin/orders', token)).status, 403);
  assert.equal((await request('/orders/100', token)).status, 404);
  await query(`UPDATE "User" SET role='ADMIN' WHERE email=$1`, [
    credentials.email,
  ]);
  assert.equal((await request('/auth/me', token)).body.role, 'ADMIN');
  assert.equal((await request('/admin/orders', token)).status, 200);
  assert.equal((await request('/orders/100', token)).status, 200);
  assert.equal((await request('/recipes')).status, 401);
  const adminRecipes = await request('/recipes', token);
  assert.equal(adminRecipes.status, 200);
  assert.equal(adminRecipes.body.length, 10);
  assert.ok(adminRecipes.body[0].ingredients[0].name);
  const menu = await request('/products');
  assert.equal(menu.status, 200);
  assert.equal(menu.body.length, 10);
  assert.ok(!menu.body.some((item) => item.id === 100));
  const coffeeId = (
    await query(`SELECT id FROM "Ingredient" WHERE name='Cà phê bột'`)
  ).rows[0].id;
  const draft = {
    name: 'Verification Coffee',
    price: 20000,
    imageUrl: '/images/products/ca-phe-sua.jpg',
    isActive: true,
    ingredients: [{ ingredientId: coffeeId, quantity: 20 }],
  };
  const created = await request('/recipes', token, draft);
  assert.equal(created.status, 201);
  const recipeId = created.body.id;
  assert.equal((await request('/products/' + recipeId)).body.stock, 73);
  assert.equal(
    (await request('/recipes', token, { ...draft, price: -1 })).status,
    400,
  );
  assert.equal(
    (
      await request('/recipes', token, {
        ...draft,
        name: 'Missing ingredient recipe',
        ingredients: [{ ingredientId: 2147483647, quantity: 1 }],
      })
    ).status,
    400,
  );
  assert.equal((await request('/recipes', token, draft)).status, 409);
  const concurrent = await Promise.all([
    request('/recipes', token, { ...draft, name: 'Concurrent Coffee' }),
    request('/recipes', token, { ...draft, name: 'Concurrent Coffee' }),
  ]);
  assert.deepEqual(
    concurrent.map((result) => result.status).sort(),
    [201, 409],
  );
  const order = await request('/orders', token, {
    items: [{ productId: recipeId, quantity: 2, size: 'M', toppings: [] }],
  });
  assert.equal(order.status, 201);
  const orderId = order.body.orderId;
  const snapshot = async () => ({
    items: (
      await query('SELECT * FROM "OrderItem" WHERE "orderId"=$1', [orderId])
    ).rows,
    uses: (
      await query('SELECT * FROM "OrderIngredient" WHERE "orderId"=$1', [
        orderId,
      ])
    ).rows,
  });
  const before = await snapshot();
  assert.equal(before.items[0].recipeName, draft.name);
  assert.equal(before.uses[0].quantity, 40);
  const changed = await request(
    '/recipes/' + recipeId,
    token,
    {
      name: 'Edited Coffee',
      price: 25000,
      ingredients: [{ ingredientId: coffeeId, quantity: 30 }],
    },
    'PATCH',
  );
  assert.equal(changed.status, 200);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await request('/products/' + recipeId)).body.stock, 47);
  // Bypass service validation to force a foreign-key failure after link deletion.
  const { RecipesPrismaAdapter } =
    await import('../dist/recipes/recipes.prisma-adapter.js');
  const repository = new RecipesPrismaAdapter();
  try {
    await assert.rejects(
      repository.transaction((tx) =>
        tx.update(recipeId, {
          ingredients: [{ ingredientId: 2147483647, quantity: 1 }],
        }),
      ),
      (error) => error.getStatus?.() === 400,
    );
    assert.equal(
      (await repository.findById(recipeId)).ingredients[0].quantity,
      30,
    );
  } finally {
    await repository.onModuleDestroy();
  }
  assert.equal(
    (await request('/recipes/' + recipeId, token, { isActive: false }, 'PATCH'))
      .status,
    200,
  );
  assert.equal((await request('/products/' + recipeId)).status, 404);
  assert.deepEqual(await snapshot(), before);
  console.log(
    'PASS: Recipes CRUD/auth, menu Recipe IDs/stock, duplicate race, DB rollback, immutable order snapshots',
  );
  await query(`UPDATE "User" SET role='CUSTOMER' WHERE email=$1`, [
    credentials.email,
  ]);
  assert.equal((await request('/admin/orders', token)).status, 403);
  assert.equal((await request('/orders/100', token)).status, 404);
  assert.equal((await request('/recipes', token)).status, 403);
  console.log(
    'PASS: HTTP register role rejection, /auth/me role, 401/403/200, ownership, immediate role changes',
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  await pool.end();
}
