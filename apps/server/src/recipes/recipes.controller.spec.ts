import { Test, TestingModule } from '@nestjs/testing';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { RecipeRichnessService } from './intelligence/recipe-richness.service';
import { RecipeSearchService } from './search/recipe-search.service';
import { RecipeSafetyFilterService } from './intelligence/recipe-safety-filter.service';

describe('RecipesController', () => {
  let controller: RecipesController;

  beforeEach(async () => {
    // RecipesController depends on RecipesService + RecipeRichnessService + the safety filter; provide
    // minimal mocks so the bare TestingModule resolves DI without pulling in PrismaService / a DB connection.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [
        { provide: RecipesService, useValue: {} },
        { provide: RecipeRichnessService, useValue: {} },
        { provide: RecipeSearchService, useValue: {} },
        { provide: RecipeSafetyFilterService, useValue: {} },
      ],
    }).compile();

    controller = module.get<RecipesController>(RecipesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
