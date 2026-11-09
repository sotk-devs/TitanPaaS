import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomDomainDto {
  @ApiProperty({
    description:
      'Nombre de dominio o subdominio personalizado (ej: mi-app.com, sub.mi-app.com)',
    example: 'mi-app.com',
  })
  @IsNotEmpty({ message: 'El nombre de dominio es obligatorio' })
  @IsString({ message: 'El dominio debe ser una cadena de texto' })
  @MaxLength(253, {
    message: 'El nombre de dominio no puede exceder 253 caracteres',
  })
  @Matches(
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    {
      message:
        'El dominio no tiene un formato válido (ej. midominio.com o sub.midominio.com)',
    },
  )
  domain: string;
}
