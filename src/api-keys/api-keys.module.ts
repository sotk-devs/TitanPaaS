import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKey } from './entities/api-key.entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), UsersModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService, TypeOrmModule],
})
export class ApiKeysModule {}
