import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket =
      process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'titan-backups';

    const endpoint =
      process.env.S3_ENDPOINT ||
      process.env.MINIO_ENDPOINT ||
      'http://localhost:9000';
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID ||
      process.env.MINIO_ACCESS_KEY ||
      'minioadmin';
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY ||
      process.env.MINIO_SECRET_KEY ||
      'minioadmin';
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  getBucketName(): string {
    return this.bucket;
  }

  async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({
            Bucket: this.bucket,
          }),
        );
        this.logger.log(`Bucket de almacenamiento ${this.bucket} creado.`);
      } catch (err) {
        this.logger.warn(
          `Aviso al verificar o crear bucket ${this.bucket}: ${(err as Error).message}`,
        );
      }
    }
  }

  async uploadBuffer(
    key: string,
    data: Buffer,
    contentType = 'application/gzip',
  ): Promise<{ bucket: string; key: string; size: number }> {
    await this.ensureBucketExists();

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );

    this.logger.log(
      `Objeto ${key} subido exitosamente a ${this.bucket} (${data.length} bytes)`,
    );

    return {
      bucket: this.bucket,
      key,
      size: data.length,
    };
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Cuerpo vacio en respuesta S3 para la clave: ${key}`);
    }

    if (response.Body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Objeto ${key} eliminado de ${this.bucket}`);
    } catch (err) {
      this.logger.warn(
        `Error al eliminar ${key} de ${this.bucket}: ${(err as Error).message}`,
      );
    }
  }

  async headObject(key: string): Promise<{ size: number } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return { size: Number(res.ContentLength || 0) };
    } catch {
      return null;
    }
  }
}
