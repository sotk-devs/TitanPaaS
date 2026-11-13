import { PartialType } from '@nestjs/swagger';
import { CreateApiKeyDto } from './create-api-key.dto.js';

export class UpdateApiKeyDto extends PartialType(CreateApiKeyDto) {}
