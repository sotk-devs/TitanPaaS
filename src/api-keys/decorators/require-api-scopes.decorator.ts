import { SetMetadata } from '@nestjs/common';
import { ApiKeyScope } from '../enums/api-key-scope.enum.js';

export const API_SCOPES_KEY = 'api_scopes';

export const RequireApiScopes = (...scopes: ApiKeyScope[]) =>
  SetMetadata(API_SCOPES_KEY, scopes);
