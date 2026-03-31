import { Test, TestingModule } from '@nestjs/testing';
import { GendersService } from './gender.service';

describe('GenderService', () => {
  let service: GendersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GendersService],
    }).compile();

    service = module.get<GendersService>(GendersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
