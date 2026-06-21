import { Test, TestingModule } from '@nestjs/testing';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RecipesService', () => {
  let service: RecipesService;

  beforeEach(async () => {
    // PrismaModule is @Global() at app runtime but not present in a bare TestingModule,
    // so provide a minimal PrismaService mock for DI resolution (no DB connection in unit tests).
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // SECURITY (advisor audit): public rails must exclude unreviewed UGC (status:'pending').
  describe('public visibility filter', () => {
    it('findAll queries only active + public recipes', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const count = jest.fn().mockResolvedValue(0);
      const svc = new RecipesService({ recipe: { findMany, count } } as any);
      await svc.findAll();
      expect(findMany.mock.calls[0][0].where).toMatchObject({ status: 'active', isPublic: true });
    });

    it('search queries only active + public recipes', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const svc = new RecipesService({ recipe: { findMany } } as any);
      await svc.search('murgh');
      expect(findMany.mock.calls[0][0].where).toMatchObject({ status: 'active', isPublic: true });
    });
  });
});
