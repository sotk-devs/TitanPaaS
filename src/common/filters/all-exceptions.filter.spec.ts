import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import type { Request, Response } from 'express';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let loggerMock: jest.Mocked<Partial<Logger>>;
  let responseMock: Partial<Response>;
  let requestMock: Partial<Request>;
  let argumentsHostMock: ArgumentsHost;

  beforeEach(() => {
    loggerMock = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    };

    responseMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    requestMock = {
      url: '/test-endpoint',
      method: 'GET',
      ip: '127.0.0.1',
    };

    argumentsHostMock = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => responseMock,
        getRequest: () => requestMock,
      }),
    } as unknown as ArgumentsHost;

    filter = new AllExceptionsFilter(loggerMock as unknown as Logger);
  });

  it('should catch HttpException and return structured error response with status code', () => {
    const httpException = new HttpException(
      { message: 'Entity not found', error: 'Not Found' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(httpException, argumentsHostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        path: '/test-endpoint',
        method: 'GET',
        message: 'Entity not found',
        error: 'Not Found',
      }),
    );
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it('should catch unhandled Error and return 500 Internal Server Error', () => {
    const error = new Error('Database connection failed');

    filter.catch(error, argumentsHostMock);

    expect(responseMock.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        path: '/test-endpoint',
        method: 'GET',
      }),
    );
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('should handle string response in HttpException', () => {
    const httpException = new HttpException(
      'Forbidden resource',
      HttpStatus.FORBIDDEN,
    );

    filter.catch(httpException, argumentsHostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Forbidden resource',
      }),
    );
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});
