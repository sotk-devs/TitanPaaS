import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class UpdateBackupScheduleDto {
  @ApiPropertyOptional({
    example: '0 2 * * *',
    description:
      'Expresion cron estandar de 5 campos (ej: 0 2 * * * para las 02:00 AM)',
  })
  @IsOptional()
  @IsString()
  @Matches(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    {
      message:
        'La expresion cron debe tener un formato valido de 5 campos (minuto hora dia mes dia_semana)',
    },
  )
  cronExpression?: string;

  @ApiPropertyOptional({
    example: 7,
    description:
      'Cantidad de dias a retener los respaldos antes de su purga automatica',
    default: 7,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La retencion minima es de 1 dia' })
  @Max(365, { message: 'La retencion maxima es de 365 dias' })
  retentionDays?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Activar o pausar la programacion automatica',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
