import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import type { RecipesRepository, RecipesTransaction } from './recipes.contract.js';

describe('RecipesService preparation (mock repository, no database)', () => {
  const input = {
    name: 'Cà phê sữa', price: 35000, imageUrl: '/images/products/ca-phe-sua.jpg',
    isActive: true, ingredients: [{ ingredientId: 12, quantity: 20 }],
  };
  const tx = {
    findById: vi.fn(), findByName: vi.fn(), ingredientIdsExist: vi.fn(),
    create: vi.fn(), update: vi.fn(),
  } satisfies RecipesTransaction;
  const repository: RecipesRepository = {
    findAll: vi.fn(), findById: vi.fn(),
    transaction: vi.fn(async (work) => work(tx)),
  };
  const service = new RecipesService(repository);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(repository.transaction).mockImplementation(async (work) => work(tx));
    tx.ingredientIdsExist.mockResolvedValue(true);
    tx.findById.mockResolvedValue({ id: 7 });
  });

  it('checks references and creates inside the repository transaction', async () => {
    await service.create(input);
    expect(repository.transaction).toHaveBeenCalledOnce();
    expect(tx.ingredientIdsExist).toHaveBeenCalledWith([12]);
    expect(tx.create).toHaveBeenCalledWith(input);
  });

  it.each([
    { name: '   ' }, { price: -1 }, { price: 0 }, { price: 1.5 },
    { price: 2147483648 }, { isActive: 'true' },
    { imageUrl: 'https://example.com/a.jpg' }, { imageUrl: '/images/products/../a.jpg' },
    { ingredients: [] }, { ingredients: [{ ingredientId: 1, quantity: 0 }] },
    { ingredients: [{ ingredientId: -1, quantity: 1 }] },
    { ingredients: [{ ingredientId: 1, quantity: 1 }, { ingredientId: 1, quantity: 2 }] },
    { unknownField: true },
  ])('rejects invalid create input: %j', (patch) => {
    expect(() => service.create({ ...input, ...patch } as typeof input)).toThrow(BadRequestException);
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name', async () => {
    tx.findByName.mockResolvedValue({ id: 8 });
    await expect(service.create(input)).rejects.toThrow(ConflictException);
    expect(tx.create).not.toHaveBeenCalled();
  });

  it('rejects missing ingredient references before mutation', async () => {
    tx.ingredientIdsExist.mockResolvedValue(false);
    await expect(service.create(input)).rejects.toThrow(BadRequestException);
    expect(tx.create).not.toHaveBeenCalled();
  });

  it('updates recipe links through a single repository transaction', async () => {
    await service.update(7, { ingredients: input.ingredients });
    expect(repository.transaction).toHaveBeenCalledOnce();
    expect(tx.update).toHaveBeenCalledWith(7, { ingredients: input.ingredients });
  });

  it('allows the current name on update', async () => {
    tx.findByName.mockResolvedValue({ id: 7 });
    await service.update(7, { name: input.name });
    expect(tx.update).toHaveBeenCalled();
  });

  it('rejects explicit null on PATCH', () => {
    expect(() => service.update(7, { ingredients: null } as never)).toThrow(BadRequestException);
  });

  it('returns 404 for a missing recipe on update', async () => {
    tx.findById.mockResolvedValue(null);
    await expect(service.update(7, { price: 40000 })).rejects.toThrow(NotFoundException);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing recipe on read', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);
    await expect(service.findOne(7)).rejects.toThrow(NotFoundException);
  });
});
