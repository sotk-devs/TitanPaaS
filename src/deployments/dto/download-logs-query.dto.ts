import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum LogDownloadFormat {
  TXT = 'txt',
  JSON = 'json',
}

export class DownloadLogsQueryDto {
  @ApiPropertyOptional({
    enum: LogDownloadFormat,
    default: LogDownloadFormat.TXT,
    description: 'Formato de exportación del archivo de logs (txt o json)',
    example: LogDownloadFormat.TXT,
  })
  @IsOptional()
  @IsEnum(LogDownloadFormat, {
    message: 'El formato de descarga debe ser "txt" o "json"',
  })
  format?: LogDownloadFormat = LogDownloadFormat.TXT;
}
