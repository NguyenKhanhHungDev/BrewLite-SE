import { ParseDatabaseIdPipe } from '../common/parse-database-id.pipe.js';
import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseDatabaseIdPipe) id: number) {
    return this.productsService.findOne(id);
  }
}