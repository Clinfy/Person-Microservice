import { Module } from '@nestjs/common';
import { GeoapifyService } from 'src/clients/geoapify/geoapify.service';

@Module({
  providers: [GeoapifyService],
  exports: [GeoapifyService],
})
export class GeoapifyModule {}