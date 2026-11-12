import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GithubExchangeDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6g7h8i9j0',
    description: 'Código de autorización OAuth 2.0 retornado por GitHub',
  })
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código de autorización es obligatorio' })
  code: string;

  @ApiPropertyOptional({
    description:
      'Parámetro state firmado para validación CSRF (si fue generado vía GET /auth/github)',
  })
  @IsOptional()
  @IsString({ message: 'El parámetro state debe ser una cadena de texto' })
  state?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Indica si se deben vincular automáticamente los repositorios del usuario tras autenticar',
  })
  @IsOptional()
  @IsBoolean({ message: 'autoLink debe ser un valor booleano' })
  autoLink?: boolean;
}
