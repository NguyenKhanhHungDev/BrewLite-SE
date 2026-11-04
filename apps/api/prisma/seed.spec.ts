import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    seedRun: { findUnique: vi.fn(), create: vi.fn() },
    ingredient: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    recipe: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    recipeIngredient: { deleteMany: vi.fn(), create: vi.fn() },
  };
  return { tx, disconnect: vi.fn() };
});
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: class {} }));
vi.mock('../src/generated/prisma/client.js', () => ({
  PrismaClient: class {
    $transaction = async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx);
    $disconnect = mocks.disconnect;
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.tx.seedRun.findUnique.mockResolvedValue(null);
  mocks.tx.ingredient.count.mockResolvedValue(0);
  mocks.tx.recipe.count.mockResolvedValue(0);
  mocks.tx.ingredient.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: mocks.tx.ingredient.create.mock.calls.length,
  }));
  mocks.tx.recipe.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: mocks.tx.recipe.create.mock.calls.length,
  }));
});
async function seed() {
  vi.stubEnv('DATABASE_URL', 'postgresql://unused/seed-unit-test');
  try {
    await import('./seed.js');
    await vi.waitFor(() => expect(mocks.disconnect).toHaveBeenCalled());
  } finally {
    vi.unstubAllEnvs();
  }
}
it('does not recreate renamed ingredients/recipes after the demo marker exists', async () => {
  mocks.tx.seedRun.findUnique.mockResolvedValue({ id: 'brewlite-demo-v1' });
  await seed();
  expect(mocks.tx.ingredient.findUnique).not.toHaveBeenCalled();
  expect(mocks.tx.recipe.findUnique).not.toHaveBeenCalled();
  expect(mocks.tx.ingredient.create).not.toHaveBeenCalled();
  expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
});
it('adopts an existing database without overwriting user-managed records', async () => {
  mocks.tx.ingredient.count.mockResolvedValue(15);
  await seed();
  expect(mocks.tx.seedRun.create).toHaveBeenCalledOnce();
  expect(mocks.tx.ingredient.create).not.toHaveBeenCalled();
  expect(mocks.tx.recipe.create).not.toHaveBeenCalled();
});
it('initializes an empty database and records completion in the transaction', async () => {
  await seed();
  expect(mocks.tx.ingredient.create).toHaveBeenCalledTimes(15);
  expect(mocks.tx.recipe.create).toHaveBeenCalledTimes(10);
  expect(mocks.tx.recipeIngredient.create.mock.calls.length).toBeGreaterThan(
    10,
  );
  expect(mocks.tx.recipeIngredient.deleteMany).not.toHaveBeenCalled();
  expect(mocks.tx.seedRun.create).toHaveBeenCalledOnce();
});
