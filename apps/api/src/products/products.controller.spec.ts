import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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

    mockProductsService.findAll.mockResolvedValue(products);

    const result = await controller.findAll();

    expect(result).toEqual(products);
    expect(mockProductsService.findAll).toHaveBeenCalledOnce();
  });

  it('should return a product by id', async () => {
    const product = {
      id: 1,
      name: 'Cà phê sữa',
      price: 35000,
      imageUrl: '/images/ca-phe-sua.jpg',
      stock: 30,
    };

    mockProductsService.findOne.mockResolvedValue(product);

    const result = await controller.findOne(1);

    expect(result).toEqual(product);
    expect(mockProductsService.findOne).toHaveBeenCalledWith(1);
  });
});