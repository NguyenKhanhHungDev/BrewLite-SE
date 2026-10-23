import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockPrisma = {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = Object.create(ProductsService.prototype) as ProductsService;
    Object.assign(service, { prisma: mockPrisma });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all products', async () => {
    const products = [
      {
        id: 1,
        name: 'Cà phê sữa',
        price: 35000,
        imageUrl: '/images/ca-phe-sua.jpg',
        stock: 30,
      },
    ];

    mockPrisma.product.findMany.mockResolvedValue(products);

    const result = await service.findAll();

    expect(result).toEqual(products);
    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
  });

  it('should return a product by id', async () => {
    const product = {
      id: 1,
      name: 'Cà phê sữa',
      price: 35000,
      imageUrl: '/images/ca-phe-sua.jpg',
      stock: 30,
    };

    mockPrisma.product.findUnique.mockResolvedValue(product);

    const result = await service.findOne(1);

    expect(result).toEqual(product);
    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('should throw NotFoundException when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should disconnect Prisma when module is destroyed', async () => {
    mockPrisma.$disconnect.mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(mockPrisma.$disconnect).toHaveBeenCalledOnce();
  });
});