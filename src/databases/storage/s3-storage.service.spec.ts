import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { S3StorageService } from './s3-storage.service.js';

describe('S3StorageService', () => {
  let service: S3StorageService;
  let mockSend: jest.Mock;

  beforeEach(() => {
    service = new S3StorageService();
    mockSend = jest.fn();
    (service as any).client = {
      send: mockSend,
    };
  });

  it('should return bucket name', () => {
    expect(service.getBucketName()).toBeDefined();
  });

  it('should ensure bucket exists when head succeeds', async () => {
    mockSend.mockResolvedValueOnce({});
    await service.ensureBucketExists();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should create bucket if head fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('BucketNotFound'));
    mockSend.mockResolvedValueOnce({});
    await service.ensureBucketExists();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should upload buffer and return metadata', async () => {
    mockSend.mockResolvedValueOnce({}); // head bucket
    mockSend.mockResolvedValueOnce({}); // put object

    const data = Buffer.from('test backup content');
    const result = await service.uploadBuffer('backups/test.sql.gz', data);

    expect(result.key).toBe('backups/test.sql.gz');
    expect(result.size).toBe(data.length);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should download buffer from S3', async () => {
    const rawData = Buffer.from('downloaded backup data');
    mockSend.mockResolvedValueOnce({
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array(rawData)),
      },
    });

    const result = await service.downloadBuffer('backups/test.sql.gz');
    expect(result.toString()).toBe('downloaded backup data');
  });

  it('should delete object from S3', async () => {
    mockSend.mockResolvedValueOnce({});
    await service.deleteObject('backups/test.sql.gz');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should return head object size', async () => {
    mockSend.mockResolvedValueOnce({
      ContentLength: 4096,
    });
    const result = await service.headObject('backups/test.sql.gz');
    expect(result?.size).toBe(4096);
  });
});
