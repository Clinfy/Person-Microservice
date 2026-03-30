import { Global, Module } from '@nestjs/common';
import { AuthClientService } from 'src/clients/auth/auth-client.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AuthClientService],
  exports: [AuthClientService],
})
export class AuthClientModule {}