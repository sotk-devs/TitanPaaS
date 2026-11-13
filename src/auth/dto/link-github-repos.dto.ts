import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LinkGithubReposDto {
  @ApiPropertyOptional({
    example: ['sotk-devs/sample-repo'],
    description:
      'Lista de nombres completos de repositorios (owner/repo) a vincular como proyectos',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'repositories debe ser un arreglo de cadenas' })
  @ArrayNotEmpty({
    message: 'Si envías repositories, debe contener al menos un repositorio',
  })
  @IsString({ each: true, message: 'Cada repositorio debe ser una cadena' })
  repositories?: string[];

  @ApiPropertyOptional({
    example: false,
    description:
      'Vincular todos los repositorios accesibles desde la cuenta de GitHub',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'all debe ser un valor booleano' })
  all?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Configurar automáticamente el webhook de push de TitanPaaS en cada repositorio vinculado',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'configureWebhook debe ser un valor booleano' })
  configureWebhook?: boolean;

  @ApiPropertyOptional({
    example: 'https://api.titanpaas.dev/webhooks/github',
    description:
      'URL pública del webhook de GitHub (opcional; por defecto usa GITHUB_WEBHOOK_PUBLIC_URL)',
  })
  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'webhookUrl debe ser una URL válida' },
  )
  webhookUrl?: string;
}
