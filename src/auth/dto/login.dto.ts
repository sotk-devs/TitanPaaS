import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Contraseña del usuario',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}
