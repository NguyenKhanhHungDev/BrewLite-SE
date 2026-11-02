import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import type {
  RecipesRepository,
  RecipesTransaction,
} from './recipes.contract.js';

const include = {
  ingredients: {
    include: { ingredient: true },
    orderBy: { ingredientId: 'asc' as const },
  },
};

@Injectable()
export class RecipesPrismaAdapter
  implements RecipesRepository, OnModuleDestroy
{
  private readonly prisma: PrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  findAll() {
    return this.prisma.recipe.findMany({ include, orderBy: { id: 'asc' } });
  }

  findById(id: number) {
    return this.prisma.recipe.findUnique({ where: { id }, include });
  }

  async transaction<T>(
    work: (tx: RecipesTransaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) =>
        work({
          findById: (id) => tx.recipe.findUnique({ where: { id }, include }),
          findByName: (name) =>
            tx.recipe.findUnique({ where: { name }, include }),
          ingredientIdsExist: async (ids) =>
            (await tx.ingredient.count({ where: { id: { in: ids } } })) ===
            new Set(ids).size,
          create: ({ ingredients, ...data }) =>
            tx.recipe.create({
              data: { ...data, ingredients: { create: ingredients } },
              include,
            }),
          update: async (id, { ingredients, ...data }) => {
            // Serialize edits to the same recipe before replacing its ingredient links.
            await tx.$queryRaw`SELECT "id" FROM "Recipe" WHERE "id" = ${id} FOR UPDATE`;
            if (ingredients !== undefined) {
              await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
            }
            return tx.recipe.update({
              where: { id },
              data: {
                ...data,
                ...(ingredients !== undefined
                  ? { ingredients: { create: ingredients } }
                  : {}),
              },
              include,
            });
          },
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Recipe name already exists');
        if (error.code === 'P2003')
          throw new BadRequestException('Ingredient not found');
        if (error.code === 'P2025')
          throw new NotFoundException('Recipe not found');
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
