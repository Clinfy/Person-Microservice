import { Module } from '@nestjs/common';
import { GeorefService } from 'src/clients/georef/georef.service';

@Module({
  providers: [GeorefService],
  exports: [GeorefService],
})
export class GeorefModule {}