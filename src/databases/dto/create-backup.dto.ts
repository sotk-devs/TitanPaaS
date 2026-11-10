import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBackupDto {
  @ApiPropertyOptional({
    example: 'Pre-migration backup',
    description: 'Descripcion o nota opcional para el respaldo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
