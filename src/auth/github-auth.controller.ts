import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { GithubExchangeDto } from './dto/github-exchange.dto.js';
import { LinkGithubReposDto } from './dto/link-github-repos.dto.js';
import { GithubOAuthService } from './github-oauth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Auth')
@Controller('auth/github')
export class GithubAuthController {
  constructor(private readonly githubOAuthService: GithubOAuthService) {}

  @Get()
  @ApiOperation({
    summary: 'Iniciar flujo de autenticación OAuth 2.0 con GitHub',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['redirect', 'json'],
    description:
      'Usar "json" para obtener la URL de autorización sin redirección HTTP 302',
  })
  @ApiQuery({
    name: 'autoLink',
    required: false,
    type: Boolean,
    description:
      'Habilita o deshabilita la vinculación automática de repositorios tras el login',
  })
  @ApiQuery({
    name: 'redirectUri',
    required: false,
    type: String,
    description:
      'URL opcional del frontend a donde redirigir tras completar el callback',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirección hacia la pantalla de autorización de GitHub.',
  })
  @ApiResponse({
    status: 200,
    description: 'URL de autorización generada (cuando format=json).',
  })
  authorize(
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('autoLink') autoLink?: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const parsedAutoLink =
      autoLink === undefined ? undefined : autoLink === 'true';

    const authUrlData = this.githubOAuthService.getAuthorizationUrl({
      autoLink: parsedAutoLink,
      redirectUri,
    });

    if (format === 'json') {
      return res.status(HttpStatus.OK).json(authUrlData);
    }

    return res.redirect(authUrlData.authorizationUrl);
  }

  @Get('callback')
  @ApiOperation({
    summary:
      'Callback de GitHub OAuth 2.0: autentica al usuario y vincula repositorios',
  })
  @ApiQuery({ name: 'code', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'error', required: false, type: String })
  @ApiResponse({
    status: 200,
    description:
      'Autenticación exitosa con token JWT, datos del usuario y repositorios vinculados.',
  })
  @ApiResponse({
    status: 400,
    description: 'Código ausente o autorización rechazada por el usuario.',
  })
  @ApiResponse({
    status: 401,
    description: 'Parámetro state inválido/expirado o código inválido.',
  })
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      throw new BadRequestException(
        errorDescription || `Autorización denegada por GitHub: ${error}`,
      );
    }

    if (!code) {
      throw new BadRequestException(
        'Falta el parámetro code de autorización de GitHub',
      );
    }

    let redirectTarget = process.env.GITHUB_OAUTH_SUCCESS_REDIRECT?.trim();
    if (state) {
      const parsedState = this.githubOAuthService.verifyState(state);
      if (parsedState.redirectUri) {
        redirectTarget = parsedState.redirectUri;
      }
    }

    const result = await this.githubOAuthService.authenticateWithCode(
      code,
      state,
    );

    if (redirectTarget) {
      const separator = redirectTarget.includes('?') ? '&' : '?';
      return res.redirect(
        `${redirectTarget}${separator}token=${encodeURIComponent(result.access_token)}`,
      );
    }

    return res.status(HttpStatus.OK).json(result);
  }

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Intercambiar código OAuth de GitHub por JWT de TitanPaaS y vincular repositorios',
  })
  @ApiResponse({
    status: 200,
    description: 'Autenticación exitosa y repositorios sincronizados.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'Código o state de GitHub inválido.',
  })
  async exchangeCode(@Body() dto: GithubExchangeDto) {
    return this.githubOAuthService.authenticateWithCode(
      dto.code,
      dto.state,
      dto.autoLink,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('repositories')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Listar repositorios de GitHub del usuario autenticado y su estado de vinculación',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de repositorios de GitHub obtenida exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'La cuenta no tiene GitHub vinculado.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  async listRepositories(@Request() req: RequestWithUser) {
    return this.githubOAuthService.listUserRepositories(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('repositories/link')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Vincular manualmente repositorios de GitHub como proyectos en TitanPaaS',
  })
  @ApiResponse({
    status: 200,
    description: 'Repositorios vinculados exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Solicitud inválida o cuenta sin integración con GitHub activa.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  async linkRepositories(
    @Request() req: RequestWithUser,
    @Body() dto: LinkGithubReposDto,
  ) {
    return this.githubOAuthService.linkRepositories(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('unlink')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Desvincular la cuenta de GitHub del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuenta de GitHub desvinculada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'No hay cuenta de GitHub vinculada o el usuario no tiene contraseña local.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  async unlink(@Request() req: RequestWithUser) {
    return this.githubOAuthService.unlinkGithubAccount(req.user.id);
  }
}
